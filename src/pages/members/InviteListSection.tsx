// bal24 v2 — STEP-MEMBER-INVITE 초대 대기 목록 (MembersPage 하단 섹션)
// 재발송 + 취소(soft delete) + 링크 복사.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Send, X, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { copyToClipboard } from '../../lib/clipboard';
import { formatDateKo } from '../../lib/utils';
import {
  INVITATION_STATUS_BADGE, buildInviteUrl, isInvitationExpired,
} from './memberInviteUtils';
import { ROLE_LABELS } from '../../constants/roles';
import type { MemberInvitation, MemberInvitationStatus } from '../../types/database';

interface Props {
  isAdmin: boolean;
  /** 모달에서 새 초대 발송 후 reload 트리거 */
  reloadKey: number;
}

export default function InviteListSection({ isAdmin, reloadKey }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<MemberInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('member_invitations')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[member-invite] 목록 조회 실패:', error.message);
      toast.error('초대 목록을 불러오지 못했어요.');
      setLoading(false);
      return;
    }
    setItems(((data ?? []) as MemberInvitation[]));
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchItems();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchItems, reloadKey]);

  async function handleResend(inv: MemberInvitation) {
    setActingId(inv.id);
    try {
      // 만료된 초대면 expires_at + 7일 연장 + status='pending'
      if (isInvitationExpired(inv.expires_at, inv.status)) {
        const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabase
          .from('member_invitations')
          .update({ expires_at: newExpiresAt, status: 'pending' })
          .eq('id', inv.id);
        if (error) {
          console.error('[member-invite] 만료일 연장 실패:', error.message);
          toast.error('만료일 연장에 실패했어요.');
          return;
        }
      }

      const { error } = await supabase.functions.invoke('send-invite', {
        body: { invitation_id: inv.id },
      });
      if (error) {
        console.error('[member-invite] 재발송 실패:', error.message);
        toast.error(`재발송 실패. 직접 링크를 복사해 전달하세요: ${buildInviteUrl(inv.token)}`);
        return;
      }
      toast.success(`${inv.email} 으로 재발송했어요.`);
      await fetchItems();
    } finally {
      setActingId(null);
    }
  }

  async function handleCancel(inv: MemberInvitation) {
    if (!window.confirm(`${inv.email} 초대를 취소할까요? 받은 이메일의 링크는 작동하지 않아요.`)) return;
    setActingId(inv.id);
    try {
      const { error } = await supabase
        .from('member_invitations')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', inv.id);
      if (error) {
        console.error('[member-invite] 취소 실패:', error.message);
        toast.error('초대 취소에 실패했어요.');
        return;
      }
      toast.success('초대를 취소했어요.');
      await fetchItems();
    } finally {
      setActingId(null);
    }
  }

  async function handleCopyLink(inv: MemberInvitation) {
    const url = buildInviteUrl(inv.token);
    const ok = await copyToClipboard(url);
    if (ok) toast.success('초대 링크를 복사했어요.');
    else toast.error('복사에 실패했어요. 직접 선택하여 복사해 주세요.');
  }

  if (!isAdmin) return null; // PM 은 SELECT 만 가능하지만 본 섹션은 ADMIN 전용

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Send size={16} className="text-violet-600" aria-hidden="true" />
          초대 현황
        </h2>
        <button
          type="button"
          onClick={() => void fetchItems()}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          새로고침
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">발송한 초대가 없어요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {items.map((inv) => {
            const expired = isInvitationExpired(inv.expires_at, inv.status);
            const effectiveStatus: MemberInvitationStatus =
              inv.status === 'accepted' ? 'accepted' : (expired ? 'expired' : 'pending');
            const badge = INVITATION_STATUS_BADGE[effectiveStatus];
            const acting = actingId === inv.id;
            return (
              <li key={inv.id} className="py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#1E1B4B] truncate">{inv.email}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {ROLE_LABELS[inv.role] ?? inv.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                    초대일 {formatDateKo(inv.created_at)} · 만료 {formatDateKo(inv.expires_at)}
                    {inv.accepted_at && ` · 수락일 ${formatDateKo(inv.accepted_at)}`}
                  </p>
                </div>
                {effectiveStatus !== 'accepted' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleCopyLink(inv)}
                      disabled={acting}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-600 hover:bg-slate-100"
                    >
                      <Copy size={11} aria-hidden="true" />
                      링크 복사
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleResend(inv)}
                      disabled={acting}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-violet-700 hover:bg-violet-50"
                    >
                      {acting ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Send size={11} aria-hidden="true" />}
                      재발송
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCancel(inv)}
                      disabled={acting}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-rose-500 hover:bg-rose-50"
                    >
                      <X size={11} aria-hidden="true" />
                      취소
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
