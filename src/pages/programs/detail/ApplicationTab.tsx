// bal24 v2 — STEP-APPLICATION-MGMT PM 측 신청자 관리 탭
// 필터 + 일괄 선택/처리 + 단건 상태 변경 + 상세 모달 + 평가 점수 컬럼(평가형).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, CheckCircle2, XCircle, Clock, Trophy, Users2, UserPlus, Mail,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import {
  fetchApplications, updateApplicationStatus, bulkUpdateStatus, fetchAvgScores,
  PARTICIPANT_STATUS_LABELS, PARTICIPANT_STATUS_TONE,
} from './applicationMgmtUtils';
import ApplicationDetailModal from '../../applications/ApplicationDetailModal';
import type {
  ParticipantApplication, ParticipantStatus,
} from '../../../types/application';

interface Props {
  programId: string;
}

type FilterTab = 'all' | ParticipantStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: '전체' },
  { key: 'applied',   label: PARTICIPANT_STATUS_LABELS.applied },
  { key: 'reviewing', label: PARTICIPANT_STATUS_LABELS.reviewing },
  { key: 'accepted',  label: PARTICIPANT_STATUS_LABELS.accepted },
  { key: 'rejected',  label: PARTICIPANT_STATUS_LABELS.rejected },
  { key: 'withdrawn', label: PARTICIPANT_STATUS_LABELS.withdrawn },
  { key: 'completed', label: PARTICIPANT_STATUS_LABELS.completed },
];

export default function ApplicationTab({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<ParticipantApplication[]>([]);
  const [scores, setScores] = useState<Map<string, { avg: number; count: number }>>(new Map());
  const [isEvaluation, setIsEvaluation] = useState(false);
  const [maxApplicants, setMaxApplicants] = useState<number | null>(null);
  // STEP-MEMBER-INVITE-REPORT — 합격자 MEMBER 초대 상태 관리
  const [invitedEmails, setInvitedEmails] = useState<Set<string>>(new Set());
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ParticipantApplication | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    // 1) 프로그램 application_type + max_applicants 확인
    const { data: prog } = await supabase
      .from('programs').select('application_type, max_applicants').eq('id', programId).maybeSingle();
    setIsEvaluation((prog?.application_type ?? 'open') === 'evaluation');
    setMaxApplicants((prog?.max_applicants as number | null | undefined) ?? null);
    // 2) 신청자 + (평가형이면) 점수
    const list = await fetchApplications(programId);
    setItems(list);
    if ((prog?.application_type ?? 'open') === 'evaluation') {
      const map = await fetchAvgScores(list.map((a) => a.id));
      setScores(map);
    } else {
      setScores(new Map());
    }
    // STEP-MEMBER-INVITE-REPORT — 합격자 이메일로 member_invitations 일괄 조회
    const acceptedEmails = list
      .filter((a) => a.status === 'accepted' && !!a.email)
      .map((a) => (a.email as string).toLowerCase());
    if (acceptedEmails.length > 0) {
      const { data: invs, error: invErr } = await supabase
        .from('member_invitations')
        .select('email')
        .in('email', acceptedEmails)
        .is('deleted_at', null);
      if (invErr) console.error('[member-invite] 초대 목록 조회 실패:', invErr.message);
      setInvitedEmails(new Set(((invs ?? []) as { email: string }[]).map((r) => r.email.toLowerCase())));
    } else {
      setInvitedEmails(new Set());
    }
    setSelectedIds(new Set());
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const counts = useMemo(() => {
    const acc: Record<FilterTab, number> = {
      all: items.length, applied: 0, reviewing: 0, accepted: 0, rejected: 0, withdrawn: 0, completed: 0,
    };
    items.forEach((a) => { acc[a.status] += 1; });
    return acc;
  }, [items]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((a) => a.status === filter);
  }, [items, filter]);

  const allChecked = visible.length > 0 && visible.every((a) => selectedIds.has(a.id));
  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visible.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visible.forEach((a) => next.add(a.id));
        return next;
      });
    }
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // STEP-MEMBER-INVITE-REPORT — 합격자 MEMBER 초대
  async function inviteAsMember(app: ParticipantApplication) {
    if (!app.email) {
      toast.error('신청 시 이메일이 입력되지 않아 초대할 수 없어요.');
      return;
    }
    const email = app.email.trim().toLowerCase();
    setInvitingId(app.id);
    try {
      // 1) 중복 확인
      const { data: existing, error: existErr } = await supabase
        .from('member_invitations')
        .select('id, status')
        .eq('email', email)
        .is('deleted_at', null)
        .maybeSingle();
      if (existErr) {
        console.error('[member-invite] 중복 확인 실패:', existErr.message);
        toast.error('초대 확인 중 오류가 발생했어요.');
        return;
      }
      if (existing) {
        toast.error('이미 초대가 발송된 이메일이에요.');
        setInvitedEmails((p) => new Set(p).add(email));
        return;
      }
      // 2) member_invitations INSERT
      const { data: inv, error: invErr } = await supabase
        .from('member_invitations')
        .insert({
          email,
          role: 'member',
          invited_by: user?.id ?? null,
        })
        .select('id, token')
        .single();
      if (invErr || !inv) {
        const m = invErr?.message?.toLowerCase() ?? '';
        console.error('[member-invite] INSERT 실패:', invErr?.message);
        if (m.includes('row-level security') || m.includes('permission')) {
          toast.error('초대 권한이 없어요. ADMIN 만 초대할 수 있어요.');
        } else {
          toast.error('초대 생성 중 오류가 발생했어요.');
        }
        return;
      }
      // 3) Edge Function — invitation_id 만 전달 (V2 send-invite 시그니처)
      const row = inv as { id: string; token: string };
      const { error: fnErr } = await supabase.functions.invoke('send-invite', {
        body: { invitation_id: row.id },
      });
      if (fnErr) {
        console.error('[member-invite] 이메일 발송 실패:', fnErr.message);
        toast.warning(`초대는 등록됐지만 이메일 발송이 실패했어요. 직접 링크를 복사해 전달하세요: ${window.location.origin}/invite/member/${row.token}`);
      } else {
        toast.success(`${app.name}님께 초대 이메일을 발송했어요.`);
      }
      setInvitedEmails((p) => new Set(p).add(email));
    } finally {
      setInvitingId(null);
    }
  }

  async function handleSingleStatus(app: ParticipantApplication, next: ParticipantStatus) {
    setActing(true);
    const r = await updateApplicationStatus(app.id, next, user?.id ?? null);
    setActing(false);
    if (!r.success) { toast.error(r.error ?? '상태 변경 실패'); return; }
    toast.success(`상태를 '${PARTICIPANT_STATUS_LABELS[next]}' 로 변경했어요.`);
    await refresh();
  }

  async function handleBulkStatus(next: ParticipantStatus) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('선택된 신청자가 없어요.');
      return;
    }
    if (!window.confirm(`${ids.length}명을 '${PARTICIPANT_STATUS_LABELS[next]}' 로 변경할까요?`)) return;
    setActing(true);
    const r = await bulkUpdateStatus(ids, next, user?.id ?? null);
    setActing(false);
    if (!r.success) { toast.error(r.error ?? '일괄 처리 실패'); return; }
    toast.success(`${r.updatedCount}명을 처리했어요.`);
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 size={20} className="animate-spin text-violet-400 mr-2" aria-hidden="true" />
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* STEP-APPLICATION-CAPACITY — 정원 현황 (max_applicants 있을 때만) */}
      {maxApplicants && maxApplicants > 0 && (() => {
        const validCount = items.filter((a) => a.status !== 'withdrawn' && a.status !== 'rejected').length;
        const isFull = validCount >= maxApplicants;
        return (
          <div className="flex items-center gap-2 text-sm rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2">
            <span className="text-slate-500">정원</span>
            <span className="font-bold text-[#1E1B4B] tabular-nums">
              {validCount} / {maxApplicants}명
            </span>
            {isFull ? (
              <span className="text-[10px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">마감</span>
            ) : (
              <span className="text-[10px] text-slate-500">남은 자리 {maxApplicants - validCount}명</span>
            )}
          </div>
        );
      })()}

      {/* 헤더 */}
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Users2 size={18} className="text-violet-600" aria-hidden="true" />
          신청자 ({items.length})
        </h2>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">{selectedIds.size}명 선택</span>
            <Button variant="outline" size="sm" leftIcon={<Clock size={12} />} onClick={() => void handleBulkStatus('reviewing')} disabled={acting}>일괄 검토중</Button>
            <Button variant="outline" size="sm" leftIcon={<CheckCircle2 size={12} />} onClick={() => void handleBulkStatus('accepted')} disabled={acting} className="!border-emerald-200 !text-emerald-700 hover:!bg-emerald-50">일괄 합격</Button>
            <Button variant="outline" size="sm" leftIcon={<XCircle size={12} />} onClick={() => void handleBulkStatus('rejected')} disabled={acting} className="!border-rose-200 !text-rose-700 hover:!bg-rose-50">일괄 탈락</Button>
          </div>
        )}
      </header>

      {/* 필터 탭 */}
      <nav role="tablist" className="flex flex-wrap items-center gap-1.5">
        {FILTER_TABS.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(t.key)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                active ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
              ].join(' ')}
            >
              {t.label}
              <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'].join(' ')}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 테이블 */}
      {visible.length === 0 ? (
        <EmptyState emoji="📭" title="해당 조건의 신청자가 없어요" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="px-3 py-2.5 w-10">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded text-violet-600" />
                </th>
                <th className="text-left px-3 py-2.5 font-semibold">이름</th>
                <th className="text-left px-3 py-2.5 font-semibold">소속</th>
                <th className="text-left px-3 py-2.5 font-semibold">연락처</th>
                <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">신청일</th>
                {isEvaluation && <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap"><Trophy size={11} className="inline mr-1" />점수</th>}
                <th className="text-center px-3 py-2.5 font-semibold">상태</th>
                <th className="text-right px-3 py-2.5 font-semibold">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((a) => {
                const checked = selectedIds.has(a.id);
                const score = scores.get(a.id);
                return (
                  <tr key={a.id} className="hover:bg-violet-50/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" checked={checked} onChange={() => toggleOne(a.id)} className="rounded text-violet-600" />
                    </td>
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setDetailTarget(a)} className="text-violet-700 hover:underline font-semibold">
                        {a.name}
                      </button>
                      {a.email && <p className="text-[11px] text-slate-400">{a.email}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{a.organization ?? '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 tabular-nums">{a.phone}</td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">{formatDateKo(a.created_at)}</td>
                    {isEvaluation && (
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                        {score ? (
                          <span className="font-bold text-violet-700">{score.avg.toFixed(1)} <span className="text-[10px] text-slate-400">({score.count}명)</span></span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${PARTICIPANT_STATUS_TONE[a.status]}`}>
                        {PARTICIPANT_STATUS_LABELS[a.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right space-x-1 whitespace-nowrap">
                      {a.status === 'applied' && (
                        <button type="button" onClick={() => void handleSingleStatus(a, 'reviewing')} disabled={acting}
                          className="text-[11px] px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50">검토 시작</button>
                      )}
                      {a.status === 'reviewing' && (
                        <>
                          <button type="button" onClick={() => void handleSingleStatus(a, 'accepted')} disabled={acting}
                            className="text-[11px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">합격</button>
                          <button type="button" onClick={() => void handleSingleStatus(a, 'rejected')} disabled={acting}
                            className="text-[11px] px-2 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50">탈락</button>
                        </>
                      )}
                      {a.status === 'accepted' && a.email && (
                        invitedEmails.has(a.email.toLowerCase()) ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-md">
                            <Mail size={10} aria-hidden="true" />
                            초대완료
                          </span>
                        ) : (
                          <button type="button"
                            onClick={() => void inviteAsMember(a)}
                            disabled={invitingId !== null}
                            className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50">
                            {invitingId === a.id ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <UserPlus size={11} aria-hidden="true" />}
                            MEMBER 초대
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailTarget && (
        <ApplicationDetailModal
          application={detailTarget}
          onClose={() => setDetailTarget(null)}
          onSaved={() => { void refresh(); setDetailTarget(null); }}
        />
      )}
    </div>
  );
}
