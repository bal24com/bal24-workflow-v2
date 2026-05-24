// 수입/계약 상세 우측 슬라이드 패널 — STEP-ACCOUNTING-ALL P2
// 기본정보·청구단계·입금확인·삭제

import { useState } from 'react';
import { X, Pencil, Trash2, CheckCircle2, FileText, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../lib/utils';
import type { BillingScheduleItem } from '../../types/database';
import {
  markContractDeposited,
  softDeleteContract,
  CONTRACT_STATUS_STYLE,
  type ContractRow,
} from './contractUtils';
import ContractPayrollSection from './ContractPayrollSection';

interface Props {
  contract: ContractRow | null;
  onClose: () => void;
  onEdit: (c: ContractRow) => void;
  onChanged: () => void;
}

const BILLING_LABEL: Record<BillingScheduleItem['status'], string> = {
  pending: '대기',
  issued:  '발행',
  paid:    '완료',
};

const BILLING_STYLE: Record<BillingScheduleItem['status'], string> = {
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
  issued:  'bg-blue-50 text-blue-700 border-blue-200',
  paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ContractDetailDrawer({ contract, onClose, onEdit, onChanged }: Props) {
  const toast = useToast();
  const [acting, setActing] = useState(false);

  if (!contract) return null;

  async function handleConfirmDeposit() {
    if (!contract) return;
    if (!window.confirm('입금이 확인되었나요? 상태가 "완료"로 변경됩니다.')) return;
    setActing(true);
    const err = await markContractDeposited(contract.id);
    setActing(false);
    if (err) { toast.error(err); return; }
    toast.success('입금을 확인했어요.');
    onChanged();
  }

  async function handleDelete() {
    if (!contract) return;
    if (!window.confirm(`"${contract.contract_name}" 계약을 휴지통으로 보낼까요?`)) return;
    setActing(true);
    const err = await softDeleteContract(contract.id);
    setActing(false);
    if (err) { toast.error(err); return; }
    toast.success('휴지통으로 이동했어요.');
    onChanged();
  }

  const schedule = Array.isArray(contract.billing_schedule) ? contract.billing_schedule : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="계약 상세"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-[640px] bg-white shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${CONTRACT_STATUS_STYLE[contract.status]}`}>
                {contract.status}
              </span>
              {contract.deposited_at && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
                  <CheckCircle2 size={12} aria-hidden="true" /> 입금완료
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-text truncate">{contract.contract_name}</h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" leftIcon={<Pencil size={12} />} onClick={() => onEdit(contract)}>수정</Button>
            <Button variant="ghost" size="sm" leftIcon={<Trash2 size={12} />} onClick={() => void handleDelete()} disabled={acting}>삭제</Button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="닫기"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* 기본 정보 */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">기본 정보</h3>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="주관기관" value={contract.client?.name ?? '-'} />
              <Info label="프로젝트" value={contract.project?.name ?? '-'} />
              <Info label="계약금액" value={formatMoney(contract.contract_amount)} highlight />
              <Info label="과세구분" value={contract.vat_type} />
              <Info label="계약일" value={contract.contract_date ? formatDateKo(contract.contract_date) : '-'} />
              <Info label="입금일" value={contract.deposited_at ? formatDateKo(contract.deposited_at) : '미입금'} />
            </dl>
          </section>

          {/* 청구 단계 */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">청구 단계</h3>
            {schedule.length === 0 ? (
              <p className="text-xs text-slate-400 italic">청구 단계가 설정되지 않았어요.</p>
            ) : (
              <ul className="space-y-1.5">
                {schedule.map((s) => (
                  <li key={s.seq} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-200 text-sm">
                    <span className="font-semibold text-slate-500 w-12 shrink-0">{s.seq}회차</span>
                    <span className="font-bold text-text tabular-nums flex-1">{formatMoney(s.amount)}</span>
                    <span className="text-xs text-muted whitespace-nowrap">{s.due_date ? formatDateKo(s.due_date) : '-'}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${BILLING_STYLE[s.status]}`}>
                      {BILLING_LABEL[s.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* STEP-ACCOUNTING-FOLLOWUP7 — 이 계약의 외주/급여 (합계·목록·추가 버튼) */}
          <ContractPayrollSection contractId={contract.id} />

          {/* 첨부 */}
          <section>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">첨부 파일</h3>
            <ul className="space-y-1.5">
              <FileLink label="계약서" url={contract.contract_file_url} />
              <FileLink label="세금계산서" url={contract.tax_invoice_url} />
            </ul>
            <p className="text-[11px] text-slate-400 mt-1">* 파일 추가·교체는 [수정] 모달에서 가능합니다.</p>
          </section>

          {/* 비고 */}
          {contract.memo && (
            <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">비고</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50/60 rounded-xl p-3">{contract.memo}</p>
            </section>
          )}
        </div>

        {/* Footer — 입금 확인 */}
        {!contract.deposited_at && contract.status !== '취소' && (
          <footer className="px-5 py-3 border-t border-slate-200">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              leftIcon={<CheckCircle2 size={16} />}
              onClick={() => void handleConfirmDeposit()}
              loading={acting}
            >
              입금 확인 처리
            </Button>
          </footer>
        )}
      </aside>
    </>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-500 mb-0.5">{label}</dt>
      <dd className={`text-sm ${highlight ? 'font-bold text-violet-700 tabular-nums' : 'text-text'}`}>{value}</dd>
    </div>
  );
}

function FileLink({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <li className="flex items-center gap-2 text-xs text-slate-400">
        <FileText size={14} aria-hidden="true" />
        {label} <span className="italic">미첨부</span>
      </li>
    );
  }
  return (
    <li>
      <a
        href={url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-2 text-sm text-violet-700 hover:underline"
      >
        <FileText size={14} aria-hidden="true" />
        {label}
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    </li>
  );
}
