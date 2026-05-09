// bal24 v2 — 외부 고객 포털 (인증 불필요)
// /portal/:token

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PortalItem, ProjectPortal } from '../../types/database';
import ClientPortalItem from './ClientPortalItem';
import { usePMViewer } from '../../hooks/usePMViewer';
import PMViewerBanner from '../../components/PMViewerBanner';

type ScreenState = 'loading' | 'notfound' | 'closed' | 'expired' | 'ready';

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();
  const { isViewer, viewerName } = usePMViewer();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [portal, setPortal] = useState<ProjectPortal | null>(null);
  const [items, setItems] = useState<PortalItem[]>([]);

  const load = useCallback(async () => {
    if (!token) { setScreen('notfound'); return; }
    try {
      const { data, error } = await supabase
        .from('project_portals')
        .select('*, items:portal_items(*)')
        .eq('portal_token', token)
        .maybeSingle();
      if (error) {
        console.error('[client-portal] 조회 실패:', error.message);
        setScreen('notfound');
        return;
      }
      if (!data) { setScreen('notfound'); return; }
      const p = data as ProjectPortal & { items: PortalItem[] };
      setPortal(p);
      setItems((p.items ?? []).sort((a, b) => a.sort_order - b.sort_order));
      if (!p.is_active) { setScreen('closed'); return; }
      if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) { setScreen('expired'); return; }
      setScreen('ready');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[client-portal] 처리 중 오류:', raw);
      setScreen('notfound');
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const requiredItems = items.filter((i) => i.required);
  const requiredDone = requiredItems.filter((i) => i.completed).length;
  const allRequiredDone = requiredItems.length > 0 && requiredDone === requiredItems.length;

  return (
    <div className="min-h-screen bg-bg">
      {isViewer && <PMViewerBanner viewerName={viewerName} />}
      <div className="flex items-start justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl space-y-4">
        {screen === 'loading' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8">
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-muted">불러오는 중…</p>
            </div>
          </div>
        )}

        {screen === 'notfound' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8 text-center space-y-2">
            <div className="text-3xl">🔍</div>
            <h1 className="text-xl font-bold text-text">유효하지 않은 링크예요</h1>
            <p className="text-sm text-muted">링크를 다시 확인해 주세요.</p>
          </div>
        )}

        {screen === 'closed' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8 text-center space-y-2">
            <div className="text-3xl">🚪</div>
            <h1 className="text-xl font-bold text-text">비활성화된 포털입니다</h1>
            <p className="text-sm text-muted">{portal?.title}</p>
          </div>
        )}

        {screen === 'expired' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8 text-center space-y-2">
            <div className="text-3xl">⏱️</div>
            <h1 className="text-xl font-bold text-text">만료된 링크입니다</h1>
            <p className="text-sm text-muted">운영자에게 새 링크를 요청해 주세요.</p>
          </div>
        )}

        {screen === 'ready' && portal && (
          <>
            <header className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 space-y-2">
              <h1 className="text-xl font-bold text-text">{portal.title}</h1>
              {portal.message && <p className="text-sm text-muted whitespace-pre-wrap">{portal.message}</p>}
              {requiredItems.length > 0 && (
                <div className="text-xs text-muted">
                  필수 항목 진행 <span className={['font-bold', allRequiredDone ? 'text-success' : 'text-secondary'].join(' ')}>
                    {requiredDone}/{requiredItems.length}
                  </span>
                </div>
              )}
            </header>

            {items.length === 0 ? (
              <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 text-center text-sm text-muted">
                등록된 항목이 없어요.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <ClientPortalItem
                    key={it.id}
                    item={it}
                    projectId={portal.project_id}
                    readOnly={isViewer}
                    onCompleted={() => void load()}
                  />
                ))}
              </div>
            )}

            {requiredItems.length > 0 && (
              <div className="rounded-card border border-[#EDE9FE] bg-white shadow-card p-4 text-center">
                {allRequiredDone ? (
                  <p className="text-sm font-bold text-success">✓ 필수 항목을 모두 완료했어요!</p>
                ) : (
                  <p className="text-sm text-muted">필수 항목 {requiredItems.length - requiredDone}개가 남았어요.</p>
                )}
              </div>
            )}

            <p className="text-center text-xs text-muted py-2">
              © 2026 (주)밸런스닷 · WorkFlow
            </p>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
