// bal24 v2 — 프로젝트 상세 · 외부 공유 탭
// 박경수님 2026-05-30 STEP-PORTAL-DETAIL-INLINE — 좌(포털 목록) + 우(자세한 사항) 분할.

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Loader2, Link2, Copy, Edit3, Power, PowerOff, ChevronRight,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { copyToClipboard } from '../../../lib/clipboard';
import { getPortalUrl, STAGE_LABELS } from '../../portal/portalConstants';
import type { ProjectPortal } from '../../../types/database';
import PortalCreateModal from '../../portal/PortalCreateModal';
import PortalResponsesPanel from '../../portal/PortalResponsesPanel';
import PortalAdminPanel from './PortalAdminPanel';

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
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  // 박경수님 2026-05-30 STEP-PORTAL-DETAIL-INLINE — 우측 자세히 패널 대상
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const handleCopy = async (token: string) => {
    const ok = await copyToClipboard(getPortalUrl(token));
    if (ok) {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    } else {
      setErrorMsg('링크 복사에 실패했어요. 직접 선택해서 복사해 주세요.');
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
    <div className="space-y-3">
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
              const active = selectedId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={[
                    'w-full text-left rounded-xl border transition p-3 space-y-1.5',
                    active
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-primary/40',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-sm font-bold truncate ${active ? 'text-primary' : 'text-text'}`}>
                        {p.title}
                      </h3>
                      {p.stage_tag && (
                        <div className="mt-1">
                          <Badge variant="primary">{STAGE_LABELS[p.stage_tag]}</Badge>
                        </div>
                      )}
                    </div>
                    <Badge variant={p.is_active ? 'success' : 'default'}>{p.is_active ? '활성' : '비활성'}</Badge>
                  </div>
                  <div className="text-[11px] text-muted">
                    항목 {total} · 완료 <span className="text-success font-bold">{done}</span>
                  </div>
                  <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100 text-xs">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); void handleCopy(p.portal_token); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); void handleCopy(p.portal_token); } }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-primary hover:bg-primary/10 cursor-pointer"
                    >
                      <Copy size={11} />{copiedToken === p.portal_token ? '복사됨' : 'URL'}
                    </span>
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
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-500 hover:bg-slate-100 cursor-pointer ml-auto"
                      title={p.is_active ? '비활성으로 전환' : '활성으로 전환'}
                    >
                      {p.is_active ? <PowerOff size={11} /> : <Power size={11} />}
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
