// bal24 v2 — 프로젝트 상세 · 외부 공유 탭
// 박경수님 2026-05-30 STEP-PORTAL-DETAIL-INLINE — 좌(포털 목록) + 우(자세한 사항) 분할.
// 박경수님 2026-06-02 — 카드 [URL] 제거 (구식 portal_token 매칭 안 됨, 우측 4종 URL 이 정답).
//                     비활성 카드 — opacity/배경 회색 톤으로 직관 강화.
// 박경수님 2026-06-02 STEP-C — 상단에 프로그램 외부공유 대시보드 (메인),
//                            기존 프로젝트 포털 시스템은 하단 레거시 펼침으로 보존.

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Loader2, Link2, Edit3, Power, PowerOff, ChevronRight, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { STAGE_LABELS } from '../../portal/portalConstants';
import type { ProjectPortal } from '../../../types/database';
import PortalCreateModal from '../../portal/PortalCreateModal';
import PortalResponsesPanel from '../../portal/PortalResponsesPanel';
import PortalAdminPanel from './PortalAdminPanel';
import ProjectProgramShareDashboard from './ProjectProgramShareDashboard';

type Props = {
  projectId: string;
  clientId?: string | null;
};

type PortalRow = ProjectPortal & {
  items: { id: string; completed: boolean }[];
};

const SELECT_COLUMNS = '*, items:portal_items(id,completed)';

export default function PortalTab({ projectId, clientId }: Props) {
  const [portals, setPortals] = useState<PortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectPortal | null>(null);
  const [activePortal, setActivePortal] = useState<PortalRow | null>(null);
  // 박경수님 2026-05-30 STEP-PORTAL-DETAIL-INLINE — 우측 자세히 패널 대상
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 박경수님 2026-06-02 STEP-C — 레거시 포털 시스템 펼침 상태 (기본 접힘)
  const [legacyOpen, setLegacyOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('project_portals')
        .select(SELECT_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as PortalRow[];
      setPortals(rows);
      // 첫 진입 시 — 첫 포털 자동 선택
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portal-tab] 조회 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes("could not find the table") || m.includes('pgrst205')) {
        setErrorMsg('포털 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else {
        setErrorMsg('포털 목록을 불러오지 못했어요.');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // 박경수님 2026-06-02 STEP-MERGE-1 — 포털 삭제 (cascade 로 portal_items 등 함께 정리)
  const handleDelete = async (p: PortalRow) => {
    if (!window.confirm(`"${p.title}" 포털을 삭제할까요?\n관련 항목·응답·수혜기관 데이터가 모두 함께 삭제돼요. 되돌릴 수 없어요.`)) return;
    try {
      const { error } = await supabase.from('project_portals').delete().eq('id', p.id);
      if (error) throw error;
      if (selectedId === p.id) setSelectedId(null);
      await fetchData();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portal-tab] 삭제 실패:', raw);
      setErrorMsg('삭제 중 오류가 발생했어요.');
    }
  };

  const toggleActive = async (p: PortalRow) => {
    try {
      const { error } = await supabase
        .from('project_portals')
        .update({ is_active: !p.is_active })
        .eq('id', p.id);
      if (error) throw error;
      await fetchData();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portal-tab] 활성 토글 실패:', raw);
      setErrorMsg('상태 변경에 실패했어요.');
    }
  };

  return (
    <div className="space-y-5">
      {/* 박경수님 2026-06-02 STEP-C — 메인: 프로그램 외부공유 대시보드 */}
      <ProjectProgramShareDashboard projectId={projectId} />

      {/* 레거시 프로젝트 포털 시스템 — 접힘 (deprecated) */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/60">
        <button type="button" onClick={() => setLegacyOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-100/60 rounded-2xl">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
              📦 레거시 프로젝트 포털 시스템 ({portals.length})
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              구 4종 토큰·체크리스트 시스템. 새 외부공유는 위 [프로그램별 외부 공유] 사용 권장.
            </p>
          </div>
          {legacyOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
        </button>

      {legacyOpen && (
      <div className="p-4 space-y-3 border-t border-slate-200">
      <div className="flex items-center justify-end">
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}
          onClick={() => { setEditing(null); setCreateOpen(true); }}>
          포털 만들기
        </Button>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted">
          <Loader2 size={16} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : portals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Link2 size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm text-muted mb-3">아직 등록된 포털이 없어요.</p>
            <Button variant="outline" size="sm" leftIcon={<Plus size={14} />}
              onClick={() => { setEditing(null); setCreateOpen(true); }}>
              첫 포털 만들기
            </Button>
          </CardContent>
        </Card>
      ) : (
        // 박경수님 2026-05-30 — 좌(280px) 카드 목록 + 우(자세히) 분할
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
          {/* 좌측 — 포털 카드 목록 */}
          <aside className="space-y-2">
            {portals.map((p) => {
              const total = p.items.length;
              const done = p.items.filter((i) => i.completed).length;
              const isSelected = selectedId === p.id;
              // 박경수님 2026-06-02 — 활성/비활성을 카드 전체 색조로 직관 표시
              const cardCls = [
                'w-full text-left rounded-xl border transition p-3 space-y-1.5',
                !p.is_active && 'border-l-4 border-l-slate-300 bg-slate-50 opacity-70',
                isSelected && p.is_active && 'border-primary bg-primary/5 shadow-sm',
                isSelected && !p.is_active && 'border-primary border-l-4 border-l-primary shadow-sm opacity-90',
                !isSelected && p.is_active && 'border-slate-200 bg-white hover:border-primary/40',
                !isSelected && !p.is_active && 'hover:border-primary/40',
              ].filter(Boolean).join(' ');
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cardCls}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-sm font-bold truncate ${isSelected ? 'text-primary' : p.is_active ? 'text-text' : 'text-slate-500'}`}>
                        {p.title}
                      </h3>
                      {p.stage_tag && (
                        <div className="mt-1">
                          <Badge variant="primary">{STAGE_LABELS[p.stage_tag]}</Badge>
                        </div>
                      )}
                    </div>
                    {/* 박경수님 2026-06-02 — 활성/비활성을 색 강조한 큰 배지로 */}
                    {p.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        활성
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold border border-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                        비활성
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted">
                    항목 {total} · 완료 <span className="text-success font-bold">{done}</span>
                  </div>
                  <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100 text-xs">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setEditing(p); setCreateOpen(true); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setEditing(p); setCreateOpen(true); } }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit3 size={11} />수정
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); void toggleActive(p); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); void toggleActive(p); } }}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold cursor-pointer ml-auto ${
                        p.is_active
                          ? 'text-rose-600 hover:bg-rose-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={p.is_active ? '클릭하면 비활성으로 전환' : '클릭하면 활성으로 전환'}
                    >
                      {p.is_active ? <><PowerOff size={11} />끄기</> : <><Power size={11} />켜기</>}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); void handleDelete(p); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); void handleDelete(p); } }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-rose-500 hover:bg-rose-50 cursor-pointer"
                      title="포털 삭제"
                    >
                      <Trash2 size={11} aria-hidden="true" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setActivePortal(p); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setActivePortal(p); } }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100 cursor-pointer"
                      title="회신 보기"
                    >
                      <ChevronRight size={11} />
                    </span>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* 우측 — 선택된 포털의 자세한 사항 */}
          <section>
            {selectedId ? (
              <PortalAdminPanel portalId={selectedId} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Link2 size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs text-muted">좌측에서 포털을 선택하면 자세한 사항을 볼 수 있어요.</p>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      )}

      </div>
      )}
      </section>

      <PortalCreateModal
        open={createOpen}
        projectId={projectId}
        clientId={clientId}
        portal={editing}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => void fetchData()}
      />
      <PortalResponsesPanel
        open={Boolean(activePortal)}
        portal={activePortal}
        onClose={() => setActivePortal(null)}
      />
    </div>
  );
}
