// 팀원 역할 변경 모달 — 박경수님 + SkyClaw STEP-RBAC-SETUP (2026-05-28)
// admin 만 사용 가능. 박경수님 환경 6종 role 지원.

import { useEffect, useState } from 'react';
import { Button, Modal } from '../ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  open: boolean;
  memberId: string | null;
  memberName: string;
  currentRole: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const ROLE_OPTIONS: Array<{ value: string; label: string; desc: string }> = [
  { value: 'admin', label: '관리자 (admin)', desc: '전체 권한 — 시스템 관리·역할 변경 가능' },
  { value: 'finance', label: '재무 (finance)', desc: '재무·급여·지출결의서 메뉴 관리' },
  { value: 'pm', label: 'PM (pm)', desc: '담당 프로젝트 견적·지출요청 관리' },
  { value: 'staff', label: '운영 (staff)', desc: '프로그램 운영·태스크 관리' },
  { value: 'partner', label: '컨소시엄 (partner)', desc: '참여기관 — 외부 포털 접근' },
  { value: 'member', label: '팀원 (member)', desc: '기본 조회 + 본인 정보 수정' },
];

export default function MemberRoleModal({ open, memberId, memberName, currentRole, onClose, onSaved }: Props) {
  const toast = useToast();
  const [selected, setSelected] = useState<string>(currentRole ?? 'member');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setSelected(currentRole ?? 'member'); }, [open, currentRole]);

  async function handleSave() {
    if (!memberId) return;
    if (selected === currentRole) { onClose(); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ role: selected }).eq('id', memberId);
    setSaving(false);
    if (error) {
      console.error('[MemberRoleModal] 역할 변경 실패:', error.message);
      toast.error(`역할 변경 실패: ${error.message}`);
      return;
    }
    toast.success(`${memberName} 역할을 ${selected} 로 변경했어요.`);
    onSaved(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`${memberName} 역할 변경`} size="md"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
        <Button variant="primary" onClick={() => void handleSave()} loading={saving}>변경 저장</Button>
      </>}>
      <div className="space-y-2">
        <p className="text-xs text-slate-500 mb-3">현재 역할: <strong className="text-slate-700">{currentRole ?? 'member'}</strong></p>
        {ROLE_OPTIONS.map((opt) => (
          <label key={opt.value}
            className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${selected === opt.value ? 'border-violet-400 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="radio" name="role" value={opt.value} checked={selected === opt.value}
              onChange={() => setSelected(opt.value)} className="mt-1 accent-violet-600" />
            <div>
              <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </Modal>
  );
}
