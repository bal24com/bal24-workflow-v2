// bal24 v2 — 프로그램 수정 풀 페이지 · ⑧ 만족도 조사 안내
// public_forms (form_type='survey') 발행은 /forms 메뉴.

import { Link } from 'react-router-dom';
import { ExternalLink, MessageSquare } from 'lucide-react';
import CardShell from './CardShell';

export default function SurveyLinkCard() {
  return (
    <CardShell
      step="⑧"
      title="만족도 조사"
      description="설문 폼은 폼 관리 메뉴에서 form_type='설문'으로 발행하세요. 응답은 결과·만족도 탭에서 집계돼요."
    >
      <div className="flex flex-col gap-2">
        <div className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5 flex items-center gap-2">
          <MessageSquare size={14} className="shrink-0 text-violet-500" aria-hidden="true" />
          <p className="flex-1 text-[11px] text-slate-600 leading-relaxed">
            만족도 응답 평균은 <b>프로그램 상세 → 결과·만족도</b> 탭에서 자동 집계됩니다.
          </p>
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
