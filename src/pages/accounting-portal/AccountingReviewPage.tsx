// 회계사무소 검토 세션 — PM 측 목록·생성 페이지
// STEP-ACCOUNTING-ALL P4

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Link as LinkIcon, ClipboardCheck, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import EmptyState from '../../components/EmptyState';
import { formatDateKo } from '../../lib/utils';
import {
  fetchReviews,
  REVIEW_STATUS_LABEL, REVIEW_STATUS_STYLE,
  type ReviewRow,
} from './accountingReviewUtils';
import AccountingReviewFormModal from './AccountingReviewFormModal';

export default function AccountingReviewPage() {
  const toast = useToast();
  const [items, setItems] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchReviews();
      setItems(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[AccountingReviewPage] 조회 오류:', msg);
      toast.error(msg || '검토 세션 목록을 불러오는 중 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void reload(); }, [reload]);

  async function copyLink(token: string) {
    const url = `${window.location.origin}/accounting-review/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('링크를 복사했어요.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[AccountingReviewPage] 클립보드 복사 실패:', msg);
      toast.error('클립보드 복사에 실패했어요.');
    }
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <ClipboardCheck size={22} aria-hidden="true" />
          회계 검토
        </h1>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setFormOpen(true)}>새 검토 요청</Button>
      </div>

      <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-xs text-violet-900">
        💡 회계사무소에 외주/급여 내역을 토큰 링크로 공유하고 항목별 승인·수정요청을 받을 수 있어요. 링크는 만료일까지 비로그인 접근 가능합니다.
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          emoji="📋"
          title="아직 검토 요청이 없어요."
          description="첫 검토 세션을 만들어 회계사무소와 공유해 보세요."
          action={
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setFormOpen(true)}>
              + 검토 요청
            </Button>
          }
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">기간 라벨</th>
                <th className="text-left px-4 py-2.5 font-semibold">회계사무소</th>
                <th className="text-center px-4 py-2.5 font-semibold whitespace-nowrap">프로젝트 수</th>
                <th className="text-center px-4 py-2.5 font-semibold whitespace-nowrap">상태</th>
                <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">발송일</th>
                <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">만료일</th>
                <th className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-violet-50/40">
                  <td className="px-4 py-2.5 font-semibold text-text">{r.period_label}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-700">
                    {r.firm_name ?? '-'}
                    {r.firm_email && <div className="text-[11px] text-muted">{r.firm_email}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs text-muted">{r.project_ids?.length ?? 0}건</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${REVIEW_STATUS_STYLE[r.status]}`}>
                      {REVIEW_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{r.sent_at ? formatDateKo(r.sent_at) : '-'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{formatDateKo(r.expires_at)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => void copyLink(r.token)}
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline mr-2"
                    >
                      <LinkIcon size={12} />링크 복사
                    </button>
                    <a
                      href={`/accounting-review/${r.token}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-slate-600 hover:underline"
                    >
                      <ExternalLink size={12} />열기
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AccountingReviewFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={() => { setFormOpen(false); void reload(); }}
      />
    </div>
  );
}
