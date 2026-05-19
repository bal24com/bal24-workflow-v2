// bal24 v2 — STEP-STAFF-PORTAL-P5
// 강사 포털 · 자료 탭 — curriculum_materials 실제 업로드/다운로드/삭제.
// 차시별로 그룹핑 + 강사 본인 자료 + PM 업로드 자료(instructor_invitations.materials) 통합.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, FileText, Download, Trash2, Upload, Info } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import type { StaffPortalIdentity } from '../staffPortalUtils';

interface Props { staff: StaffPortalIdentity }

interface CurriculumRow {
  id: string; session_no: number; title: string; program_id: string; program_name: string | null;
}
interface MaterialRow {
  id: string; curriculum_id: string; uploader_id: string; uploader_source: string;
  file_name: string; file_url: string; file_size: number | null;
}

const STORAGE_BUCKET = 'staff-files';

export default function StaffMaterialsTab({ staff }: Props) {
  const toast = useToast();
  const [curriculums, setCurriculums] = useState<CurriculumRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const staffCol = staff.sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';
    // 본인 차시 (curriculum_staff → program_curriculum)
    const { data: cs } = await supabase.from('curriculum_staff')
      .select('curriculum_id').eq(staffCol, staff.id);
    const curIds = ((cs ?? []) as Array<{ curriculum_id: string }>).map((r) => r.curriculum_id);
    if (curIds.length === 0) {
      setCurriculums([]); setMaterials([]); setLoading(false); return;
    }
    const { data: pc } = await supabase.from('program_curriculum')
      .select('id, session_no, title, program_id').in('id', curIds)
      .order('session_no', { ascending: true });
    const pcRows = ((pc ?? []) as Array<Omit<CurriculumRow, 'program_name'>>);
    const progIds = Array.from(new Set(pcRows.map((r) => r.program_id)));
    let progMap = new Map<string, string>();
    if (progIds.length > 0) {
      const { data: prog } = await supabase.from('programs').select('id, name').in('id', progIds);
      (prog ?? []).forEach((p) => progMap.set(p.id as string, p.name as string));
    }
    setCurriculums(pcRows.map((r) => ({ ...r, program_name: progMap.get(r.program_id) ?? null })));

    const { data: mat, error: matErr } = await supabase.from('curriculum_materials')
      .select('*').in('curriculum_id', curIds).order('created_at', { ascending: false });
    if (matErr) {
      const m = (matErr.message ?? '').toLowerCase();
      if (m.includes('does not exist') || m.includes('pgrst205')) {
        setTableMissing(true); setMaterials([]);
      } else {
        console.warn('[staff-portal/materials] 조회 경고:', matErr.message);
        setMaterials([]);
      }
    } else setMaterials((mat ?? []) as MaterialRow[]);
    setLoading(false);
  }, [staff.id, staff.sourceType]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const materialsByCur = useMemo(() => {
    const m = new Map<string, MaterialRow[]>();
    materials.forEach((mat) => {
      const arr = m.get(mat.curriculum_id) ?? [];
      arr.push(mat); m.set(mat.curriculum_id, arr);
    });
    return m;
  }, [materials]);
  const curByProgram = useMemo(() => {
    const m = new Map<string, CurriculumRow[]>();
    curriculums.forEach((c) => {
      const arr = m.get(c.program_id) ?? [];
      arr.push(c); m.set(c.program_id, arr);
    });
    return m;
  }, [curriculums]);

  async function handleUpload(file: File, curriculumId: string) {
    setUploadingId(curriculumId);
    const safeName = file.name.replace(/[^A-Za-z0-9._-가-힣]+/g, '_').slice(0, 80);
    const path = `curriculum/${curriculumId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upErr) {
      setUploadingId(null);
      console.error('[staff-portal/materials] 업로드 실패:', upErr.message);
      toast.error('업로드에 실패했어요. 파일 크기·이름을 확인해 주세요.');
      return;
    }
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    const { error: insErr } = await supabase.from('curriculum_materials').insert({
      curriculum_id: curriculumId, uploader_id: staff.id, uploader_source: staff.sourceType,
      file_name: file.name, file_url: pub.publicUrl, file_size: file.size,
    });
    setUploadingId(null);
    if (insErr) {
      console.error('[staff-portal/materials] DB insert 실패:', insErr.message);
      toast.error('업로드는 됐지만 기록 저장에 실패했어요.');
      return;
    }
    toast.success('자료를 업로드했어요.');
    void fetchData();
  }

  async function handleDelete(mat: MaterialRow) {
    if (mat.uploader_id !== staff.id) { toast.error('본인이 올린 자료만 삭제할 수 있어요.'); return; }
    if (!window.confirm(`"${mat.file_name}" 자료를 삭제할까요?`)) return;
    const { error } = await supabase.from('curriculum_materials').delete().eq('id', mat.id);
    if (error) { console.error('[staff-portal/materials] 삭제 실패:', error.message); toast.error('삭제에 실패했어요.'); return; }
    toast.success('자료를 삭제했어요.');
    void fetchData();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }
  if (tableMissing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-6 text-center">
        <p className="text-sm font-bold text-amber-800">자료 테이블이 아직 활성화되지 않았어요</p>
        <p className="text-[11px] text-amber-700 mt-1">PM에게 마이그레이션(20260520_curriculum_materials.sql) 실행을 요청해 주세요.</p>
      </div>
    );
  }
  if (curriculums.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-12 text-center">
        <p className="text-slate-600 font-semibold">배정된 차시가 없어요</p>
        <p className="text-xs text-slate-400 mt-1">차시가 배정되면 자료 업로드가 가능해요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 px-4 py-3 text-xs text-cyan-800 flex items-start gap-2">
        <Info size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
        <p>본인이 올린 자료는 삭제할 수 있어요. PM이 올린 자료는 다운로드만 가능합니다.</p>
      </div>
      {Array.from(curByProgram.entries()).map(([pid, items]) => (
        <section key={pid} className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-sm font-bold text-[#1E1B4B] mb-2">{items[0]?.program_name ?? '(프로그램 미지정)'}</p>
          <ul className="space-y-2">
            {items.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-100 bg-violet-50/20 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700 mb-1.5">{c.session_no}차시 — {c.title}</p>
                <ul className="space-y-1 mb-2">
                  {(materialsByCur.get(c.id) ?? []).length === 0 && (
                    <li className="text-[11px] text-slate-400 italic">아직 자료가 없어요.</li>
                  )}
                  {(materialsByCur.get(c.id) ?? []).map((m) => {
                    const mine = m.uploader_id === staff.id;
                    return (
                      <li key={m.id} className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2 py-1.5">
                        <FileText size={12} className="shrink-0 text-violet-500" aria-hidden="true" />
                        <span className="flex-1 min-w-0 truncate text-[11px] font-semibold text-slate-700">{m.file_name}</span>
                        {m.file_size != null && (
                          <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">{Math.round(m.file_size / 1024)}KB</span>
                        )}
                        <a href={m.file_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold text-violet-700 hover:bg-violet-100">
                          <Download size={10} /> 다운로드
                        </a>
                        {mine && (
                          <button type="button" onClick={() => void handleDelete(m)} aria-label="삭제"
                            className="inline-flex items-center justify-center w-5 h-5 rounded text-rose-500 hover:bg-rose-50">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 cursor-pointer">
                  {uploadingId === c.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                  파일 선택하여 업로드
                  <input type="file" className="hidden" disabled={uploadingId === c.id}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f, c.id); e.target.value = ''; }} />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
