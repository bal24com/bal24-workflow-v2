// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE 2차 — 체크리스트 항목 추가·수정 모달.
// 6종 타입 + 노출 역할 + 액션 역할 + 필수 여부.

import { useEffect, useRef, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { ITEM_TYPE_LABEL, ROLE_LABEL, type PortalRole } from './portalUtils';

interface ItemRow {
  id: string;
  item_type: string;
  label: string | null;
  title: string | null;
  description: string | null;
  file_url: string | null;
  visible_roles: string[] | null;
  actionable_roles: string[] | null;
  required: boolean | null;
  sort_order: number | null;
}

interface Props {
  portalId: string;
  item: ItemRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES = ['file_download', 'file_upload', 'text_info', 'feedback', 'approval', 'auto_data'] as const;
const ROLES: PortalRole[] = ['admin', 'operator', 'supporter', 'beneficiary_org', 'participant'];

export default function PortalItemFormModal({ portalId, item, onClose, onSaved }: Props) {
  const toast = useToast();
  const [itemType, setItemType] = useState<string>(item?.item_type ?? 'text_info');
  const [title, setTitle] = useState<string>(item?.title ?? item?.label ?? '');
  const [description, setDescription] = useState<string>(item?.description ?? '');
  const [fileUrl, setFileUrl] = useState<string>(item?.file_url ?? '');
  const [visibleRoles, setVisibleRoles] = useState<PortalRole[]>(
    (item?.visible_roles as PortalRole[] | null) ?? [...ROLES],
  );
  const [actionableRoles, setActionableRoles] = useState<PortalRole[]>(
    (item?.actionable_roles as PortalRole[] | null) ?? [...ROLES],
  );
  const [required, setRequired] = useState<boolean>(item?.required ?? false);
  const [saving, setSaving] = useState(false);

  // mousedown-on-backdrop 패턴 — 텍스트 드래그 닫힘 방지
  const mouseDownOnBackdrop = useRef(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleRole(roles: PortalRole[], setter: (r: PortalRole[]) => void, role: PortalRole) {
    setter(roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role]);
  }

  async function handleSave() {
    if (!title.trim()) { toast.error('제목을 입력해 주세요.'); return; }
    if (visibleRoles.length === 0) { toast.error('노출 역할 1개 이상 선택해 주세요.'); return; }
    setSaving(true);
    const payload = {
      portal_id: portalId,
      item_type: itemType,
      title: title.trim(),
      label: title.trim(),       // 기존 컬럼 호환
      description: description.trim() || null,
      file_url: itemType === 'file_download' ? (fileUrl.trim() || null) : null,
      visible_roles: visibleRoles,
      actionable_roles: actionableRoles,
      required,
    };
    const { error } = item
      ? await supabase.from('portal_items').update(payload).eq('id', item.id)
      : await supabase.from('portal_items').insert(payload);
    setSaving(false);
    if (error) {
      console.error('[PortalItemForm] 저장 실패:', error.message);
      toast.error('항목 저장에 실패했어요.');
      return;
    }
    toast.success(item ? '수정 완료' : '항목을 추가했어요.');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1E1B4B]">{item ? '항목 수정' : '체크리스트 항목 추가'}</h3>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="p-1 rounded hover:bg-slate-100"><X size={16} aria-hidden="true" /></button>
        </header>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">항목 유형</label>
            <select value={itemType} onChange={(e) => setItemType(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white outline-none focus:border-violet-500">
              {TYPES.map((t) => <option key={t} value={t}>{ITEM_TYPE_LABEL[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">제목 *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 사업계획서 제출"
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">설명 (선택)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="외부 사용자에게 보여줄 안내문"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
          </div>

          {itemType === 'file_download' && (
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">파일 URL</label>
              <input type="text" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">노출 역할 (이 역할에게 보임)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ROLES.map((r) => (
                <label key={r} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-100 bg-violet-50/40 cursor-pointer text-xs">
                  <input type="checkbox" checked={visibleRoles.includes(r)}
                    onChange={() => toggleRole(visibleRoles, setVisibleRoles, r)}
                    className="rounded text-violet-600" />
                  {ROLE_LABEL[r]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">액션 권한 (제출·다운로드 가능)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {ROLES.map((r) => (
                <label key={r} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/40 cursor-pointer text-xs">
                  <input type="checkbox" checked={actionableRoles.includes(r)}
                    onChange={() => toggleRole(actionableRoles, setActionableRoles, r)}
                    className="rounded text-slate-600" />
                  {ROLE_LABEL[r]}
                </label>
              ))}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)}
              className="rounded text-rose-600" />
            <span className="text-slate-700 font-semibold">필수 항목으로 표시</span>
          </label>
        </div>

        <footer className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 h-10 rounded-lg text-sm text-slate-600 hover:bg-slate-100">취소</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} aria-hidden="true" />}
            {item ? '수정' : '추가'}
          </button>
        </footer>
      </div>
    </div>
  );
}
