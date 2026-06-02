// bal24 v2 — 프로젝트 상세 · 외부 공유 탭
// 박경수님 2026-06-02 STEP-MERGE-3 — 레거시 프로젝트 포털 시스템 UI 제거.
//   모든 외부공유는 프로그램 단위로 통일.
//   기존 project_portals·portal_items 데이터는 DB 에 보존 (코드만 deprecate).

import { useEffect, useState } from 'react';
import { Info, Archive } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import ProjectProgramShareDashboard from './ProjectProgramShareDashboard';

type Props = {
  projectId: string;
  /** STEP-MERGE-3 — 더 이상 사용하지 않음. PortalCreateModal 제거. */
  clientId?: string | null;
};

export default function PortalTab({ projectId }: Props) {
  const [legacyCount, setLegacyCount] = useState<number | null>(null);

  // 박경수님 안전 — 기존 project_portals 데이터 보존 안내용 count
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { count, error } = await supabase
        .from('project_portals')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId);
      if (cancelled) return;
      if (error) {
        console.warn('[portal-tab] 레거시 count 조회 경고:', error.message);
        setLegacyCount(0);
        return;
      }
      setLegacyCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <div className="space-y-5">
      {/* 박경수님 2026-06-02 STEP-C — 메인: 프로그램 외부공유 대시보드 */}
      <ProjectProgramShareDashboard projectId={projectId} />

      {/* 박경수님 2026-06-02 STEP-MERGE-3 — 레거시 데이터 보존 안내 */}
      {legacyCount !== null && legacyCount > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 flex items-start gap-2">
          <Archive size={14} className="text-amber-700 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <p className="font-bold inline-flex items-center gap-1">
              <Info size={11} aria-hidden="true" />
              이전 프로젝트 포털 데이터 <strong>{legacyCount}건</strong>이 DB 에 보존돼 있어요.
            </p>
            <p className="mt-0.5">
              새 [프로그램별 외부 공유] 가 모든 기능을 대체해요. 보존된 데이터 복원·삭제가 필요하면 관리자에게 문의해 주세요.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
