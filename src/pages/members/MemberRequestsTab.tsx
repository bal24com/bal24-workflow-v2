// 가입신청 검토 탭 (Admin/PM 전용)

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, CheckCircle2, XCircle, Link2, Inbox,
} from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateKo } from '../../lib/utils';
import RejectionReasonModal from '../programs/detail/RejectionReasonModal';
import {
  fetchMemberRequests, approveMemberRequest, rejectMemberRequest,
  REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE,
} from './memberRequestUtils';
import type { MemberRequest, MemberRequestStatus } from '../../types/database';

type FilterTab = 'all' | MemberRequestStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',      label: '전체' },
  { key: 'pending',  label: REQUEST_STATUS_LABEL.pending },
  { key: 'approved', label: REQUEST_STATUS_LABEL.approved },
  { key: 'rejected', label: REQUEST_STATUS_LABEL.rejected },
];

export default function MemberRequestsTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<MemberRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [acting, setActing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<MemberRequest | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await fetchMemberRequests();
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => { await refresh(); if (cancelled) return; })();
    return () => { cancelled = true; };
  }, [refresh]);

  const counts = useMemo(() => {
    const acc: Record<FilterTab, number> = { all: items.length, pending: 0, approved: 0, rejected: 0 };
    items.forEach((r) => { acc[r.status] += 1; });
    return acc;
  }, [items]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((r) => r.status === filter);
  }, [items, filter]);

  async function handleApprove(req: MemberRequest) {
    if (!window.confirm(`${req.name} 님(${req.email})을 승인하고 초대 이메일을 보낼까요?`)) return;
    setActing(true);
    const r = await approveMemberRequest(req, user?.id ?? null);
    setActing(false);
    if (!r.success) { toast.error(r.error ?? '승인 처리 실패'); return; }
    if (r.emailFailed) {
      toast.warning('승인은 완료됐지만 초대 메일 발송이 실패했어요. 초대 목록에서 직접 링크를 복사해 전달해 주세요.');
    } else {
      toast.success(`${req.name} 님께 초대 이메일을 발송했어요.`);
    }
    await refresh();
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;
    setActing(true);
    const r = await rejectMemberRequest(rejectTarget.id, reason, user?.id ?? null);
    setActing(false);
    if (!r.success) { toast.error(r.error ?? '거절 처리 실패'); return; }
    toast.success(`${rejectTarget.name} 님 신청을 거절했어요.`);
    setRejectTarget(null);
    await refresh();
  }

  async function copyJoinLink() {
    const url = `${window.location.origin}/join`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('가입신청 링크를 복사했어요.');
    } catch (err) {
      console.error('[member-requests] 클립보드 복사 실패:', err instanceof Error ? err.message : '');
      toast.error('링크 복사에 실패했어요. 직접 복사해 주세요.');
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Inbox size={18} className="text-violet-600" aria-hidden="true" />
          가입신청 ({items.length})
        </h2>
        <button
          type="button"
          onClick={() => void copyJoinLink()}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-violet-200 text-violet-700 hover:bg-violet-50"
        >
          <Link2 size={12} aria-hidden="true" />
          신청 링크 복사
        </button>
      </header>

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

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 size={20} className="animate-spin text-violet-400 mr-2" aria-hidden="true" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState emoji="📥" title="해당 조건의 신청이 없어요" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold">이름</th>
                <th className="text-left px-3 py-2.5 font-semibold">이메일</th>
                <th className="text-left px-3 py-2.5 font-semibold">연락처</th>
                <th className="text-left px-3 py-2.5 font-semibold">소속·직책</th>
                <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">신청일</th>
                <th className="text-center px-3 py-2.5 font-semibold">상태</th>
                <th className="text-right px-3 py-2.5 font-semibold">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-violet-50/40 transition-colors align-top">
                  <td className="px-3 py-2.5 font-semibold text-[#1E1B4B]">
                    {r.name}
                    {r.message && (
                      <p className="text-[11px] text-slate-500 font-normal whitespace-pre-wrap line-clamp-2 mt-0.5">{r.message}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{r.email}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 tabular-nums">{r.phone ?? '-'}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">
                    <p>{r.department ?? '-'}</p>
                    {r.position && <p className="text-[11px] text-slate-400">{r.position}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">{formatDateKo(r.created_at)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${REQUEST_STATUS_TONE[r.status]}`}>
                      {REQUEST_STATUS_LABEL[r.status]}
                    </span>
                    {r.status === 'rejected' && r.reject_reason && (
                      <p className="text-[10px] text-orange-700 mt-1 whitespace-pre-wrap line-clamp-2 text-left">{r.reject_reason}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1">
                    {r.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleApprove(r)}
                          disabled={acting}
                          className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md bg-cyan-50 text-cyan-700 hover:bg-cyan-100 disabled:opacity-50"
                        >
                          <CheckCircle2 size={11} aria-hidden="true" />
                          승인
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectTarget(r)}
                          disabled={acting}
                          className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                        >
                          <XCircle size={11} aria-hidden="true" />
                          거절
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RejectionReasonModal
        open={rejectTarget !== null}
        targetLabel={rejectTarget?.name ?? ''}
        submitting={acting}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => void handleRejectConfirm(reason)}
      />
    </div>
  );
}
