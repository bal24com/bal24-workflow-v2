// 수입/계약 상세 우측 슬라이드 패널 — STEP-ACCOUNTING-ALL P2
// 기본정보·청구단계·입금확인·삭제 + STEP-CONTRACT-AUTO 주관기관 서류 요청 (포털)

import { useEffect, useState } from 'react';
import { X, Pencil, Trash2, CheckCircle2, FileText, ExternalLink, Link2, Copy } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import type { BillingScheduleItem } from '../../types/database';
import {
  markContractDeposited,
  softDeleteContract,
  CONTRACT_STATUS_STYLE,
  CONTRACT_STATUS_LABEL,
  type ContractRow,
} from './contractUtils';
import ContractPayrollSection from './ContractPayrollSection';
import PortalCreateModal from '../portal/PortalCreateModal';

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
  const [portalOpen, setPortalOpen] = useState(false);
  const [portalToken, setPortalToken] = useState<string | null>(null);

  // 연결된 포털이 있으면 token 조회 (외부 URL 노출용)
  useEffect(() => {
    if (!contract?.portal_id) { setPortalToken(null); return; }
    let cancelled = false;
    void supabase.from('project_portals').select('portal_token').eq('id', contract.portal_id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setPortalToken((data as { portal_token: string } | null)?.portal_token ?? null); });
    return () => { cancelled = true; };
  }, [contract?.portal_id]);

  if (!contract) return null;

  // 포털 저장 후 income_contracts.portal_id 연결 + doc_request_pending 해제
  async function handlePortalSaved(portalId?: string) {
    if (!contract || !portalId) return;
    const { error } = await supabase.from('income_contracts')
      .update({ portal_id: portalId, doc_request_pending: false }).eq('id', contract.id);
    if (error) { toast.error('포털 연결 중 오류가 발생했어요.'); return; }
    toast.success('주관기관 서류 요청 포털을 연결했어요.');
    onChanged();
  }

  function handleCopyPortalUrl() {
    if (!portalToken) return;
    const url = `${window.location.origin}/portal/${portalToken}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success('포털 외부 링크를 복사했어요.'),
      () => toast.error('복사에 실패했어요. 직접 선택해 주세요.'),
    );
  }

  // 박경수님 + SkyClaw STEP-INCOME-CONTRACT-FIX — 입금일 직접 선택 (디폴트=오늘)
  const [depositDate, setDepositDate] = useState('');
  async function handleConfirmDeposit() {
    if (!contract) return;
    const dateStr = depositDate || new Date().toISOString().slice(0, 10);
    if (!window.confirm(`입금일을 ${dateStr} 로 처리하고 상태를 "완료"로 변경할까요?`)) return;
    setActing(true);
    const err = await markContractDeposited(contract.id, dateStr);
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
                {CONTRACT_STATUS_LABEL[contract.status] ?? contract.status}
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

          {/* STEP-CONTRACT-AUTO — 주관기관 서류 요청 (포털 연동) */}
          {(contract.doc_request_pending || contract.portal_id) && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 size={14} className="text-violet-600" aria-hidden="true" />
                <h3 className="text-sm font-bold text-violet-900">주관기관 서류 요청</h3>
              </div>
              {contract.portal_id && portalToken ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    포털이 연결돼 있어요. 외부 링크를 주관기관에 전달하세요.
                  </p>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 truncate text-xs px-2 py-1.5 rounded bg-white border border-slate-200 text-slate-700">
                      {`${window.location.origin}/portal/${portalToken}`}
                    </code>
                    <Button variant="outline" size="sm" leftIcon={<Copy size={12} />} onClick={handleCopyPortalUrl}>복사</Button>
                    <a href={`/portal/${portalToken}`} target="_blank" rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <ExternalLink size={12} aria-hidden="true" />열기
                    </a>
                  </div>
                </div>
              ) : contract.project?.id ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    사업자등록증·통장사본·견적서·납세증명 등 자료 요청 포털을 만들어 주관기관에 링크를 보낼 수 있어요.
                  </p>
                  <Button variant="primary" size="sm" leftIcon={<Link2 size={12} />} onClick={() => setPortalOpen(true)}>
                    포털 만들기
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-amber-700">프로젝트가 연결돼 있어야 포털을 만들 수 있어요. [수정]에서 프로젝트를 지정해 주세요.</p>
              )}
            </section>
          )}

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

        {/* Footer — 입금 확인 + 입금일 직접 선택 (박경수님 + SkyClaw STEP-INCOME-CONTRACT-FIX) */}
        {!contract.deposited_at && contract.status !== '취소' && (
          <footer className="px-5 py-3 border-t border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap">입금일</label>
              <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)}
                className="flex-1 h-8 rounded-lg border border-slate-200 px-2 text-xs" />
              <span className="text-[10px] text-slate-400">미선택 시 오늘</span>
            </div>
            <Button variant="primary" size="md" className="w-full" leftIcon={<CheckCircle2 size={16} />}
              onClick={() => void handleConfirmDeposit()} loading={acting}>
              입금 확인 처리
            </Button>
          </footer>
        )}
      </aside>

      {/* STEP-CONTRACT-AUTO — 주관기관 서류 요청 포털 생성 */}
      {contract.project?.id && (
        <PortalCreateModal
          open={portalOpen}
          projectId={contract.project.id}
          clientId={contract.client?.id ?? null}
          onClose={() => setPortalOpen(false)}
          onSaved={(id) => { setPortalOpen(false); void handlePortalSaved(id); }}
        />
      )}
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
