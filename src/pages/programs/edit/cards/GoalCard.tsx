// bal24 v2 — 프로그램 수정 풀 페이지 · ④ 성과 목표
// goal_text (text). 결과보고서 빌더 사업개요 섹션에서 자동 인용.

import CardShell, { Field, textareaClass } from './CardShell';
import type { ProgramEditForm } from '../programEditUtils';

interface Props {
  form: ProgramEditForm;
  onChange: <K extends keyof ProgramEditForm>(key: K, value: ProgramEditForm[K]) => void;
}

export default function GoalCard({ form, onChange }: Props) {
  return (
    <CardShell
      step="④"
      title="성과 목표"
      description="이 프로그램이 달성하고자 하는 목표 — 결과보고서 사업개요 섹션에 자동 인용돼요."
    >
      <Field label="목표 본문" hint="정성 목표 + 정량 KPI 자유 작성">
        <textarea
          value={form.goal_text}
          onChange={(e) => onChange('goal_text', e.target.value)}
          placeholder="예) ① 참가자 만족도 4.5점 이상 / ② 수료율 80% 이상 / ③ 결과물 제출 90% 이상"
          className={textareaClass}
        />
      </Field>
    </CardShell>
  );
}
