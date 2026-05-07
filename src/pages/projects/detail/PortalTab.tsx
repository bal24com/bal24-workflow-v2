// bal24 v2 — 프로젝트 상세 · 포털 탭
// 포털 만들기 + 포털 목록 + 회신 패널

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Loader2, Link2, Copy, Edit3, Power, PowerOff,
} from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { copyToClipboard } from '../../../lib/clipboard';
import { getPortalUrl, STAGE_LABELS } from '../../portal/portalConstants';
import type { ProjectPortal } from '../../../types/database';
import PortalCreateModal from '../../portal/PortalCreateModal';
import PortalResponsesPanel from '../../portal/PortalResponsesPanel';

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
      setPortals((data ?? []) as PortalRow[]);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {portals.map((p) => {
            const total = p.items.length;
            const done = p.items.filter((i) => i.completed).length;
            return (
              <Card key={p.id} className="hover:border-primary/30 transition">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => setActivePortal(p)} className="text-left min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-text truncate hover:text-primary">{p.title}</h3>
                      {p.stage_tag && <Badge variant="primary">{STAGE_LABELS[p.stage_tag]}</Badge>}
                    </button>
                    <Badge variant={p.is_active ? 'success' : 'default'}>{p.is_active ? '활성' : '비활성'}</Badge>
                  </div>
                  <div className="text-[11px] text-muted">
                    항목 {total} · 완료 <span className="text-success font-bold">{done}</span>
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t border-slate-100 text-xs">
                    <button type="button" onClick={() => void handleCopy(p.portal_token)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-primary hover:bg-primary/5">
                      <Copy size={11} />{copiedToken === p.portal_token ? '복사됨!' : 'URL'}
                    </button>
                    <button type="button" onClick={() => { setEditing(p); setCreateOpen(true); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-500 hover:bg-slate-50">
                      <Edit3 size={11} />수정
                    </button>
                    <button type="button" onClick={() => void toggleActive(p)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-slate-500 hover:bg-slate-50 ml-auto">
                      {p.is_active ? <><PowerOff size={11} />비활성</> : <><Power size={11} />활성</>}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
