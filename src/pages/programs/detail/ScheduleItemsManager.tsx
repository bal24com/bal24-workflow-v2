// 프로그램 일정 4단계 관리 — 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN PART E (PM, 2026-05-28)
// PM 이 program_schedule_items 를 4단계 (pre_recruit/pre_prepare/running/post) 별로 CRUD.
// 강사 포털의 [일정] 탭 4단계 섹션 (ScheduleStagesSection) 과 짝.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, X, Save, CalendarDays } from 'lucide-react';
import { Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';

type Stage = 'pre_recruit' | 'pre_prepare' | 'running' | 'post';

interface ScheduleItem {
  id: string;
  program_id: string;
  stage: Stage;
  item_date: string;
  title: string;
  description: string | null;
  display_order: number;
}

interface DraftItem {
  id?: string;
  stage: Stage;
  item_date: string;
  title: string;
  description: string;
}

const STAGES: Array<{ key: Stage; label: string; desc: string; icon: string; border: string; bg: string; head: string }> = [
  { key: 'pre_recruit', label: '사전', desc: '모집·홍보',    icon: '🔔', border: 'border-blue-200',    bg: 'bg-blue-50/40',    head: 'text-blue-700'   },
  { key: 'pre_prepare', label: '준비', desc: '교육 전 안내', icon: '📋', border: 'border-amber-200',   bg: 'bg-amber-50/40',   head: 'text-amber-700'  },
  { key: 'running',     label: '진행', desc: '교육 중',      icon: '🏃', border: 'border-violet-200',  bg: 'bg-violet-50/40',  head: 'text-violet-700' },
  { key: 'post',        label: '결과', desc: '교육 후',      icon: '📊', border: 'border-emerald-200', bg: 'bg-emerald-50/40', head: 'text-emerald-700'},
];

interface Props { programId: string }

export default function ScheduleItemsManager({ programId }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftItem | null>(null); // 추가/수정 폼 (한 번에 1개)
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('program_schedule_items')
      .select('id, program_id, stage, item_date, title, description, display_order')
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
      console.error('[ScheduleItemsManager] 조회 실패:', error.message);
      toast.error('일정 목록을 불러오지 못했어요.'); return;
    }
    setItems((data ?? []) as ScheduleItem[]);
  }, [programId, toast]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  function openAddFor(stage: Stage) {
    setDraft({ stage, item_date: new Date().toISOString().slice(0, 10), title: '', description: '' });
  }
  function openEdit(it: ScheduleItem) {
    setDraft({ id: it.id, stage: it.stage, item_date: it.item_date, title: it.title, description: it.description ?? '' });
  }

  async function handleSave() {
    if (!draft) return;
    if (!draft.title.trim()) { toast.error('제목을 입력해 주세요.'); return; }
    if (!draft.item_date) { toast.error('날짜를 선택해 주세요.'); return; }
    setSaving(true);
    const payload = {
      program_id: programId, stage: draft.stage, item_date: draft.item_date,
      title: draft.title.trim(), description: draft.description.trim() || null,
    };
    const res = draft.id
      ? await supabase.from('program_schedule_items').update(payload).eq('id', draft.id)
      : await supabase.from('program_schedule_items').insert(payload);
    setSaving(false);
    if (res.error) { console.error('[ScheduleItemsManager] 저장 실패:', res.error.message); toast.error(`저장 실패: ${res.error.message}`); return; }
    toast.success(draft.id ? '일정을 수정했어요.' : '일정을 추가했어요.');
    setDraft(null); void fetchItems();
  }

  async function handleDelete(it: ScheduleItem) {
    if (!window.confirm(`"${it.title}" 일정을 삭제할까요?`)) return;
    setDeletingId(it.id);
    const { error } = await supabase.from('program_schedule_items').delete().eq('id', it.id);
    setDeletingId(null);
    if (error) { toast.error(`삭제 실패: ${error.message}`); return; }
    toast.success('일정을 삭제했어요.');
    void fetchItems();
  }

  if (tableMissing) {
    return <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      ⚠ program_schedule_items 테이블이 없어요. supabase/migrations/20260528_staff_portal_upgrade.sql 을 실행해 주세요.
    </p>;
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-violet-400" /></div>;

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-2">
          <CalendarDays size={14} className="text-violet-500" aria-hidden="true" />
          일정 단계 (사전·준비·진행·결과)
        </h3>
        <span className="text-[11px] text-slate-400">강사 포털 [일정] 탭에 자동 노출</span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {STAGES.map((s) => {
          const stageItems = items.filter((it) => it.stage === s.key);
          return (
            <div key={s.key} className={`rounded-2xl border ${s.border} ${s.bg} p-4`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`font-bold text-sm ${s.head}`}>
                  {s.icon} {s.label} <span className="text-[11px] text-slate-400 font-normal">({s.desc})</span>
                  <span className="text-[11px] text-slate-400 font-normal ml-1">· {stageItems.length}건</span>
                </h4>
                <Button size="sm" variant="outline" leftIcon={<Plus size={12} />} onClick={() => openAddFor(s.key)}>추가</Button>
              </div>
              {stageItems.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-2">등록된 일정이 없어요.</p>
              ) : (
                <ul className="space-y-1.5">
                  {stageItems.map((it) => (
                    <li key={it.id} className="flex items-start gap-2 py-0.5 group">
                      <span className="text-slate-300 text-xs mt-0.5">●</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">{formatDateKo(it.item_date)}</span>
                          <span className="text-sm font-semibold text-slate-800">{it.title}</span>
                        </div>
                        {it.description && <p className="text-[11px] text-slate-500 mt-0.5">{it.description}</p>}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        <button type="button" onClick={() => openEdit(it)} aria-label="수정" className="text-violet-500 hover:text-violet-700"><Pencil size={11} /></button>
                        <button type="button" onClick={() => void handleDelete(it)} disabled={deletingId === it.id} aria-label="삭제" className="text-rose-500 hover:text-rose-700 disabled:opacity-40"><Trash2 size={11} /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* 추가/수정 폼 (인라인) */}
      {draft && (
        <div className="rounded-2xl border-2 border-violet-300 bg-violet-50/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-violet-700">{draft.id ? '일정 수정' : '일정 추가'} — {STAGES.find((s) => s.key === draft.stage)?.label}</p>
            <button type="button" onClick={() => setDraft(null)} aria-label="닫기" className="text-slate-400 hover:text-slate-700"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="text-slate-600 font-semibold mb-1 block">단계</span>
              <select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as Stage })}
                className="w-full h-9 rounded-md border border-slate-200 px-2 text-sm">
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.icon} {s.label} ({s.desc})</option>)}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-slate-600 font-semibold mb-1 block">날짜</span>
              <Input type="date" value={draft.item_date} onChange={(e) => setDraft({ ...draft, item_date: e.target.value })} />
            </label>
            <div className="sm:col-span-2">
              <Input label="제목" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="예: 교육생 모집 시작 / 강사 사전 안내" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs">
                <span className="text-slate-600 font-semibold mb-1 block">설명 (선택)</span>
                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2}
                  className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-none" />
              </label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>취소</Button>
            <Button variant="primary" leftIcon={saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} loading={saving} onClick={() => void handleSave()}>저장</Button>
          </div>
        </div>
      )}
    </section>
  );
}
