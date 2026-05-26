// 프로그램 상세 · 강사조서 PM 탭 — 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN PART G (2026-05-28)
// PM 이 강사별 프로필 파일 (강사약력서·자격증 등) 업로드·관리. staff_profile_files 테이블.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Upload, Trash2, Download, FileText, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import EmptyState from '../../../components/EmptyState';
import { formatDateKo } from '../../../lib/utils';

interface Props { programId: string }

interface StaffRow {
  id: string;
  name: string;
}

interface ProfileFile {
  id: string;
  staff_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  storage_path: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { name: string } | null;
}

export default function InstructorProfileTab({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [staffs, setStaffs] = useState<StaffRow[]>([]);
  const [files, setFiles] = useState<ProfileFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    // 프로그램 배정된 강사 목록 (program_curriculum 의 distinct staff_id)
    const [{ data: cur, error: cErr }, { data: fs, error: fErr }] = await Promise.all([
      supabase.from('program_curriculum')
        .select('staff_id, staff:staff_pool!program_curriculum_staff_id_fkey(id, name)')
        .eq('program_id', programId).not('staff_id', 'is', null),
      supabase.from('staff_profile_files')
        .select('*, uploader:profiles!staff_profile_files_uploaded_by_fkey(name)')
        .eq('program_id', programId).order('created_at', { ascending: false }),
    ]);
    if (cErr) console.error('[InstructorProfileTab] 강사 조회 실패:', cErr.message);
    if (fErr) console.error('[InstructorProfileTab] 파일 조회 실패:', fErr.message);
    // 중복 제거 — Supabase FK 조인 결과가 단일 객체 또는 배열 모두 가능
    const map = new Map<string, StaffRow>();
    for (const r of (cur ?? []) as unknown as Array<{ staff_id: string; staff: StaffRow | StaffRow[] | null }>) {
      const sx = Array.isArray(r.staff) ? r.staff[0] : r.staff;
      if (sx && !map.has(sx.id)) map.set(sx.id, sx);
    }
    setStaffs(Array.from(map.values()));
    setFiles((fs ?? []) as ProfileFile[]);
    setLoading(false);
  }, [programId]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleUpload(staffId: string, file: File) {
    if (file.size > 50 * 1024 * 1024) { toast.error('파일은 50MB 이하만 업로드할 수 있어요.'); return; }
    setUploadingFor(staffId);
    const safeName = file.name.replace(/[^\w가-힣.()\- ]/g, '_');
    const path = `${programId}/${staffId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from('staff-profiles').upload(path, file, { upsert: false });
    if (upErr) {
      setUploadingFor(null);
      console.error('[InstructorProfileTab] 업로드 실패:', upErr.message);
      const msg = upErr.message.toLowerCase().includes('not found')
        ? 'staff-profiles 버킷이 없어요. Supabase Storage 에서 먼저 생성해 주세요.'
        : `업로드 실패: ${upErr.message}`;
      toast.error(msg); return;
    }
    const { data: pub } = supabase.storage.from('staff-profiles').getPublicUrl(path);
    const { error: insErr } = await supabase.from('staff_profile_files').insert({
      staff_id: staffId, program_id: programId,
      file_url: pub.publicUrl, file_name: file.name, file_size: file.size,
      storage_path: path, uploaded_by: user?.id ?? null,
    });
    setUploadingFor(null);
    if (insErr) { console.error('[InstructorProfileTab] DB INSERT 실패:', insErr.message); toast.error(`저장 실패: ${insErr.message}`); return; }
    toast.success('강사조서를 업로드했어요.');
    void reload();
  }

  async function handleDelete(f: ProfileFile) {
    if (!window.confirm(`"${f.file_name}" 을(를) 삭제할까요?`)) return;
    if (f.storage_path) await supabase.storage.from('staff-profiles').remove([f.storage_path]);
    const { error } = await supabase.from('staff_profile_files').delete().eq('id', f.id);
    if (error) { toast.error(`삭제 실패: ${error.message}`); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-slate-400"><Loader2 size={18} className="animate-spin mr-2" />불러오는 중…</div>;
  if (staffs.length === 0) return <EmptyState emoji="👨‍🏫" title="배정된 강사가 없어요." description="커리큘럼에 강사를 먼저 배정해 주세요." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">강사별 프로필 파일 (약력서·자격증 등). PM 이 업로드·삭제 가능, 강사는 포털에서 다운로드만 가능해요.</p>
      {staffs.map((s) => {
        const myFiles = files.filter((f) => f.staff_id === s.id);
        const isUploading = uploadingFor === s.id;
        return (
          <div key={s.id} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_2px_8px_rgba(124,58,237,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><User size={14} className="text-violet-600" /><span className="text-sm font-bold text-slate-800">{s.name}</span><span className="text-[11px] text-slate-400">파일 {myFiles.length}건</span></div>
              <label className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : 'border-violet-200 text-violet-700 hover:bg-violet-50'}`}>
                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                파일 추가
                <input type="file" className="hidden" disabled={isUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(s.id, f); e.target.value = ''; }} />
              </label>
            </div>
            {myFiles.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-2">아직 등록된 파일이 없어요.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {myFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 py-1.5 text-xs">
                    <FileText size={12} className="text-slate-400 shrink-0" />
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 text-violet-700 hover:underline truncate">{f.file_name}</a>
                    <span className="text-slate-400 whitespace-nowrap">{formatDateKo(f.created_at)}</span>
                    {f.uploader?.name && <span className="text-slate-400 whitespace-nowrap">· {f.uploader.name}</span>}
                    <a href={f.file_url} download className="text-violet-600 hover:text-violet-800" aria-label="다운로드"><Download size={12} /></a>
                    <button type="button" onClick={() => void handleDelete(f)} className="text-rose-500 hover:text-rose-700" aria-label="삭제"><Trash2 size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
