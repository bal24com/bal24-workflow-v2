// bal24 v2 — STEP-AUDIT-PORTAL 지출 건별 카드 (감사 의견 포함)

import { ExternalLink, FileCheck2, FileWarning } from 'lucide-react';
import { formatDateKo, formatMoney } from '../../lib/utils';
import {
  GRANT_FUND_TYPE_LABELS, GRANT_FUND_TYPE_TONE,
  type GrantExpenditure,
} from '../../types/grantLedger';

interface Props {
  index: number;
  exp: GrantExpenditure;
  comment: string;
  onCommentChange: (next: string) => void;
  disabled: boolean;
}

interface DocLink {
  label: string;
  url: string | null;
}

export default function AuditExpenditureCard({ index, exp, comment, onCommentChange, disabled }: Props) {
  const docs: DocLink[] = [
    { label: '사업자등록증', url: exp.biz_reg_url },
    { label: '통장사본',     url: exp.bank_copy_url },
    { label: '검수조서',     url: exp.inspection_url },
    { label: '계약서',       url: exp.contract_url },
    { label: '견적서',       url: exp.quote_url },
    { label: '영수증',       url: exp.receipt_url },
  ];
  const submittedDocs = docs.filter((d) => !!d.url);
  const docsComplete = exp.docs_submitted || submittedDocs.length >= 3;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] space-y-3">
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 tabular-nums">#{index}</span>
            <h3 className="text-sm font-bold text-[#1E1B4B]">{exp.item_name}</h3>
            <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${GRANT_FUND_TYPE_TONE[exp.fund_type]}`}>
              {GRANT_FUND_TYPE_LABELS[exp.fund_type]}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>지출일 <span className="font-semibold text-[#1E1B4B] tabular-nums">{formatDateKo(exp.expenditure_date)}</span></span>
            {exp.vendor_name && <span>주관기관 <span className="font-semibold text-[#1E1B4B]">{exp.vendor_name}</span></span>}
            {exp.account_code && <span>비목 <span className="font-semibold text-[#1E1B4B]">{exp.account_code}</span></span>}
          </p>
        </div>
        <p className="text-base font-bold text-violet-700 tabular-nums whitespace-nowrap">
          {formatMoney(exp.amount)}
        </p>
      </header>

      {/* 증빙서류 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[11px] font-bold text-slate-500">증빙서류</p>
          {docsComplete ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
              <FileCheck2 size={10} aria-hidden="true" />
              서류 완료
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-md">
              <FileWarning size={10} aria-hidden="true" />
              서류 미완료
            </span>
          )}
        </div>
        {submittedDocs.length === 0 ? (
          <p className="text-[11px] text-slate-400">제출된 증빙서류가 없어요.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {submittedDocs.map((d) => (
              <a
                key={d.label}
                href={d.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
              >
                {d.label}
                <ExternalLink size={10} aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* 감사 의견 */}
      <div className="space-y-1 pt-2 border-t border-slate-100">
        <label className="text-[11px] font-bold text-slate-500">감사 의견</label>
        <textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="이 항목에 대한 의견을 입력해 주세요. (선택)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 disabled:bg-slate-50 resize-y leading-relaxed"
        />
      </div>
    </article>
  );
}
