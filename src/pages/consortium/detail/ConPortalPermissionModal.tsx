// bal24 v2 — 컨소시엄 포털 권한 설정 모달 (STEP-CON-D 후속)
// 참여사 1곳을 받아 6 섹션 권한 (none/read/write/manage) 직접 선택 후 INSERT.
// 민감 섹션 (재무·인력) 은 ⚠ 표시 + 빨간 배경.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import {
  PERM_LEVEL, PERM_LEVEL_LABEL,
  MEMBER_TYPE_LABEL, MEMBER_TYPE_STYLE,
  type ConsortiumMember, type MemberType, type PermLevel,
} from '../consortiumTypes';

interface PermDraft {
  perm_overview: PermLevel;
  perm_programs: PermLevel;
  perm_tasks: PermLevel;
  perm_finance: PermLevel;
  perm_staff: PermLevel;
  perm_links: PermLevel;
}

const FIELDS: Array<{ key: keyof PermDraft; label: string; sensitive?: boolean }> = [
  { key: 'perm_overview', label: '개요' },
  { key: 'perm_programs', label: '프로그램' },
  { key: 'perm_tasks', label: '태스크' },
  { key: 'perm_finance', label: '재무', sensitive: true },
  { key: 'perm_staff', label: '인력', sensitive: true },
  { key: 'perm_links', label: '링크' },
];

const DEFAULT_PERM: PermDraft = {
  perm_overview: 'read',
  perm_programs: 'read',
  perm_tasks: 'read',
  perm_finance: 'none',
  perm_staff: 'none',
  perm_links: 'none',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  consortiumId: string;
  member: ConsortiumMember | null;
}

export default function ConPortalPermissionModal({
  open, onClose, onSaved, consortiumId, member,
}: Props) {
  const toast = useToast();
  const [perm, setPerm] = useState<PermDraft>(DEFAULT_PERM);
  const [submitting, setSubmitting] = useState(false);

  // 모달 열릴 때마다 초기값 리셋
  useEffect(() => {
    if (!open) return;
    setPerm(DEFAULT_PERM);
    setSubmitting(false);
  }, [open, member?.id]);

  if (!open || !member) return null;

  const memberType = (member.member_type ?? 'observer') as MemberType;

  const update = <K extends keyof PermDraft>(key: K, value: PermDraft[K]) => {
    setPerm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // INSERT — 미존재 행만 추가하므로 onConflict 없음. 동일 member 중복 시 unique 제약이면 UPSERT.
      // 안전을 위해 upsert(onConflict=member_id+consortium_id) 사용.
      const { error } = await supabase
        .from('consortium_portal_permissions')
        .upsert(
          {
            consortium_id: consortiumId,
            member_id: member.id,
            ...perm,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'consortium_id,member_id' },
        );
      if (error) {
        console.error('[con-portal-modal] 저장 실패:', error.message);
        // unique 제약이 다른 경우 일반 INSERT 로 fallback
        const fallback = await supabase.from('consortium_portal_permissions').insert({
          consortium_id: consortiumId,
          member_id: member.id,
          ...perm,
          is_active: true,
        });
        if (fallback.error) {
          console.error('[con-portal-modal] fallback INSERT 실패:', fallback.error.message);
          toast.error('권한 저장 중 오류가 발생했어요.');
          return;
        }
      }
      // member.portal_enabled 동기화
      await supabase.from('consortium_members').update({ portal_enabled: true }).eq('id', member.id);
      toast.success('권한 설정을 저장했어요.');
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="포털 권한 설정"
      description="참여사가 컨소시엄 포털에서 볼 수 있는 섹션을 정해 주세요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="con-perm-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="con-perm-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* 참여사 (읽기 전용) */}
        <section className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 flex items-center gap-2">
          <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${MEMBER_TYPE_STYLE[memberType]}`}>
            {MEMBER_TYPE_LABEL[memberType]}
          </span>
          <span className="text-sm font-bold text-[#1E1B4B] truncate">
            {member.clients?.name ?? '미지정'}
          </span>
        </section>

        {/* 6 섹션 권한 */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label, sensitive }) => (
            <div key={key} className="space-y-1.5">
              <label className={`text-sm font-semibold ${sensitive ? 'text-rose-600' : 'text-slate-700'}`}>
                {label}{sensitive && ' ⚠'}
              </label>
              <select
                value={perm[key]}
                onChange={(e) => update(key, e.target.value as PermLevel)}
                disabled={submitting}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${
                  sensitive && perm[key] !== 'none'
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                {PERM_LEVEL.map((lv) => (
                  <option key={lv} value={lv}>{PERM_LEVEL_LABEL[lv]}</option>
                ))}
              </select>
            </div>
          ))}
        </section>

        <p className="text-xs text-slate-500">
          ⚠ 표시는 민감 정보 (재무·인력) — 신중히 권한 부여해 주세요. 저장 후에도 매트릭스에서 변경 가능해요.
        </p>
      </form>
    </Modal>
  );
}
