// bal24 v2 — 프로그램 수정 풀 페이지 · ⑤ 결과물 (외부 링크)
// 별도 등록 X — /forms 메뉴 안내 + 신청 폼은 /apply/:programId 자동.

import { Link } from 'react-router-dom';
import { ExternalLink, FileUp } from 'lucide-react';
import CardShell from './CardShell';

interface Props {
  programId: string;
}

export default function OutcomeLinkCard({ programId }: Props) {
  return (
    <CardShell
      step="⑤"
      title="결과물 외부 링크"
      description="교육생이 외부에서 결과물을 업로드하는 폼은 폼 관리 메뉴에서 발행해요."
    >
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5 flex items-center gap-2">
          <FileUp size={14} className="shrink-0 text-violet-500" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#1E1B4B]">교육생 신청 폼</p>
            <p className="text-[11px] text-slate-500">
              <code className="px-1 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px]">
                /apply/{programId.slice(0, 8)}…
              </code>
              {' '}공개 — 별도 발행 불필요
            </p>
          </div>
        </div>

        <Link
          to="/forms"
          className="self-start inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 hover:border-violet-200 transition-colors"
        >
          <ExternalLink size={12} aria-hidden="true" />
          폼 관리 메뉴 열기
        </Link>
      </div>
    </CardShell>
  );
}
