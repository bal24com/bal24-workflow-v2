// 강사 포털 · 일정 4단계 섹션 — 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN PART E (2026-05-28)
// pre_recruit (모집·홍보) / pre_prepare (교육 전 안내) / running (교육 중) / post (교육 후)
// program_schedule_items 조회. 강사 포털은 읽기 전용. 항목 0개여도 단계 박스 표시.

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';

type Stage = 'pre_recruit' | 'pre_prepare' | 'running' | 'post';

interface ScheduleItem {
  id: string;
  stage: Stage;
  item_date: string;
  title: string;
  description: string | null;
  display_order: number;
}

interface Props {
  programId: string;
}

const STAGES: Array<{ key: Stage; label: string; desc: string; icon: string; border: string; bg: string; head: string }> = [
  { key: 'pre_recruit', label: '사전', desc: '모집·홍보',    icon: '🔔', border: 'border-blue-200',    bg: 'bg-blue-50/40',    head: 'text-blue-700'   },
  { key: 'pre_prepare', label: '준비', desc: '교육 전 안내', icon: '📋', border: 'border-amber-200',   bg: 'bg-amber-50/40',   head: 'text-amber-700'  },
  { key: 'running',     label: '진행', desc: '교육 중',      icon: '🏃', border: 'border-violet-200',  bg: 'bg-violet-50/40',  head: 'text-violet-700' },
  { key: 'post',        label: '결과', desc: '교육 후',      icon: '📊', border: 'border-emerald-200', bg: 'bg-emerald-50/40', head: 'text-emerald-700'},
];

export default function ScheduleStagesSection({ programId }: Props) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('program_schedule_items')
      .select('id, stage, item_date, title, description, display_order')
      .eq('program_id', programId)
      .order('stage', { ascending: true })
      .order('item_date', { ascending: true })
      .order('display_order', { ascending: true });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('relation') || msg.includes('does not exist') || error.code === 'PGRST205') {
        setTableMissing(true); setItems([]); return;
      }
      console.error('[ScheduleStages] 조회 실패:', error.message);
      setItems([]); return;
    }
    setItems((data ?? []) as ScheduleItem[]);
  }, [programId]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  if (tableMissing) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
        <p className="text-xs text-amber-700">⚠ program_schedule_items 테이블이 없어요. 박경수님 환경에서 STEP-STAFF-PORTAL-REDESIGN SQL 을 실행해 주세요.</p>
      </section>
    );
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-violet-400" /></div>;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1E1B4B]">일정 (4단계)</h2>
        <span className="text-[11px] text-slate-400">PM 이 등록한 일정 (읽기 전용)</span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {STAGES.map((s) => {
          const stageItems = items.filter((it) => it.stage === s.key);
          return (
            <div key={s.key} className={`rounded-2xl border ${s.border} ${s.bg} p-4`}>
              <h3 className={`font-bold text-sm mb-3 ${s.head}`}>
                {s.icon} {s.label} <span className="text-[11px] text-slate-400 font-normal">({s.desc})</span>
                <span className="text-[11px] text-slate-400 font-normal ml-1">· {stageItems.length}건</span>
              </h3>
              {stageItems.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-2">등록된 일정이 없어요.</p>
              ) : (
                <ul className="space-y-1.5">
                  {stageItems.map((it) => (
                    <li key={it.id} className="flex items-start gap-2 py-0.5">
                      <span className="text-slate-300 text-xs mt-0.5">●</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">{formatDateKo(it.item_date)}</span>
                          <span className="text-sm font-semibold text-slate-800 truncate">{it.title}</span>
                        </div>
                        {it.description && <p className="text-[11px] text-slate-500 mt-0.5">{it.description}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
