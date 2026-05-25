// bal24 v2 — 포털 신규 생성/수정 모달
// 템플릿 선택 → 항목 자동 로드 / file_download 항목별 파일 첨부

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal, Button, Input, FileDropZone } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import PortalItemBuilder, { makeItemDraft } from './PortalItemBuilder';
import type { ItemDraft } from './PortalItemBuilder';
import {
  ITEM_TYPE_LABELS, PORTAL_FILES_BUCKET, STAGE_LABELS, STAGE_VALUES,
} from './portalConstants';
import type {
  PortalAutoDataKey, PortalStageTag, PortalTemplate, PortalTemplateItem, ProjectPortal,
} from '../../types/database';

type Props = {
  open: boolean;
  projectId: string;
  /** 프로젝트의 client_id (세금계산서 항목 사전 체크용) */
  clientId?: string | null;
  portal?: ProjectPortal | null;
  onClose: () => void;
  /** 저장 후 호출 — 신규/수정된 포털 id 를 전달 (계약 자동 연결 등에 활용) */
  onSaved: (portalId?: string) => void;
};

type FormState = {
  title: string;
  message: string;
  stageTag: PortalStageTag | '';
  expiresAt: string;
  isActive: boolean;
};

type ItemDraftWithFile = ItemDraft & { fileUrl?: string; fileName?: string };

const EMPTY: FormState = { title: '', message: '', stageTag: '', expiresAt: '', isActive: true };

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("could not find the table") || m.includes('pgrst205')) {
    return '포털 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function PortalCreateModal({
  open, projectId, clientId, portal, onClose, onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [items, setItems] = useState<ItemDraftWithFile[]>([]);
  const [templates, setTemplates] = useState<PortalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [hasBusinessNumber, setHasBusinessNumber] = useState<boolean | null>(null);
  const [uploadingUid, setUploadingUid] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (portal) {
      setForm({
        title: portal.title,
        message: portal.message ?? '',
        stageTag: portal.stage_tag ?? '',
        expiresAt: portal.expires_at ? portal.expires_at.slice(0, 16) : '',
        isActive: portal.is_active,
      });
      setSelectedTemplateId(portal.template_id ?? '');
      // 기존 portal_items 로드 (수정 모드)
      void supabase.from('portal_items').select('*').eq('portal_id', portal.id).order('sort_order')
        .then(({ data }) => {
          const drafts: ItemDraftWithFile[] = (data ?? []).map((d) => ({
            uid: d.id,
            itemType: d.item_type,
            label: d.label,
            description: d.description ?? '',
            autoDataKey: (d.auto_data_key ?? '') as PortalAutoDataKey | '',
            approvalText: d.approval_text ?? '',
            required: d.required,
            fileUrl: d.file_url ?? undefined,
            fileName: d.file_name ?? undefined,
          }));
          setItems(drafts);
        });
    } else {
      // 신규 모드 — 프로젝트명 자동 prefill (박경수님 요청: 기존 프로젝트 정보 가져오기)
      setForm(EMPTY);
      setItems([makeItemDraft('file_download')]);
      setSelectedTemplateId('');
      void supabase.from('projects').select('name').eq('id', projectId).maybeSingle()
        .then(({ data }) => {
          const projectName = (data as { name: string } | null)?.name;
          if (projectName) setForm((p) => ({ ...p, title: `${projectName} 계약 자료` }));
        });
    }

    void supabase.from('portal_templates').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setTemplates((data ?? []) as PortalTemplate[]));

    if (clientId) {
      void supabase.from('clients').select('business_number').eq('id', clientId).maybeSingle()
        .then(({ data }) => setHasBusinessNumber(Boolean(data?.business_number?.trim())));
    } else {
      setHasBusinessNumber(null);
    }
  }, [open, portal, clientId]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));

  const applyTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const { data, error } = await supabase
      .from('portal_template_items').select('*')
      .eq('template_id', templateId).order('sort_order');
    if (error) { console.error('[portal-create] 템플릿 항목 조회 실패:', error.message); return; }
    const drafts: ItemDraftWithFile[] = ((data ?? []) as PortalTemplateItem[]).map((d) => ({
      uid: `${Date.now()}_${Math.random()}`,
      itemType: d.item_type,
      label: d.label,
      description: d.description ?? '',
      autoDataKey: (d.auto_data_key ?? '') as PortalAutoDataKey | '',
      approvalText: d.approval_text ?? '',
      required: d.required,
    }));
    setItems(drafts);
  };

  const uploadFileForItem = async (uid: string, file: File) => {
    setUploadingUid(uid);
    setErrorMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
      const path = `${projectId}/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage.from(PORTAL_FILES_BUCKET).upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(PORTAL_FILES_BUCKET).getPublicUrl(path);
      setItems((prev) => prev.map((i) => i.uid === uid ? { ...i, fileUrl: pub.publicUrl, fileName: file.name } : i));
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portal-create] 파일 업로드 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('bucket not found')) setErrorMsg(`파일 저장소(${PORTAL_FILES_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`);
      else setErrorMsg('파일 업로드 중 오류가 발생했어요.');
    } finally {
      setUploadingUid(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.title.trim()) { setErrorMsg('포털 제목을 입력해 주세요.'); return; }
    if (items.length === 0) { setErrorMsg('항목을 1개 이상 추가해 주세요.'); return; }

    setSubmitting(true);
    try {
      const portalPayload = {
        project_id: projectId,
        template_id: selectedTemplateId || null,
        title: form.title.trim(),
        message: form.message.trim() || null,
        stage_tag: form.stageTag || null,
        is_active: form.isActive,
        expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      };

      let portalId = portal?.id;
      if (portal) {
        const { error } = await supabase.from('project_portals').update(portalPayload).eq('id', portal.id);
        if (error) throw error;
        await supabase.from('portal_items').delete().eq('portal_id', portal.id);
      } else {
        const { data, error } = await supabase.from('project_portals').insert(portalPayload).select('id').single();
        if (error) throw error;
        portalId = data.id;
      }

      if (portalId && items.length > 0) {
        const rows = items.map((i, idx) => ({
          portal_id: portalId,
          item_type: i.itemType,
          label: i.label.trim() || '제목 없음',
          description: i.description.trim() || null,
          auto_data_key: i.autoDataKey || null,
          approval_text: i.approvalText.trim() || null,
          file_url: i.fileUrl ?? null,
          file_name: i.fileName ?? null,
          required: i.required,
          sort_order: idx,
        }));
        const { error: iErr } = await supabase.from('portal_items').insert(rows);
        if (iErr) console.error('[portal-create] 항목 저장 실패:', iErr.message);
      }

      onSaved(portalId);
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portal-create] 저장 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  const hasTaxInvoiceItem = items.some((i) => i.itemType === 'tax_invoice');
  const showTaxWarning = hasTaxInvoiceItem && hasBusinessNumber === false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={portal ? '포털 수정' : '포털 만들기'}
      description="고객사가 외부에서 접속하여 자료를 받고 회신할 수 있어요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="portal-create-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="portal-create-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input label="포털 제목" required value={form.title} onChange={(e) => update('title', e.target.value)} disabled={submitting} placeholder="예) 2026 OO프로젝트 계약 자료" />
        <div className="space-y-1.5">
          <label htmlFor="portal-msg" className="text-sm font-semibold text-slate-700">안내 메시지 (선택)</label>
          <textarea id="portal-msg" rows={2} value={form.message} onChange={(e) => update('message', e.target.value)} disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">단계 태그</label>
            <select value={form.stageTag} onChange={(e) => update('stageTag', e.target.value as PortalStageTag | '')}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">미지정</option>
              {STAGE_VALUES.map((s) => (<option key={s} value={s}>{STAGE_LABELS[s]}</option>))}
            </select>
          </div>
          <Input type="datetime-local" label="만료일 (선택)" value={form.expiresAt} onChange={(e) => update('expiresAt', e.target.value)} disabled={submitting} />
          <label className="flex items-end gap-2 text-sm pb-2">
            <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} disabled={submitting}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30" />
            <span className="font-semibold text-slate-700">활성</span>
          </label>
        </div>

        {!portal && templates.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">템플릿 선택 (선택사항)</label>
            <select value={selectedTemplateId} onChange={(e) => void applyTemplate(e.target.value)} disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">직접 구성</option>
              {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
            <p className="text-xs text-muted">템플릿 선택 시 기존 항목이 덮어써져요.</p>
          </div>
        )}

        {showTaxWarning && (
          <div role="alert" className="rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning">
            ⚠ 세금계산서 요청 항목이 있는데 고객사 사업자등록번호가 없어요. 저장은 가능하지만 발행 단계에서 막혀요.
          </div>
        )}

        <PortalItemBuilder
          items={items}
          onChange={(next) => setItems(next as ItemDraftWithFile[])}
          disabled={submitting}
          renderExtras={(it) => {
            if (it.itemType !== 'file_download') return null;
            const draft = items.find((i) => i.uid === it.uid);
            return (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">첨부 파일</label>
                <FileDropZone
                  fileUrl={draft?.fileUrl ?? null}
                  fileName={draft?.fileName ?? null}
                  uploading={uploadingUid === it.uid}
                  onFileSelected={(f) => void uploadFileForItem(it.uid, f)}
                  onClear={() => setItems((prev) => prev.map((i) => i.uid === it.uid ? { ...i, fileUrl: undefined, fileName: undefined } : i))}
                  disabled={submitting}
                  enablePaste={false}
                />
              </div>
            );
          }}
        />

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}

        {uploadingUid && (
          <div className="text-xs text-primary inline-flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" />업로드 중…
          </div>
        )}

        <p className="text-xs text-muted">
          항목 유형 안내: {Object.values(ITEM_TYPE_LABELS).join(' / ')}
        </p>
      </form>
    </Modal>
  );
}
