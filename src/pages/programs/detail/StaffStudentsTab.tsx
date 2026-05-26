// bal24 v2 — STEP-STAFF-ASSIGNMENT-FEE
// 강사 배정 탭 (강사 활동 현황) — instructor_invitations + curriculum_staff UNION.
// 강사료 계산 + 차시별 완료 체크 + 지출 등록 연동.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Mic2, ExternalLink, Send, ChevronDown, ChevronUp,
  Receipt, AlertCircle, Link2,
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/utils';
import { BADGE_BASE, INVITATION_STATUS_STYLE } from '../../../utils/statusStyles';
import StaffCurriculumChecklist from './StaffCurriculumChecklist';
import {
  fetchStaffActivity, type StaffActivity,
} from './staffActivityUtils';
import { markStaffFeeAsPaid } from './staffFeeUtils';

interface Props { programId: string }

export default function StaffStudentsTab({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [list, setList] = useState<StaffActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // STEP-STAFF-TOKEN-SIMPLIFY — 포털 링크 복사 진행 중인 강사 key
  const [copyBusyKey, setCopyBusyKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const rows = await fetchStaffActivity(programId);
    setList(rows);
    setLoading(false);
  }, [programId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function keyOf(s: StaffActivity): string {
    return `${s.staff_pool_id ?? ''}|${s.profile_id ?? ''}|${s.instructor_name_raw ?? ''}`;
  }

  function openPortal(s: StaffActivity) {
    if (s.staffPortalToken) {
      window.open(`${window.location.origin}/staff-portal/${s.staffPortalToken}`, '_blank', 'noopener');
      return;
    }
    if (s.mentorInviteToken) {
      window.open(`${window.location.origin}/mentor-invite/${s.mentorInviteToken}`, '_blank', 'noopener');
      return;
    }
    toast.error('포털 토큰이 없어요. 강사가 인력풀에 등록되어 있는지 확인해 주세요.');
  }

  // STEP-STAFF-TOKEN-SIMPLIFY — 포털 영구 링크 클립보드 복사 (PIN 제거).
  //  · staff_pool 강사: staff_portal_token 조회 → 없으면 자동 생성.
  //  · profile 강사: 이미 fetch 된 staffPortalToken 사용.
  async function handleCopyPortalLink(s: StaffActivity) {
    setCopyBusyKey(keyOf(s));
    try {
      let token = s.staffPortalToken;
      if (!token && s.staff_pool_id) {
        // staff_pool 에서 staff_portal_token 조회. NULL 이면 새 UUID 발급 후 저장.
        const { data, error } = await supabase
          .from('staff_pool')
          .select('staff_portal_token')
          .eq('id', s.staff_pool_id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        token = data?.staff_portal_token ?? null;
        if (!token) {
          const newToken = crypto.randomUUID();
          const { error: upErr } = await supabase
            .from('staff_pool')
            .update({ staff_portal_token: newToken })
            .eq('id', s.staff_pool_id);
          if (upErr) throw new Error(upErr.message);
          token = newToken;
        }
      }
      if (!token) {
        toast.error('포털 토큰이 없어요. 강사가 인력풀에 등록되어 있는지 확인해 주세요.');
        return;
      }
      const link = `${window.location.origin}/staff-portal/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success(`${s.name}님 포털 링크가 복사됐어요.`);
      void fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[StaffStudentsTab] 포털 링크 복사 오류:', msg);
      toast.error('링크 복사 중 오류가 발생했어요.');
    } finally {
      setCopyBusyKey(null);
    }
  }

  // STEP-STAFF-ASSIGNMENT-FEE — 완료 차시 강사료를 지출로 등록 (program_staff_fees 경유)
  async function handleRegisterExpense(s: StaffActivity) {
    if (!s.feeRule) {
      toast.error(`${s.name}님의 강사료 기준이 없어요. [강사료] 탭에서 먼저 등록해 주세요.`);
      return;
    }
    if (s.completedCount === 0) {
      toast.error('완료 처리된 차시가 없어요. 차시 체크 후 다시 시도해 주세요.');
      return;
    }
    if (s.feeRule.expense_id) {
      toast.error('이미 지출로 등록된 강사료예요. [강사료] 탭에서 상세 확인이 가능해요.');
      return;
    }
    setBusyKey(keyOf(s));
    const result = await markStaffFeeAsPaid(s.feeRule, user?.id ?? null);
    setBusyKey(null);
    if (!result.success) {
      toast.error(result.error ?? '지출 등록에 실패했어요.');
      return;
    }
    toast.success(`${s.name}님 강사료가 지출 항목에 등록됐어요.`);
    void fetchData();
  }

  const totalCount = list.length;
  const totalCompletedSessions = useMemo(
    () => list.reduce((sum, s) => sum + s.completedCount, 0), [list]);
  const totalGross = useMemo(
    () => list.reduce((sum, s) => sum + s.calcGross, 0), [list]);

  if (loading) {
    return (
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Mic2 size={16} className="text-violet-500" aria-hidden="true" />
          강사 활동 현황 ({totalCount}명)
        </h3>
        {list.length > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>완료 차시 <strong className="text-emerald-700 tabular-nums">{totalCompletedSessions}</strong></span>
            <span>강사료 합 <strong className="text-violet-700 tabular-nums">{formatMoney(totalGross)}</strong></span>
          </div>
        )}
      </header>

      {list.length === 0 ? (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">아직 강사가 없어요.</p>
            <p className="mt-1 text-amber-700">
              커리큘럼 탭에서 차시별 강사를 등록하거나 강사 초빙을 보내면 여기에 표시돼요.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => {
            const k = keyOf(s);
            const expanded = expandedKey === k;
            const unregistered = !s.staff_pool_id && !s.profile_id;
            const feeMissing = !s.feeRule;
            const feeRegistered = !!s.feeRule?.expense_id;
            // STEP-STAFF-PIN-RESET 보강 — 팀원(profile) 강사는 회색 배경으로 그룹 시각 구분
            const isTeamMember = !!s.profile_id && !s.staff_pool_id;
            return (
              <li key={k} className={`rounded-xl border overflow-hidden ${
                isTeamMember
                  ? 'border-slate-200 bg-slate-50/60'
                  : 'border-violet-100 bg-violet-50/30'
              }`}>
                {/* 강사 요약 행 */}
                <div className="flex items-center gap-3 p-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">{s.name}</span>
                      {s.organization && (
                        <span className="text-[11px] text-slate-500">· {s.organization}</span>
                      )}
                      {unregistered && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1">미등록</span>
                      )}
                      {isTeamMember && (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded px-1">팀원</span>
                      )}
                      {s.invitationStatus && (
                        <span className={`${BADGE_BASE} ${INVITATION_STATUS_STYLE[s.invitationStatus]}`}>
                          {s.invitationStatus}
                        </span>
                      )}
                      {/* STEP-STAFF-TOKEN-SIMPLIFY — PIN 배지 제거. 토큰 단일화 후 PIN 개념 사라짐. */}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap tabular-nums">
                      <span>담당 <strong className="text-slate-700">{s.curriculums.length}</strong>차시</span>
                      <span>· 완료 <strong className="text-emerald-700">{s.completedCount}</strong>차시</span>
                      <span>· 멘토링 일지 <strong>{s.mentoringLogCount}</strong>건</span>
                    </p>
                  </div>

                  {/* 강사료 요약 */}
                  <div className="text-right min-w-[140px]">
                    {feeMissing ? (
                      <p className="text-[11px] text-slate-400 italic">강사료 미등록</p>
                    ) : (
                      <>
                        <p className="text-xs font-bold tabular-nums text-violet-700">
                          {formatMoney(s.calcGross)}
                        </p>
                        <p className="text-[10px] text-slate-500 tabular-nums">
                          {s.feeRule?.tax_type === '면세' ? '면세' : `${s.feeRule?.tax_type}% 원천`} {formatMoney(s.calcTax)}
                          {' · 실수령 '}{formatMoney(s.calcNet)}
                        </p>
                        {feeRegistered && (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">지출 등록 완료</p>
                        )}
                      </>
                    )}
                  </div>

                  {/* 액션 */}
                  <div className="flex items-center gap-1">
                    <button type="button"
                      disabled={busyKey === k || feeMissing || feeRegistered || s.completedCount === 0}
                      onClick={() => void handleRegisterExpense(s)}
                      title={feeMissing ? '강사료 기준이 필요해요'
                        : feeRegistered ? '이미 등록됨'
                        : s.completedCount === 0 ? '완료된 차시가 없어요'
                        : '완료 차시 기준으로 지출 등록'}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed">
                      {busyKey === k
                        ? <Loader2 size={11} className="animate-spin" />
                        : <Receipt size={11} aria-hidden="true" />}
                      지출 등록
                    </button>
                    <button type="button" onClick={() => openPortal(s)}
                      title={s.staffPortalToken ? '강사 포털 열기' : s.mentorInviteToken ? '멘토 초대' : '토큰 없음'}
                      disabled={!s.staffPortalToken && !s.mentorInviteToken}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-violet-700 border border-violet-200 hover:bg-violet-50 disabled:opacity-40">
                      {s.staffPortalToken ? <ExternalLink size={11} aria-hidden="true" /> : <Send size={11} aria-hidden="true" />}
                    </button>
                    {/* STEP-STAFF-TOKEN-SIMPLIFY — 포털 링크 복사 (PIN 제거 후 핵심 액션).
                        staff_pool 강사는 토큰 없으면 즉석에서 자동 발급. */}
                    {s.staff_pool_id && (
                      <button type="button"
                        onClick={() => void handleCopyPortalLink(s)}
                        disabled={copyBusyKey === k}
                        title="강사 포털 링크 복사 — 강사에게 전달하면 PIN 없이 바로 접속 가능"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-colors disabled:opacity-50">
                        {copyBusyKey === k
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Link2 size={11} aria-hidden="true" />}
                      </button>
                    )}
                    <button type="button"
                      onClick={() => setExpandedKey(expanded ? null : k)}
                      aria-label={expanded ? '접기' : '펼치기'}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-violet-50 hover:text-violet-700">
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* 차시 체크리스트 (펼침 시) */}
                {expanded && (
                  <div className="border-t border-violet-100 bg-white px-3 py-2">
                    <StaffCurriculumChecklist
                      staff={s}
                      allStaff={list}
                      onChanged={() => void fetchData()}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 강사료 미등록 안내 */}
      {list.some((s) => !s.feeRule) && (
        <p className="text-[11px] text-slate-500">
          💡 강사료 기준이 없는 강사는 [강사료] 탭에서 단가·세율을 먼저 등록해 주세요.
          <Link to="#" onClick={(e) => { e.preventDefault(); /* SubToggle 외부 트리거 불가 */ }}
            className="ml-1 text-violet-600 hover:underline">강사료 탭으로 →</Link>
        </p>
      )}
    </section>
  );
}
