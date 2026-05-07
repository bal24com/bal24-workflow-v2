// bal24 v2 — 프로그램 수정 풀 페이지 · ⑨ 분류·개인정보 안내
// 정적 안내 (DB 저장 X).

import { ShieldCheck } from 'lucide-react';
import CardShell from './CardShell';

export default function ClassificationCard() {
  return (
    <CardShell
      step="⑨"
      title="분류·개인정보"
      description="신청자·참여 인력의 개인정보 처리 원칙."
    >
      <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-orange-50/40 px-3 py-3 flex items-start gap-2">
        <ShieldCheck size={16} className="shrink-0 mt-0.5 text-violet-500" aria-hidden="true" />
        <ul className="flex-1 flex flex-col gap-1.5 text-[11px] text-slate-600 leading-relaxed">
          <li>· 신청자가 외부 폼에서 직접 동의한 정보만 수집됩니다.</li>
          <li>· 주민번호는 마스킹 형태로 저장되며, 결과보고서에는 노출되지 않아요.</li>
          <li>· 인력 매칭 정보(이름·역할·금액)는 내부 운영자만 열람 가능해요.</li>
          <li>· 외부 참여의사 페이지(<code>/curriculum-invite/:token</code>)에서는 본인 정보만 열람·응답 가능해요.</li>
        </ul>
      </div>
    </CardShell>
  );
}
