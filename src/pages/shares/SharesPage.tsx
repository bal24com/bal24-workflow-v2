// bal24 v2 — 공유 링크 통합 뷰 (STEP 19)
// 4종 외부 토큰 (강사 초대 / 출석 / 고객 포털 / 외부 폼) 한 화면에서 조회 + 복사

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui';
import { formatDateKo } from '../../lib/utils';
import {
  buildLink,
  copyToClipboard,
  fetchAllLinks,
  statusTone,
  CATEGORY_COLOR,
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  type LinkCategory,
  type SharedLink,
} from './sharesUtils';

type FilterValue = LinkCategory | 'ALL';

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'invitation', label: CATEGORY_LABEL.invitation },
  { value: 'attendance', label: CATEGORY_LABEL.attendance },
  { value: 'portal', label: CATEGORY_LABEL.portal },
  { value: 'form', label: CATEGORY_LABEL.form },
];

export default function SharesPage() {
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllLinks();
      setLinks(list);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[shares] 통합 조회 실패:', raw);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await fetchAllLinks();
        if (cancelled) return;
        setLinks(list);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[shares] 통합 조회 실패:', raw);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    const map = new Map<FilterValue, number>();
    map.set('ALL', links.length);
    for (const l of links) {
      map.set(l.category, (map.get(l.category) ?? 0) + 1);
    }
    return map;
  }, [links]);

  const visible = useMemo(() => {
    if (filter === 'ALL') return links;
    return links.filter((l) => l.category === filter);
  }, [links, filter]);

  const handleCopy = async (link: SharedLink) => {
    const url = buildLink(link.path, link.token);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <span aria-hidden="true">🔗</span>
          공유 링크
        </h1>
        <Button variant="outline" onClick={() => void reload()} disabled={loading}>
          <RefreshCw size={16} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          새로고침
        </Button>
      </header>

      <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
        {FILTER_OPTIONS.map((opt) => {
          const count = counts.get(opt.value) ?? 0;
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                active ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
              }`}
            >
              {opt.label}
              <span
                className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-violet-100 bg-white p-12 flex items-center justify-center">
          <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-violet-100 bg-white p-12 text-center text-sm text-slate-500">
          공유 링크가 없어요.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((link) => {
            const url = buildLink(link.path, link.token);
            const tone = statusTone(link.status);
            const isCopied = copiedId === link.id;
            return (
              <article
                key={link.id}
                className="group relative rounded-2xl border border-violet-100 bg-white px-4 py-3 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex items-center gap-3"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-3 bottom-3 w-1 rounded-r"
                  style={{ backgroundColor: CATEGORY_COLOR[link.category] }}
                />

                <div className="pl-2 flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span aria-hidden="true">{CATEGORY_EMOJI[link.category]}</span>
                    <span className="text-sm font-semibold text-[#1E1B4B] truncate">{link.label}</span>
                    {link.status && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
                        {link.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    {link.subLabel && <span className="truncate">{link.subLabel}</span>}
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400 font-mono truncate">
                      {link.path}/{link.token.slice(0, 8)}…
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>{formatDateKo(link.createdAt)}</span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="새 탭에서 열기"
                    className="rounded-lg p-2 text-slate-400 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                  >
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopy(link)}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      isCopied
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} aria-hidden="true" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden="true" />
                        링크 복사
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
