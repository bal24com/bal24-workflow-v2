// bal24 v2 — 프로그램 수정 풀 페이지 · ① 교육 개요
// name·type·project_id·description.

import { useEffect, useState } from 'react';
import CardShell, { Field, inputClass, textareaClass } from './CardShell';
import { PROGRAM_TYPE_VALUES } from '../../programStatus';
import {
  fetchProjectOptions, type ProjectOption, type ProgramEditForm, type ProgramVisibility,
} from '../programEditUtils';
import type { ProgramType } from '../../../../types/database';

const VISIBILITY_OPTIONS: { value: ProgramVisibility; label: string; desc: string }[] = [
  { value: 'internal', label: '팀 내부 공개', desc: '로그인한 팀원 전체 조회 가능' },
  { value: 'private',  label: '배정자 한정',  desc: '배정 담당자·강사·멘토만' },
  { value: 'public',   label: '외부 공개',    desc: '외부 링크로도 접근 가능' },
];

interface Props {
  form: ProgramEditForm;
  onChange: <K extends keyof ProgramEditForm>(key: K, value: ProgramEditForm[K]) => void;
  errorField?: keyof ProgramEditForm;
}

export default function OverviewCard({ form, onChange, errorField }: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await fetchProjectOptions();
      if (cancelled) return;
      setProjects(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CardShell
      step="①"
      title="교육 개요"
      description="프로그램의 기본 정보입니다. 이름·유형·연결 프로젝트·요약 설명."
    >
      <Field label="프로그램명" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="예) 2026 상반기 글로벌 마케팅 캠프"
          className={`${inputClass} ${errorField === 'name' ? 'border-rose-400 focus:border-rose-500' : ''}`}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="유형" required>
          <select
            value={form.type}
            onChange={(e) => onChange('type', e.target.value as ProgramType)}
            className={inputClass}
          >
            {PROGRAM_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="연결 프로젝트" hint="선택 — 프로젝트 단위 운영 시 지정">
          <select
            value={form.project_id ?? ''}
            onChange={(e) => onChange('project_id', e.target.value || null)}
            className={inputClass}
          >
            <option value="">미연결</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="가시성" hint="프로그램을 누구에게 노출할지 (RLS 자동 적용)">
        <select
          value={form.visibility}
          onChange={(e) => onChange('visibility', e.target.value as ProgramVisibility)}
          className={inputClass}
        >
          {VISIBILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
          ))}
        </select>
      </Field>

      <Field label="요약 설명" hint="간단한 소개 — 외부 신청 폼에 노출될 수 있어요">
        <textarea
          value={form.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="프로그램 소개·대상·기대 효과 등"
          className={textareaClass}
        />
      </Field>
    </CardShell>
  );
}
