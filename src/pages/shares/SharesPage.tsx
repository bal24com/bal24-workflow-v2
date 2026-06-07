// bal24 v2 — 공유 링크 통합 뷰 (STEP 19)
// 7종 외부 토큰 (강사 초대 / 출석 / 고객 포털 / 외부 폼 / 컨소시엄 / 역할별 / 동아리) 통합 관리

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchAllLinks,
  CATEGORY_LABEL,
  type LinkCategory,
  type SharedLink,
} from './sharesUtils';
import ShareLinkCard from '../../components/shares/ShareLinkCard';

type FilterValue = LinkCategory | 'ALL';

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'invitation', label: CATEGORY_LABEL.invitation },
  { value: 'attendance', label: CATEGORY_LABEL.attendance },
  { value: 'portal', label: CATEGORY_LABEL.portal },
  { value: 'form', label: CATEGORY_LABEL.form },
  { value: 'consortium', label: CATEGORY_LABEL.consortium },
  { value: 'program_share', label: CATEGORY_LABEL.program_share },
  { value: 'club', label: CATEGORY_LABEL.club },
];

export default function SharesPage() {
  const toast = useToast();
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>('ALL');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchAllLinks();
      setLinks(list);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[shares] 통합 조회 실패:', raw);
      toast.error('링크 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleToggle = async (link: SharedLink) => {
    let table = '';
    let column = 'is_active';
    const idValue = link.id.split('-')[1];
    let nextValue = false;

    switch (link.category) {
      case 'attendance':
        table = 'attendance_sessions';
        column = 'check_in_open';
        nextValue = link.status !== '열림';
        break;
      case 'portal':
        table = 'project_portals';
        nextValue = link.status !== '활성';
        break;
      case 'form':
        table = 'public_forms';
        nextValue = link.status !== '활성';
        break;
      case 'consortium':
        table = 'consortium_links';
        nextValue = link.status !== '활성';
        break;
      default:
        toast.info('이 카테고리는 직접 활성화 상태를 변경할 수 없습니다.');
        return;
    }

    try {
      const { error } = await supabase
        .from(table)
        .update({ [column]: nextValue })
        .eq('id', idValue);

      if (error) throw error;

      toast.success(`${link.label} 상태가 변경되었습니다.`);
      
      // 로컬 상태 업데이트
      setLinks(prev => prev.map(l => {
        if (l.id === link.id) {
          return {
            ...l,
            status: link.category === 'attendance' 
              ? (nextValue ? '열림' : '닫힘')
              : (nextValue ? '활성' : '비활성')
          };
        }
        return l;
      }));
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error(`[shares] ${link.category} 토글 실패:`, raw);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

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

  return (
    <div className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <span aria-hidden="true">🔗</span>
          공유 링크 관리
        </h1>
        <Button variant="outline" onClick={() => void reload()} disabled={loading}>
          <RefreshCw size={16} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          새로고침
        </Button>
      </header>

      <div className="inline-flex flex-wrap gap-1.5 rounded-xl border border-violet-100 bg-white p-1 shadow-sm overflow-x-auto max-w-full no-scrollbar">
        {FILTER_OPTIONS.map((opt) => {
          const count = counts.get(opt.value) ?? 0;
          if (opt.value !== 'ALL' && count === 0) return null;
          const active = filter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition whitespace-nowrap ${
                active ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-violet-50'
              }`}
            >
              {opt.label}
              <span
                className={`min-w-[18px] rounded-full px-1 py-0.5 text-[10px] font-black ${
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
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">조회된 공유 링크가 없어요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((link) => (
            <ShareLinkCard 
              key={link.id} 
              link={link} 
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

…
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
