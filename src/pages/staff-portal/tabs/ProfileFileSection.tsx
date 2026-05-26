// 강사 포털 · 자료 탭 [프로필] 서브탭 — 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN PART F (2026-05-28)
// PM 이 staff_profile_files 에 업로드한 파일을 강사가 다운로드 (읽기 전용).
// 박경수님 2026-05-28 — 자체 에러 격리 + 안전한 렌더링 (ErrorBoundary 잡힘 방지).

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
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
}

export default function ProfileFileSection({ staff, selectedProgramId }: Props) {
  const [files, setFiles] = useState<ProfileFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // staff_pool 강사만 조회 대상
      if (!staff || staff.sourceType !== 'staff_pool') {
        setFiles([]); setLoading(false); return;
      }
      let q = supabase.from('staff_profile_files')
        .select('id, file_url, file_name, file_size, created_at')
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false });
      if (selectedProgramId) q = q.eq('program_id', selectedProgramId);
      const { data, error } = await q;
      if (error) {
        const msg = (error.message ?? '').toLowerCase();
        console.warn('[ProfileFileSection] 조회 경고:', error.message, error.code);
        if (msg.includes('relation') || msg.includes('does not exist')
          || msg.includes('could not find') || msg.includes('schema cache')
          || error.code === 'PGRST205') {
          setErrorMsg('staff_profile_files 테이블이 없어요. 박경수님 환경에 마이그레이션이 필요합니다.');
        } else if (msg.includes('row-level security') || msg.includes('permission denied')) {
          setErrorMsg('파일 조회 권한이 없어요.');
        } else {
          setErrorMsg(`파일 목록을 불러올 수 없어요: ${error.message ?? '알 수 없는 오류'}`);
        }
        setFiles([]);
      } else {
        setFiles((data ?? []) as ProfileFileRow[]);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error('[ProfileFileSection] 예외:', raw);
      setErrorMsg(`예기치 못한 오류: ${raw}`);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [staff, selectedProgramId]);

  useEffect(() => { void fetchFiles(); }, [fetchFiles]);

  const cardClass = 'bg-white rounded-2xl border border-violet-100 p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]';

  if (loading) {
    return <div className={cardClass}><p className="text-xs text-slate-400 text-center py-4">불러오는 중…</p></div>;
  }
  if (errorMsg) {
    return <div className={cardClass}><p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">⚠ {errorMsg}</p></div>;
  }
  if (files.length === 0) {
    return <div className={cardClass}><p className="text-sm text-slate-400 italic text-center py-4">담당 PM 이 아직 프로필 파일을 등록하지 않았어요.</p></div>;
  }

  return (
    <section className={cardClass}>
      <h2 className="text-sm font-bold text-[#1E1B4B] mb-3">강사 프로필 파일 ({files.length}건)</h2>
      <p className="text-[11px] text-slate-500 mb-3">PM 이 업로드한 강사조서·약력서 파일이에요. 다운로드만 가능해요.</p>
      <ul className="space-y-1.5">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-1.5 border-b border-violet-50 last:border-0">
            <span className="text-violet-500 text-xs">📄</span>
            <a href={f.file_url} target="_blank" rel="noopener noreferrer"
              className="flex-1 min-w-0 truncate text-sm font-semibold text-violet-700 hover:underline">{f.file_name}</a>
            {f.file_size != null && (
              <span className="text-[10px] text-slate-400 tabular-nums whitespace-nowrap">{Math.round(Number(f.file_size) / 1024)}KB</span>
            )}
            <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDateKo(f.created_at)}</span>
            <a href={f.file_url} download className="text-[10px] text-violet-600 hover:underline whitespace-nowrap">다운로드</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
