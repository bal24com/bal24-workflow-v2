// bal24 v2 — 차시 행 강사·멘토 다중 태그 셀 (CurriculumAiDropZone V-1 분리)
//   STEP-UX-FIXES — [+ 강사/멘토] 클릭 시 StaffSearchModal로 인력풀 검색·선택
//   미등록 이름은 모달의 "직접 추가"로 manual 태그로 추가 가능

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, Plus, X } from 'lucide-react';
import StaffSearchModal, { type SelectedPerson } from '../../../../components/ui/StaffSearchModal';
import type { MatchedInstructor } from '../../../../lib/instructorMatch';
import type { CurriculumStaffRole } from '../../../../types/database';

interface Props {
  names: string[];
  matches: Record<string, MatchedInstructor>;
  onChange: (names: string[], matches: Record<string, MatchedInstructor>) => void;
  placeholder: string;
  /** '강사' | '멘토' 등 — StaffSearchModal에 전달 */
  role?: CurriculumStaffRole;
}

function personToMatch(p: SelectedPerson): MatchedInstructor {
  if (p.sourceType === 'staff_pool') return { staff_pool_id: p.id, matched_name: p.name, source: 'staff_pool' };
  if (p.sourceType === 'profile')    return { profile_id: p.id,    matched_name: p.name, source: 'profile' };
  return { source: 'none' }; // manual — 미매칭 (rose 태그)
}

export default function InstructorMentorCell({ names, matches, onChange, placeholder, role }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  function removeAt(idx: number) {
    const next = names.filter((_, i) => i !== idx);
    const m = { ...matches };
    delete m[names[idx]];
    onChange(next, m);
  }

  function handleSelect(p: SelectedPerson) {
    const v = p.name.trim();
    if (!v || names.includes(v)) return;
    const m = v === '전체' ? ({ source: 'none' } as MatchedInstructor) : personToMatch(p);
    onChange([...names, v], { ...matches, [v]: m });
  }

  const excludeIds = names
    .map((n) => matches[n])
    .filter((m): m is MatchedInstructor => Boolean(m))
    .map((m) => m.staff_pool_id ?? m.profile_id ?? '')
    .filter(Boolean);

  return (
    <div className="flex items-center flex-wrap gap-1">
      {names.map((n, i) => {
        const m = matches[n];
        const isMatched = m && m.source !== 'none';
        const isGeneral = n === '전체';
        return (
          <span key={i}
            className={[
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
              isGeneral ? 'bg-amber-100 text-amber-700'
                : isMatched ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700',
            ].join(' ')}
            title={isGeneral ? '전체 (매칭 X)' : isMatched ? `${m.source === 'staff_pool' ? '인력풀' : '임직원'} 매칭` : '미매칭 — 등록 후 [강사 요청]'}>
            {isGeneral
              ? <AlertTriangle size={9} aria-hidden="true" />
              : isMatched
                ? <CheckCircle2 size={9} aria-hidden="true" />
                : <AlertTriangle size={9} aria-hidden="true" />}
            <span>{n}</span>
            <button type="button" onClick={() => removeAt(i)} aria-label="제거"
              className="ml-0.5 opacity-60 hover:opacity-100">
              <X size={8} aria-hidden="true" />
            </button>
          </span>
        );
      })}
      <button type="button" onClick={() => setModalOpen(true)} aria-label={`${placeholder} 추가`}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] text-violet-600 hover:bg-violet-50 border border-dashed border-violet-300">
        <Plus size={9} aria-hidden="true" /> {placeholder}
      </button>
      <StaffSearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelect}
        role={role ?? (placeholder === '멘토' ? '멘토' : '강사')}
        excludeIds={excludeIds}
        allowManual
      />
    </div>
  );
}
