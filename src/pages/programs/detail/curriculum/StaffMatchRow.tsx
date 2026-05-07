// bal24 v2 — 매칭된 인력 한 줄 (이름·소스·역할·금액·상태 + 토큰 발송·삭제)

import { Copy, ExternalLink, Trash2 } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import { formatMoney } from '../../../../lib/utils';
import {
  STAFF_ROLE_STYLE, STAFF_STATUS_LABEL, STAFF_STATUS_STYLE, buildCurriculumInviteUrl,
} from '../../../../lib/curriculumStaff';
import { BADGE_BASE } from '../../../../utils/statusStyles';

export interface MatchedStaffRow {
  id: string;
  name: string;
  source: 'external' | 'internal';
  role: import('../../../../types/database').CurriculumStaffRole;
  status: import('../../../../types/database').CurriculumStaffStatus;
  fee: number | null;
  token: string;
  note: string | null;
  phone: string | null;
  email: string | null;
}

interface Props {
  row: MatchedStaffRow;
  onDelete: () => void;
}

export default function StaffMatchRow({ row, onDelete }: Props) {
  const toast = useToast();
  const url = buildCurriculumInviteUrl(row.token);

  async function handleCopy() {
    const ok = await copyToClipboard(url);
    if (ok) toast.success('참여의사 링크 복사 완료');
    else toast.error('링크 복사에 실패했어요.');
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2">
      <span className={`${BADGE_BASE} ${STAFF_ROLE_STYLE[row.role]} shrink-0`}>{row.role}</span>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="truncate text-xs font-semibold text-[#1E1B4B] shrink-0">
          {row.name}
          <span className="ml-1 text-[10px] text-slate-400 font-normal">
            ({row.source === 'external' ? '외부' : '내부'})
          </span>
        </span>
        {(row.phone || row.email) && (
          <span className="hidden sm:inline truncate text-[10px] text-slate-400">
            {row.phone}
            {row.phone && row.email ? ' · ' : ''}
            {row.email}
          </span>
        )}
      </div>
      {row.fee != null && (
        <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
          {formatMoney(row.fee)}
        </span>
      )}
      <span className={`${BADGE_BASE} ${STAFF_STATUS_STYLE[row.status]} shrink-0`}>
        {STAFF_STATUS_LABEL[row.status]}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        title="참여의사 링크 복사"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
      >
        <Copy size={12} aria-hidden="true" />
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title="참여의사 페이지 새 탭"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
      >
        <ExternalLink size={12} aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={onDelete}
        title="삭제"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
      >
        <Trash2 size={12} aria-hidden="true" />
      </button>
    </div>
  );
}
