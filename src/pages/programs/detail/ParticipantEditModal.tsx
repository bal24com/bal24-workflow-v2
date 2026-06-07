// bal24 v2 — STEP-PARTICIPANTS-LIST-UPDATE: 참여자 수정 모달
// 브랜드 모달: max-w-[560px] rounded-[20px] p-7 bg-[rgba(30,27,75,0.4)] backdrop-blur-sm

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import type { ProgramParticipant, ParticipantStatus } from '../../../types/database';
import {
  PARTICIPANT_STATUS_LABEL,
  PARTICIPANT_STATUS_STYLE,
  BADGE_BASE,
} from '../../../utils/statusStyles';

// 입력·드롭다운에서 노출되는 상태 (inactive 제외 — 레거시용)
const STATUS_OPTIONS: ParticipantStatus[] = [
  'pending', 'active', 'completed', 'incomplete', 'dropped',
];

interface Props {
  participant: ProgramParticipant | null;
  onClose: () => void;
  onSaved: () => void;
}

interface EditForm {
  name: string;
  organization: string;
  phone: string;
  email: string;
  id_number: string;
  status: ParticipantStatus;
}

function fromParticipant(p: ProgramParticipant): EditForm {
  return {
    name:         p.name ?? '',
    organization: p.organization ?? '',
    phone:        p.phone ?? '',
    email:        p.email ?? '',
    id_number:    p.id_number ?? '',
    status:       p.status,
  };
}

export default function ParticipantEditModal({ participant, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (participant) setForm(fromParticipant(participant));
    else setForm(null);
  }, [participant]);

  if (!participant || !form) return null;

  async function handleSave() {
    if (!form || !participant) return;
    if (!form.name.trim()) { toast.error('이름을 입력해 주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('program_participants').update({
      name:         form.name.trim(),
      organization: form.organization.trim() || null,
      phone:        form.phone.trim() || null,
      email:        form.email.trim() || null,
      id_number:    form.id_number.replace(/[^0-9]/g, '') || null,
      status:       form.status,
    }).eq('id', participant.id);
    setSaving(false);
    if (error) {
      console.error('[participant-edit-modal] 수정 실패:', error.message);
      toast.error('수정 중 오류가 발생했어요.');
      return;
    }
    toast.success('수정했어요.');
    onSaved();
    onClose();
  }

  function field(
    label: string,
    key: keyof EditForm,
    opts?: { type?: string; placeholder?: string },
  ) {
    const val = form ? (form[key] as string) : '';
    return (
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-300">{label}</label>
        <input
          type={opts?.type ?? 'text'}
          value={val}
          placeholder={opts?.placeholder}
          onChange={(e) => setForm((prev) => prev ? { ...prev, [key]: e.target.value } : prev)}
          disabled={saving}
          className="w-full h-[42px] px-3 rounded-[10px] border border-white/20 bg-white/10
                     text-white text-sm placeholder:text-white/40
                     focus:outline-none focus:border-violet-400 transition-colors"
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="참여자 수정"
    >
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 모달 */}
      <div
        className="relative w-full max-w-[560px] rounded-[20px] p-7
                   bg-[rgba(30,27,75,0.4)] backdrop-blur-sm shadow-2xl
                   border border-white/10"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-white">참여자 수정</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 현재 상태 배지 */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-white/60">현재 상태:</span>
          <span className={`${BADGE_BASE} ${PARTICIPANT_STATUS_STYLE[form.status]}`}>
            {PARTICIPANT_STATUS_LABEL[form.status]}
          </span>
        </div>

        {/* 필드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {field('이름 *', 'name', { placeholder: '홍길동' })}
          {field('소속', 'organization', { placeholder: '기관·회사명' })}
          {field('연락처', 'phone', { placeholder: '010-0000-0000' })}
          {field('이메일', 'email', { type: 'email', placeholder: 'hong@example.com' })}
          {field('주민번호', 'id_number', { placeholder: '000000-0000000' })}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">상태</label>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => prev ? { ...prev, status: e.target.value as ParticipantStatus } : prev)}
              disabled={saving}
              className="w-full h-[42px] px-3 rounded-[10px] border border-white/20 bg-white/10
                         text-white text-sm focus:outline-none focus:border-violet-400 transition-colors
                         [&>option]:bg-[#1E1B4B] [&>option]:text-white"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{PARTICIPANT_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-[10px] border border-white/20 text-white/70
                       text-sm hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-5 py-2 rounded-[10px] bg-violet-600 text-white text-sm font-bold
                       hover:scale-[1.02] transition-all duration-200 disabled:opacity-40"
          >
            {saving ? '저장 중…' : '수정 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
