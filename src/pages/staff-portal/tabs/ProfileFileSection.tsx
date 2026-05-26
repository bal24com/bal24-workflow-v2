// 강사 포털 · 자료 탭 [프로필] 서브탭 — 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN PART F (2026-05-28)
// PM 이 PART G (강사조서 탭) 에서 업로드한 staff_profile_files 를 강사가 다운로드만 가능 (읽기 전용).

import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Download, User } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import EmptyState from '../../../components/EmptyState';
import { formatDateKo } from '../../../lib/utils';
import type { StaffPortalIdentity } from '../staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
  selectedProgramId: string | null;
}

interface ProfileFileRow {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  uploaded_by?: string | null;
}

const CARD_CLASS = 'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

export default function ProfileFileSection({ staff, selectedProgramId }: Props) {
  const [files, setFiles] = useState<ProfileFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  // 박경수님 2026-05-28 — 테이블 미생성·FK 미존재 등 환경 오류 안내
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    // staff_pool 타입의 강사만 staff_profile_files 조회 (profile 타입은 PM 업로드 대상 아님)
    if (staff.sourceType !== 'staff_pool') { setFiles([]); setLoading(false); return; }
    // FK 조인 제거 — 박경수님 환경의 staff_profile_files_uploaded_by_fkey 가 다른 이름일 수 있어 단순 select 로 안전 처리
    let q = supabase.from('staff_profile_files')
      .select('id, file_url, file_name, file_size, created_at, uploaded_by')
      .eq('staff_id', staff.id)
      .order('created_at', { ascending: false });
    if (selectedProgramId) q = q.eq('program_id', selectedProgramId);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      console.error('[ProfileFileSection] 조회 실패:', error.message, error.code);
      if (msg.includes('relation') || msg.includes('does not exist') || error.code === 'PGRST205' || msg.includes('schema cache')) {
        setErrorMsg('staff_profile_files 테이블이 없어요. supabase/migrations/20260528_staff_portal_upgrade.sql 을 실행해 주세요.');
      } else if (msg.includes('row-level security') || msg.includes('permission denied')) {
        setErrorMsg('파일 조회 권한이 없어요. 관리자에게 문의해 주세요.');
      } else {
        setErrorMsg(`파일 목록을 불러올 수 없어요: ${error.message}`);
      }
      setFiles([]); return;
    }
    setFiles(((data ?? []) as unknown) as ProfileFileRow[]);
  }, [staff.id, staff.sourceType, selectedProgramId]);

  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;

  // 박경수님 2026-05-28 — 환경 오류 안내 (테이블 미생성·권한 등)
  if (errorMsg) {
    return (
      <div className={`${CARD_CLASS} text-center`}>
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 inline-block">⚠ {errorMsg}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState emoji="📂"
          title="담당 PM 이 아직 프로필 파일을 등록하지 않았어요."
          description={selectedProgramId ? '선택한 프로그램에 등록된 강사조서가 없어요.' : '프로그램을 선택하면 해당 프로그램의 파일만 보여요.'} />
      </div>
    );
  }

  return (
    <section className={CARD_CLASS}>
      <header className="flex items-center gap-1.5 mb-3">
        <User size={16} className="text-violet-500" aria-hidden="true" />
        <h2 className="text-base font-bold text-[#1E1B4B]">강사 프로필 파일 ({files.length}건)</h2>
      </header>
      <p className="text-[11px] text-slate-500 mb-3">담당 PM 이 업로드한 강사조서·약력서 파일이에요. 다운로드만 가능해요.</p>
      <ul className="divide-y divide-violet-50">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-2">
            <FileText size={14} className="text-violet-500 shrink-0" aria-hidden="true" />
            <a href={f.file_url} target="_blank" rel="noopener noreferrer"
              className="flex-1 min-w-0 truncate text-sm font-semibold text-violet-700 hover:underline">{f.file_name}</a>
            {f.file_size != null && (<span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{Math.round(f.file_size / 1024)}KB</span>)}
            <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDateKo(f.created_at)}</span>
            <a href={f.file_url} download className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-violet-700 hover:bg-violet-100" aria-label="다운로드">
              <Download size={11} aria-hidden="true" /> 다운로드
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
