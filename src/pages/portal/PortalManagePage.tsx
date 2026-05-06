// bal24 v2 — 전체 포털 목록 (프로젝트별)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Link2, Copy, Settings, Search } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../../components/ui';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getPortalUrl, STAGE_LABELS } from './portalConstants';
import type { ProjectPortal } from '../../types/database';
import PortalResponsesPanel from './PortalResponsesPanel';

type PortalRow = ProjectPortal & {
  project: { id: string; name: string } | null;
  items: { id: string; completed: boolean }[];
};

const SELECT_COLUMNS = '*, project:projects(id,name), items:portal_items(id,completed)';

export default function PortalManagePage() {
  const [items, setItems] = useState<PortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activePortal, setActivePortal] = useState<PortalRow | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('project_portals')
        .select(SELECT_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as PortalRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portals] 조회 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes("could not find the table") || m.includes('pgrst205')) {
        setErrorMsg('포털 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else {
        setErrorMsg('포털 목록을 불러오지 못했어요.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      (p.project?.name?.toLowerCase().includes(q) ?? false));
  }, [items, search]);

  const handleCopy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(getPortalUrl(token));
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portals] 복사 실패:', raw);
      setErrorMsg('링크 복사에 실패했어요.');
    }
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="제목·프로젝트로 검색"
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Link to="/portal/templates">
          <Button variant="outline" leftIcon={<Settings size={14} />}>템플릿 관리</Button>
        </Link>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
        💡 새 포털은 <strong>프로젝트 상세 → 포털 탭</strong>에서 만들어요. 이 페이지는 전체 포털 회신 현황을 모아서 봐요.
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-dashed border-slate-200">
          <Link2 size={28} className="text-slate-300 mb-2" />
          <p className="text-sm text-muted">{search.trim() ? '검색 결과가 없어요.' : '아직 등록된 포털이 없어요.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => {
            const total = p.items.length;
            const done = p.items.filter((i) => i.completed).length;
            const pending = total - done;
            return (
              <Card key={p.id} className="hover:border-primary/30 hover:shadow-md transition h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => setActivePortal(p)} className="text-left min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-text truncate hover:text-primary transition-colors">{p.title}</h3>
                      <div className="text-xs text-muted truncate mt-0.5">{p.project?.name ?? '프로젝트 미연결'}</div>
                    </button>
                    <Badge variant={p.is_active ? 'success' : 'default'}>{p.is_active ? '활성' : '비활성'}</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted">
                    {p.stage_tag && <Badge variant="primary">{STAGE_LABELS[p.stage_tag]}</Badge>}
                    <span>항목 {total}</span>
                    <span>· 완료 <span className="text-success font-bold">{done}</span></span>
                    <span>· 미완료 <span className={pending > 0 ? 'text-secondary font-bold' : ''}>{pending}</span></span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button type="button" onClick={() => void handleCopy(p.portal_token)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <Copy size={11} />
                      {copiedToken === p.portal_token ? '복사됨!' : 'URL 복사'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PortalResponsesPanel
        open={Boolean(activePortal)}
        portal={activePortal}
        onClose={() => setActivePortal(null)}
      />
    </div>
  );
}
