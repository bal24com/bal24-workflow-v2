// bal24 v2 — 고객사 리스트 행 (V-1 분리, STEP-CONSORTIUM-REDESIGN 자사 뱃지 포함).

import { Building2, Trash2, Eye, Pencil } from 'lucide-react';
import { Button } from '../../components/ui';
import type { Client, ClientContact } from '../../types/database';

export type ClientRow = Client & {
  contacts: Pick<ClientContact, 'id' | 'name' | 'position' | 'phone_mobile' | 'email'>[];
};

interface Props {
  c: ClientRow;
  onView: (c: ClientRow) => void;
  onEdit: (c: ClientRow) => void;
  onDelete: (c: ClientRow) => void;
}

function formatBusinessNumber(raw?: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export default function ClientListRow({ c, onView, onEdit, onDelete }: Props) {
  const ceo = c.ceo_name ?? c.representative;
  const firstTag = c.tags?.[0];
  return (
    <li className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm transition">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 text-violet-600 shrink-0">
        <Building2 size={18} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {firstTag && (
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">{firstTag}</span>
            )}
            <span className="text-sm font-bold text-text truncate">{c.name}</span>
            {c.is_own_company && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded shrink-0">자사</span>
            )}
          </div>
          <div className="text-xs text-muted truncate">
            {ceo ?? '대표자 미지정'}
            {c.business_number && ` · ${formatBusinessNumber(c.business_number)}`}
          </div>
        </div>
        <div className="min-w-0 text-xs text-muted">
          {[c.business_type, c.business_item].filter(Boolean).join(' · ') || (
            <span className="text-slate-400">업종 미지정</span>
          )}
        </div>
        <div className="min-w-0 text-xs text-muted truncate">
          {c.phone || c.email ? (
            <>
              {c.phone && <span>{c.phone}</span>}
              {c.phone && c.email && ' · '}
              {c.email}
            </>
          ) : c.contacts[0] ? (
            <>
              <span className="font-semibold text-slate-700">담당</span>{' '}
              {c.contacts[0].name}
              {c.contacts[0].phone_mobile && ` · ${c.contacts[0].phone_mobile}`}
            </>
          ) : (
            <span className="text-slate-400">연락처 미등록</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="outline" size="sm" leftIcon={<Eye size={14} />} onClick={() => onView(c)}>내용</Button>
        <Button variant="primary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => onEdit(c)}>수정</Button>
        {!c.is_own_company && (
          <button type="button" onClick={() => onDelete(c)} aria-label="삭제"
            className="p-1.5 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 border border-rose-300">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </li>
  );
}
