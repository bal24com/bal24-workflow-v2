// bal24 v2 — STEP-MENTOR-MENTEE-MATCHING
// 교육생 행에서 [담당 멘토] 클릭 → 이 참여자의 mentor 다중 선택.
// 각 선택된 멘토의 mentoring_assignments.mentee_ids에 추가/제거.

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { Modal, Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { getMentorName } from '../../../types/mentoring';
import type { MentoringAssignment } from '../../../types/mentoring';
import type { ProgramParticipant } from '../../../types/database';

interface Props {
  open: boolean;
  programId: string;
  participant: ProgramParticipant | null;
  assignments: MentoringAssignment[];   // 부모가 fetch한 멘토링 배정 목록 전체 전달
  onClose: () => void;
  onSaved: () => void;
}

export default function ParticipantMentorModal({
  open, programId: _programId, participant, assignments, onClose, onSaved,
}: Props) {
  void _programId; // 추후 권한 검증용 — 현재 미사용
  const toast = useToast();
  const [selectedMentorIds, setSelectedMentorIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialIds, setInitialIds] = useState<string[]>([]);

  // 모달 열릴 때: 이 참여자가 현재 어떤 멘토에 배정돼 있는지 계산
  useEffect(() => {
    if (!open || !participant) return;
    const currentMentors = assignments
      .filter((a) => (a.mentee_ids ?? []).includes(participant.id))
      .map((a) => a.id);
    setSelectedMentorIds(currentMentors);
    setInitialIds(currentMentors);
  }, [open, participant, assignments]);

  function toggle(assignmentId: string) {
    setSelectedMentorIds((prev) =>
      prev.includes(assignmentId)
        ? prev.filter((x) => x !== assignmentId)
        : [...prev, assignmentId]);
  }

  // 변경된 멘토 배정만 UPDATE (추가·제거 모두)
  async function handleSave() {
    if (!participant) return;
    const toAdd = selectedMentorIds.filter((id) => !initialIds.includes(id));
    const toRemove = initialIds.filter((id) => !selectedMentorIds.includes(id));
    if (toAdd.length === 0 && toRemove.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    let errors = 0;

    // 추가: 각 멘토 assignment의 mentee_ids에 participant.id 추가 (중복 방지)
    for (const aid of toAdd) {
      const target = assignments.find((a) => a.id === aid);
      if (!target) continue;
      const next = Array.from(new Set([...(target.mentee_ids ?? []), participant.id]));
      const { error } = await supabase.from('mentoring_assignments')
        .update({ mentee_ids: next }).eq('id', aid);
      if (error) {
        console.error('[participant-mentor] 추가 실패:', error.message);
        errors += 1;
      }
    }

    // 제거: 각 멘토 assignment의 mentee_ids에서 participant.id 제거
    for (const aid of toRemove) {
      const target = assignments.find((a) => a.id === aid);
      if (!target) continue;
      const next = (target.mentee_ids ?? []).filter((id) => id !== participant.id);
      const { error } = await supabase.from('mentoring_assignments')
        .update({ mentee_ids: next }).eq('id', aid);
      if (error) {
        console.error('[participant-mentor] 제거 실패:', error.message);
        errors += 1;
      }
    }

    setSaving(false);
    if (errors > 0) {
      toast.error(`${errors}건 저장에 실패했어요.`);
      return;
    }
    toast.success(`${participant.name}님의 담당 멘토를 ${selectedMentorIds.length}명으로 갱신했어요.`);
    onSaved();
    onClose();
  }

  const sortedMentors = useMemo(() => {
    return [...assignments].sort((a, b) => getMentorName(a).localeCompare(getMentorName(b), 'ko'));
  }, [assignments]);

  if (!participant) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${participant.name}님 담당 멘토 배정`}
      description="이 교육생에게 배정할 멘토를 선택해 주세요. 다중 선택 가능."
      size="md"
      closeOnBackdrop={!saving}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            선택 <strong className="text-violet-700 tabular-nums">{selectedMentorIds.length}</strong>명
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              <X size={14} className="mr-1" /> 취소
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              <Save size={14} className="mr-1" /> 저장
            </Button>
          </div>
        </div>
      }
    >
      {sortedMentors.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-10">
          배정된 멘토가 없어요. 먼저 [멘토링] 탭에서 멘토를 등록해 주세요.
        </p>
      ) : saving ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : (
        <ul className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {sortedMentors.map((a) => {
            const checked = selectedMentorIds.includes(a.id);
            const otherCount = (a.mentee_ids ?? []).filter((id) => id !== participant.id).length;
            return (
              <li key={a.id}>
                <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                  checked ? 'bg-violet-50/60' : 'hover:bg-violet-50/30'
                }`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(a.id)}
                    className="w-4 h-4 rounded border-violet-300 text-violet-600 focus:ring-violet-400 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1E1B4B] truncate">{getMentorName(a)}</p>
                    <p className="text-xs text-slate-500">
                      {a.meet_type ?? '미정'} · 다른 멘티 {otherCount}명
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
