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
    if (!consortiumId || !member.id) {
      toast.error('컨소시엄 또는 참여사 정보가 비어 있어요.');
      return;
    }
    setSubmitting(true);
    try {
      // 1) INSERT 시도 (모달은 missingMembers 대상으로만 열리므로 신규 레코드가 정상 케이스)
      const insertPayload = {
        consortium_id: consortiumId,
        member_id: member.id,
        ...perm,
        is_active: true,
      };
      let { error } = await supabase.from('consortium_portal_permissions').insert(insertPayload);

      // 2) 23505 = unique 위반 (이미 행이 있는 케이스) → UPDATE 로 fallback
      if (error?.code === '23505') {
        const upd = await supabase
          .from('consortium_portal_permissions')
          .update({ ...perm, is_active: true, updated_at: new Date().toISOString() })
          .eq('consortium_id', consortiumId)
          .eq('member_id', member.id);
        error = upd.error ?? null;
      }

      if (error) {
        const msg = error.message ?? '';
        const code = (error as { code?: string }).code ?? '';
        console.error('[con-portal-modal] 저장 실패:', code, msg, error);
        const lower = msg.toLowerCase();
        // 테이블 미존재
        if (code === 'PGRST205' || lower.includes("could not find the table") || lower.includes('does not exist')) {
          toast.error('포털 권한 테이블이 아직 없어요. 관리자에게 마이그레이션 적용을 요청해 주세요.');
        }
        // RLS 권한
        else if (code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
          toast.error('포털 권한 저장 권한이 없어요. ADMIN/PM 계정으로 다시 시도해 주세요.');
        }
        // CHECK 제약 (perm 값이 잘못된 경우)
        else if (code === '23514' || lower.includes('check constraint')) {
          toast.error('권한 값이 올바르지 않아요. 페이지를 새로고침 후 다시 시도해 주세요.');
        }
        // 그 외는 실제 메시지 노출 (디버깅용)
        else {
          toast.error(`권한 저장 실패: ${msg || '알 수 없는 오류'}`);
        }
        return;
      }

      // 3) member.portal_enabled 동기화 (실패해도 권한은 저장된 상태이므로 경고만)
      const memberUpd = await supabase
        .from('consortium_members')
        .update({ portal_enabled: true })
        .eq('id', member.id);
      if (memberUpd.error) {
        console.warn('[con-portal-modal] portal_enabled 동기화 실패:', memberUpd.error.message);
      }

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
