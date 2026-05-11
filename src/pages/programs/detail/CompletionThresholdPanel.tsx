// bal24 v2 — STEP-TAB-RESTRUCTURE-B PART D
// 수료 기준 출석률 동적 설정 패널 (programs.completion_threshold)

import { useEffect, useState } from 'react';
import { Loader2, Save, Award } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

interface Props { programId: string }

export default function CompletionThresholdPanel({ programId }: Props) {
  const toast = useToast();
  const [value, setValue] = useState<number>(80);
  const [baseline, setBaseline] = useState<number>(80);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase.from('programs')
        .select('completion_threshold').eq('id', programId).maybeSingle();
      if (cancelled) return;
      if (error) {
        const raw = (error.message ?? '').toLowerCase();
        if (raw.includes('column') && raw.includes('does not exist')) {
          toast.error('completion_threshold 컬럼이 적용되지 않았어요. Supabase 마이그레이션 실행 필요.');
        } else {
          console.error('[completion-threshold] 조회 실패:', error.message);
          toast.error('수료 기준을 불러오지 못했어요.');
        }
        setLoading(false); return;
      }
      const v = data?.completion_threshold ?? 80;
      setValue(v); setBaseline(v);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, toast]);

  async function handleSave() {
    if (value < 0 || value > 100) { toast.error('0 ~ 100 사이의 값을 입력해 주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('programs')
      .update({ completion_threshold: value }).eq('id', programId);
    setSaving(false);
    if (error) {
      console.error('[completion-threshold] 저장 실패:', error.message);
      toast.error('수료 기준 저장에 실패했어요.'); return;
    }
    setBaseline(value);
    toast.success(`수료 기준을 ${value}%로 저장했어요.`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" />
        수료 기준을 불러오는 중…
      </div>
    );
  }

  const dirty = value !== baseline;

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-4 max-w-xl">
      <header className="flex items-center gap-2">
        <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100 text-violet-600">
          <Award size={16} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold text-[#1E1B4B]">수료 기준 출석률</p>
          <p className="text-[11px] text-slate-500">이 값 이상 출석 시 자동으로 수료 처리·수료증 발급 후보가 돼요.</p>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <label htmlFor="completion-threshold" className="text-sm font-semibold text-slate-700 w-28">
          기준
        </label>
        <div className="flex items-center gap-2">
          <input id="completion-threshold" type="number" min={0} max={100} step={5}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-20 h-9 border border-slate-200 rounded-lg px-2 text-sm text-center tabular-nums focus:outline-none focus:border-violet-400" />
          <span className="text-sm text-slate-500">% 이상 출석 시 수료</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-violet-100">
        <p className="text-[11px] text-slate-400">
          {dirty ? `현재 저장값 ${baseline}% → ${value}%로 변경 예정` : `현재 저장값: ${baseline}%`}
        </p>
        <button type="button" onClick={() => void handleSave()} disabled={!dirty || saving}
          className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
          {saving ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Save size={11} aria-hidden="true" />}
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </section>
  );
}
