// bal24 v2 — 멘토 외부 페이지 (STEP-MENTORING)
// /mentoring-mentor/:token — 토큰으로 본인 배정 fetch + 보고서 작성·목록 + 원천징수 1회 변경.
// NOTE: 기존 /log/:token (LogWritePage) 의 mentoring 분기는 deprecated.
//       신규 일지는 이 페이지 사용. 기존 activity_logs 데이터는 보존.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Lock, Plus, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui';
import { formatDateKo } from '../../lib/utils';
import {
  fetchAssignmentByMentorToken, downloadSessionAsWord, countCompletedSessions,
} from '../programs/detail/mentoringUtils';
import {
  calcMentoringPay, getMentorName, formatDuration,
} from '../../types/mentoring';
import type {
  MentoringAssignment, MentoringSession, MentoringTaxType,
} from '../../types/mentoring';
import MentoringSessionModal from '../programs/detail/MentoringSessionModal';

const TAX_OPTIONS: MentoringTaxType[] = ['3.3%', '8.8%', '면세'];

export default function MentoringMentorPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [assignment, setAssignment] = useState<MentoringAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [taxEdit, setTaxEdit] = useState(false);
  const [taxDraft, setTaxDraft] = useState<MentoringTaxType>('3.3%');
  const [taxSaving, setTaxSaving] = useState(false);
  const [sessionTarget, setSessionTarget] = useState<MentoringSession | null | 'new'>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    const data = await fetchAssignmentByMentorToken(token);
    setAssignment(data);
    if (data) setTaxDraft(data.tax_type);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [reload]);

  async function handleSaveTax() {
    if (!assignment) return;
    setTaxSaving(true);
    try {
      const { error } = await supabase
        .from('mentoring_assignments')
        .update({ tax_type: taxDraft, tax_type_locked: true, updated_at: new Date().toISOString() })
        .eq('id', assignment.id);
      if (error) {
        console.error('[mentoring] 원천징수 변경 실패:', error.message);
        toast.error('원천징수 변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      toast.success('원천징수를 저장했어요. 이후 변경은 PM 에게 요청해 주세요.');
      setTaxEdit(false);
      await reload();
    } finally {
      setTaxSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-rose-100 p-8 max-w-md w-full text-center space-y-3">
          <ShieldAlert className="mx-auto text-rose-400" size={32} aria-hidden="true" />
          <p className="text-base font-bold text-[#1E1B4B]">유효하지 않은 링크예요</p>
          <p className="text-sm text-slate-500">링크를 다시 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  const mentorName = getMentorName(assignment);
  const completed = countCompletedSessions(assignment.sessions);
  const planned = assignment.session_count ?? 0;
  const pay = calcMentoringPay(assignment, completed);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 px-4 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">멘토 보고서</p>
          <h1 className="mt-1 text-xl font-bold text-[#1E1B4B]">{mentorName} 멘토님</h1>
          <p className="mt-1 text-xs text-slate-500">
            {assignment.meet_type ?? '-'} · {assignment.pay_type ?? '-'} · 계획 {planned}회
          </p>
        </header>

        {/* 원천징수 */}
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
          <h2 className="text-sm font-bold text-[#1E1B4B]">원천징수</h2>
          {!taxEdit ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-700">
                현재: <span className="font-bold text-violet-700">{assignment.tax_type}</span>
                {assignment.tax_type === '3.3%' && ' · 사업소득'}
                {assignment.tax_type === '8.8%' && ' · 기타소득'}
              </p>
              {assignment.tax_type_locked ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Lock size={11} aria-hidden="true" />
                  변경 완료
                </span>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setTaxEdit(true)}>변경하기</Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {TAX_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTaxDraft(t)}
                    disabled={taxSaving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      taxDraft === t
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t === '3.3%' ? '3.3% 사업소득' : t === '8.8%' ? '8.8% 기타소득' : '면세'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 italic">
                ⚠️ 변경은 1회만 가능해요. 이후에는 PM 에게 변경 요청을 해주세요.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setTaxEdit(false)} disabled={taxSaving}>취소</Button>
                <Button variant="primary" size="sm" onClick={() => void handleSaveTax()} loading={taxSaving}>저장</Button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-violet-50/60 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>계획·완료 회수</span>
              <span className="tabular-nums">{planned}회 · 완료 {completed}회</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>예상 지급액</span>
              <span className="tabular-nums">{pay.base.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>원천징수 ({assignment.tax_type})</span>
              <span className="tabular-nums">-{pay.deduction.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between border-t border-violet-200 pt-1 font-bold text-violet-700">
              <span>예상 수령액</span>
              <span className="tabular-nums">{pay.net.toLocaleString()}원</span>
            </div>
          </div>
        </section>

        {/* 보고서 목록 */}
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#1E1B4B]">내가 작성한 보고서 ({assignment.sessions?.length ?? 0})</h2>
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setSessionTarget('new')}>
              보고서 작성
            </Button>
          </div>
          {!assignment.sessions || assignment.sessions.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">
              아직 작성된 보고서가 없어요. 첫 보고서를 작성해 보세요.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {[...assignment.sessions].sort((a, b) => b.session_date.localeCompare(a.session_date)).map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setSessionTarget(s)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-bold text-[#1E1B4B] truncate">{s.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                      {formatDateKo(s.session_date)} · {formatDuration(s.duration_min)} · {s.meet_type ?? '-'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSessionAsWord(s, mentorName)}
                    className="shrink-0 text-[10px] font-semibold text-violet-700 hover:underline"
                  >
                    Word
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-[10px] text-slate-400">© 2026 (주)밸런스닷 · WorkFlow</p>
      </div>

      {sessionTarget !== null && (
        <MentoringSessionModal
          open={true}
          assignmentId={assignment.id}
          mentorName={mentorName}
          session={sessionTarget === 'new' ? null : sessionTarget}
          onClose={() => setSessionTarget(null)}
          onSaved={() => { void reload(); setSessionTarget(null); }}
        />
      )}
    </div>
  );
}
