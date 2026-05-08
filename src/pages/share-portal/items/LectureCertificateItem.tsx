// bal24 v2 — 외부공유 항목 · 강의확인서 (전문가, 결과 단계)
// Q4 옵션 A: issued_certificates 조회 (type='lecture') + 다운로드.

import { useEffect, useState } from 'react';
import {
  Award, Loader2, Download, FileCheck,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import type { IssuedCertificate } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
  expertId: string | null;
}

type Row = Pick<
  IssuedCertificate,
  'id' | 'recipient_name' | 'issue_date' | 'pdf_url' | 'cert_number'
>;

export default function LectureCertificateItem({ programId, expertId }: Props) {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId || !expertId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('issued_certificates')
        .select('id, recipient_name, issue_date, pdf_url, cert_number')
        .eq('program_id', programId)
        .eq('expert_id', expertId)
        .eq('cert_type', 'lecture')
        .order('issue_date', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('[share-portal/expert] 강의확인서 조회 실패:', error.message);
      } else {
        setList((data as Row[] | null) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, expertId]);

  if (!expertId) {
    return (
      <ItemCard
        icon={<Award size={18} aria-hidden="true" />}
        title="강의확인서"
        hint="외부 강사로 식별되신 분만 다운로드할 수 있어요"
      >
        <p className="text-xs text-slate-400 italic text-center py-2">
          내부 직원은 V2 내부 메뉴에서 확인해 주세요.
        </p>
      </ItemCard>
    );
  }

  return (
    <ItemCard
      icon={<Award size={18} aria-hidden="true" />}
      title="강의확인서"
      hint={`${list.length}건 발급됨 — 클릭하여 PDF 다운로드`}
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3 text-center">
          <p className="text-sm text-slate-500">아직 발급된 강의확인서가 없어요.</p>
          <p className="mt-1 text-[11px] text-slate-400">
            교육 종료 후 담당자가 발급하면 여기에 표시돼요.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((c) => (
            <li key={c.id}>
              {c.pdf_url ? (
                <a
                  href={c.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 px-3 py-2.5 transition-colors"
                >
                  <FileCheck size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1E1B4B] truncate">
                      강의확인서 {c.recipient_name && `· ${c.recipient_name}`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                      발급일 {formatDateKo(c.issue_date)}
                      {c.cert_number && <span> · {c.cert_number}</span>}
                    </p>
                  </div>
                  <Download size={13} className="shrink-0 text-emerald-600" aria-hidden="true" />
                </a>
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <FileCheck size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-500 truncate">
                      강의확인서 {c.recipient_name && `· ${c.recipient_name}`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      PDF 준비 중 — 잠시 후 다시 확인해 주세요.
                    </p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </ItemCard>
  );
}
