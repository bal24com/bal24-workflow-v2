// bal24 v2 — 포털 템플릿 등록/수정 모달

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import PortalItemBuilder, { makeItemDraft } from '../PortalItemBuilder';
import type { ItemDraft } from '../PortalItemBuilder';
import { STAGE_LABELS, STAGE_VALUES } from '../portalConstants';
import type {
  PortalAutoDataKey, PortalStageTag, PortalTemplate, PortalTemplateItem,
} from '../../../types/database';

type Props = {
  open: boolean;
  template?: PortalTemplate | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  name: string;
  description: string;
  stageHint: PortalStageTag | '';
  isShared: boolean;
};

const EMPTY: FormState = { name: '', description: '', stageHint: '', isShared: true };

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("could not find the table 'public.portal_templates'") || m.includes('pgrst205')) {
    return '포털 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function PortalTemplateModal({ open, template, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [items, setItems] = useState<ItemDraft[]>([makeItemDraft('file_download')]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (!template) {
      setForm(EMPTY);
      setItems([makeItemDraft('file_download')]);
      return;
    }
    setForm({
      name: template.name,
      description: template.description ?? '',
      stageHint: template.stage_hint ?? '',
      isShared: template.is_shared,
    });
    // 기존 항목 로드
    void supabase.from('portal_template_items')
      .select('*').eq('template_id', template.id).order('sort_order')
      .then(({ data, error }) => {
        if (error) {
          console.error('[portal-template] 항목 조회 실패:', error.message);
          return;
        }
        const drafts: ItemDraft[] = ((data ?? []) as PortalTemplateItem[]).map((d) => ({
          uid: d.id,
          itemType: d.item_type,
          label: d.label,
          description: d.description ?? '',
          autoDataKey: (d.auto_data_key ?? '') as PortalAutoDataKey | '',
          approvalText: d.approval_text ?? '',
          required: d.required,
        }));
        setItems(drafts.length > 0 ? drafts : [makeItemDraft('file_download')]);
      });
  }, [open, template]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.name.trim()) { setErrorMsg('템플릿 이름을 입력해 주세요.'); return; }
    if (items.length === 0) { setErrorMsg('항목을 1개 이상 추가해 주세요.'); return; }

    setSubmitting(true);
    try {
      const tplPayload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        stage_hint: form.stageHint || null,
        is_shared: form.isShared,
      };

      let templateId = template?.id;
      if (template) {
        const { error } = await supabase.from('portal_templates').update(tplPayload).eq('id', template.id);
        if (error) throw error;
        // 기존 항목 전부 삭제 후 재삽입 (간단)
        await supabase.from('portal_template_items').delete().eq('template_id', template.id);
      } else {
        const { data, error } = await supabase.from('portal_templates').insert(tplPayload).select('id').single();
        if (error) throw error;
        templateId = data.id;
      }

      if (templateId && items.length > 0) {
        const rows = items.map((i, idx) => ({
          template_id: templateId,
          item_type: i.itemType,
          label: i.label.trim() || '제목 없음',
          description: i.description.trim() || null,
          auto_data_key: i.autoDataKey || null,
          approval_text: i.approvalText.trim() || null,
          required: i.required,
          sort_order: idx,
        }));
        const { error: iErr } = await supabase.from('portal_template_items').insert(rows);
        if (iErr) console.error('[portal-template] 항목 저장 실패:', iErr.message);
      }

      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portal-template] 저장 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? '템플릿 수정' : '템플릿 만들기'}
      description="자주 쓰는 포털 항목을 묶어 두면 재사용할 수 있어요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="portal-template-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="portal-template-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input label="템플릿 이름" required value={form.name} onChange={(e) => update('name', e.target.value)} disabled={submitting} placeholder="예) 계약 단계 표준 양식" />
        <Input label="설명" value={form.description} onChange={(e) => update('description', e.target.value)} disabled={submitting} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">단계 힌트 (선택)</label>
            <select value={form.stageHint} onChange={(e) => update('stageHint', e.target.value as PortalStageTag | '')}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">미지정</option>
              {STAGE_VALUES.map((s) => (<option key={s} value={s}>{STAGE_LABELS[s]}</option>))}
            </select>
          </div>
          <label className="flex items-end gap-2 text-sm pb-2">
            <input type="checkbox" checked={form.isShared} onChange={(e) => update('isShared', e.target.checked)} disabled={submitting}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30" />
            <span className="font-semibold text-slate-700">팀 공유</span>
            <span className="text-xs text-muted">(다른 사용자가 이 템플릿을 쓸 수 있어요)</span>
          </label>
        </div>

        <PortalItemBuilder items={items} onChange={setItems} disabled={submitting} />

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
