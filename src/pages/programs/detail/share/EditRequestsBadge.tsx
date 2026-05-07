// bal24 v2 — OverviewTab 수정요청 미확인 배지 + 모달
// 추가 명세 #2: PM 확인은 프로그램 상세 개요탭에 배지로 표시 (별도 페이지 X)

import { useEffect, useState } from 'react';
import {
  Loader2, MessageSquareWarning, Phone, X,
} from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { formatDateKo } from '../../../../lib/utils';
import type { EditRequestStatus, ProgramEditRequest } from '../../../../types/database';
import { BADGE_BASE } from '../../../../utils/statusStyles';

interface Props {
  programId: string;
}

const STATUS_LABEL: Record<EditRequestStatus, string> = {
  pending: '대기',
  reviewing: '검토중',
  resolved: '처리됨',
  rejected: '반려',
};

const STATUS_STYLE: Record<EditRequestStatus, string> = {
  pending: 'bg-rose-50 text-rose-600 border-rose-200',
  reviewing: 'bg-orange-50 text-orange-600 border-orange-200',
  resolved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-slate-100 text-slate-500 border-slate-300',
};

const ACTIONABLE: EditRequestStatus[] = ['pending', 'reviewing'];

export default function EditRequestsBadge({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [list, setList] = useState<ProgramEditRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function refreshCount() {
    const { count, error } = await supabase
      .from('program_edit_requests')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', programId)
      .in('status', ACTIONABLE);
    if (error) {
      console.error('[program-detail] 수정요청 카운트 실패:', error.message);
      return;
    }
    setPendingCount(count ?? 0);
  }

  async function refreshList() {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_edit_requests')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[program-detail] 수정요청 목록 조회 실패:', error.message);
      toast.error('수정요청 목록을 불러오지 못했어요.');
      setLoading(false);
      return;
    }
    setList((data as ProgramEditRequest[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    void (async () => {
      await refreshCount();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  useEffect(() => {
    if (!open) return;
    void refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function changeStatus(id: string, next: EditRequestStatus) {
    setBusy(id);
    try {
      const { error } = await supabase
        .from('program_edit_requests')
        .update({
          status: next,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) {
        console.error('[program-detail] 수정요청 상태 변경 실패:', error.message);
        toast.error('상태 변경에 실패했어요.');
        return;
      }
      toast.success(`상태를 "${STATUS_LABEL[next]}"으로 변경했어요.`);
      await Promise.all([refreshList(), refreshCount()]);
    } finally {
      setBusy(null);
    }
  }

  if (pendingCount === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-rose-200 bg-rose-50/60 hover:bg-rose-50 p-4 flex items-center gap-3 transition-colors text-left"
      >
        <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 text-rose-600">
          <MessageSquareWarning size={18} aria-hidden="true" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1E1B4B]">고객 수정요청 {pendingCount}건 미확인</p>
          <p className="mt-0.5 text-[11px] text-slate-500">클릭하여 검토·답변</p>
        </div>
        <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full bg-rose-500 text-white text-xs font-bold tabular-nums">
          {pendingCount}
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="고객 수정요청"
        description="외부 공유 페이지에서 받은 수정요청을 검토하고 처리해요."
        size="lg"
        footer={<Button variant="ghost" onClick={() => setOpen(false)}>닫기</Button>}
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">수정요청이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {list.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#1E1B4B]">{r.requester_name}</span>
                  {r.requester_phone && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
                      <Phone size={10} aria-hidden="true" />
                      {r.requester_phone}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-slate-400 tabular-nums">
                    {formatDateKo(r.created_at)}
                  </span>
                  <span className={`${BADGE_BASE} ${STATUS_STYLE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-violet-100/70">
                  {r.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => void changeStatus(r.id, 'reviewing')}
                      disabled={busy === r.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                    >
                      검토 시작
                    </button>
                  )}
                  {r.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => void changeStatus(r.id, 'resolved')}
                      disabled={busy === r.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      처리 완료
                    </button>
                  )}
                  {r.status !== 'rejected' && r.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => void changeStatus(r.id, 'rejected')}
                      disabled={busy === r.id}
                      className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <X size={11} aria-hidden="true" />
                      반려
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
