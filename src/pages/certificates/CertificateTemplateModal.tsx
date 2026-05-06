// bal24 v2 — 수료증/강의확인서 템플릿 설정 모달

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input, FileDropZone } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { uploadSealImage } from './certificateUtils';
import type { CertificateTemplate, CertificateType, Program } from '../../types/database';

type Props = {
  open: boolean;
  programs: Pick<Program, 'id' | 'name'>[];
  defaultProgramId?: string;
  template?: CertificateTemplate | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  programId: string;
  certType: CertificateType;
  title: string;
  institutionName: string;
  signatureName: string;
  validHours: string;
  isDefault: boolean;
  sealUrl: string | null;
  sealName: string | null;
};

const EMPTY = (programId = ''): FormState => ({
  programId,
  certType: 'completion',
  title: '수료증',
  institutionName: '',
  signatureName: '',
  validHours: '',
  isDefault: false,
  sealUrl: null,
  sealName: null,
});

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('foreign key')) return '연결된 프로그램이 유효하지 않아요.';
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function CertificateTemplateModal({
  open, programs, defaultProgramId, template, onClose, onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY(defaultProgramId));
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setForm({
        programId: template.program_id,
        certType: template.cert_type,
        title: template.title,
        institutionName: template.institution_name,
        signatureName: template.signature_name ?? '',
        validHours: template.valid_hours != null ? String(template.valid_hours) : '',
        isDefault: template.is_default,
        sealUrl: template.seal_file_url ?? null,
        sealName: template.seal_file_url ? '직인 이미지' : null,
      });
    } else {
      setForm(EMPTY(defaultProgramId));
    }
    setErrorMsg(null);
  }, [open, template, defaultProgramId]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const handleSealSelected = async (file: File) => {
    setUploading(true);
    setErrorMsg(null);
    try {
      const url = await uploadSealImage(file);
      setForm((p) => ({ ...p, sealUrl: url, sealName: file.name }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '직인 업로드 실패';
      console.error('[cert-template] 직인 업로드 실패:', msg);
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.programId) { setErrorMsg('프로그램을 선택해 주세요.'); return; }
    if (!form.title.trim()) { setErrorMsg('증서 제목을 입력해 주세요.'); return; }
    if (!form.institutionName.trim()) { setErrorMsg('발급 기관명을 입력해 주세요.'); return; }

    let validHours: number | null = null;
    if (form.certType === 'completion' && form.validHours.trim()) {
      const n = Number(form.validHours);
      if (Number.isNaN(n) || n < 0) { setErrorMsg('이수 시간은 0 이상의 숫자여야 해요.'); return; }
      validHours = n;
    }

    setSubmitting(true);
    try {
      // is_default=true면 같은 프로그램·유형의 다른 템플릿을 false로 일괄 갱신
      if (form.isDefault) {
        const { error: clearErr } = await supabase
          .from('certificate_templates')
          .update({ is_default: false })
          .eq('program_id', form.programId)
          .eq('cert_type', form.certType);
        if (clearErr) console.error('[cert-template] 기존 default 해제 실패:', clearErr.message);
      }

      const payload = {
        program_id: form.programId,
        cert_type: form.certType,
        title: form.title.trim(),
        institution_name: form.institutionName.trim(),
        signature_name: form.signatureName.trim() || null,
        valid_hours: validHours,
        is_default: form.isDefault,
        seal_file_url: form.sealUrl,
      };

      const { error } = template
        ? await supabase.from('certificate_templates').update(payload).eq('id', template.id)
        : await supabase.from('certificate_templates').insert(payload);

      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[cert-template] 저장 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={template ? '템플릿 수정' : '템플릿 만들기'}
      description="증서 유형·기관명·직인을 설정해 주세요."
      size="lg"
      closeOnBackdrop={!submitting && !uploading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting || uploading}>취소</Button>
          <Button type="submit" form="cert-template-form" variant="primary" loading={submitting} disabled={uploading}>저장하기</Button>
        </>
      }
    >
      <form id="cert-template-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">프로그램 <span className="text-danger">*</span></label>
            <select
              value={form.programId}
              onChange={(e) => update('programId', e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">선택해 주세요</option>
              {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">증서 유형</label>
            <select
              value={form.certType}
              onChange={(e) => update('certType', e.target.value as CertificateType)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="completion">수료증</option>
              <option value="lecture">강의확인서</option>
            </select>
          </div>
        </div>

        <Input label="증서 제목" required value={form.title} onChange={(e) => update('title', e.target.value)} disabled={submitting} placeholder="예) 수료증" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="발급 기관명" required value={form.institutionName} onChange={(e) => update('institutionName', e.target.value)} disabled={submitting} placeholder="예) (주)밸런스닷" />
          <Input label="서명자 직책·성명" value={form.signatureName} onChange={(e) => update('signatureName', e.target.value)} disabled={submitting} placeholder="예) 대표 박경수" />
        </div>

        {form.certType === 'completion' && (
          <Input
            label="이수 시간"
            inputMode="numeric"
            value={form.validHours}
            onChange={(e) => update('validHours', e.target.value)}
            disabled={submitting}
            placeholder="예) 16"
            helperText="시간 단위. 비우면 증서에 표시 안 함."
          />
        )}

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">직인 이미지 (선택)</label>
          <FileDropZone
            fileUrl={form.sealUrl}
            fileName={form.sealName}
            uploading={uploading}
            onFileSelected={(f) => void handleSealSelected(f)}
            onClear={() => update('sealUrl', null)}
            disabled={submitting}
            enablePaste={false}
            accept="image/*"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => update('isDefault', e.target.checked)}
            disabled={submitting}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          <span className="font-semibold text-slate-700">이 프로그램의 기본 템플릿으로 지정</span>
          <span className="text-xs text-muted">(같은 유형의 다른 기본은 자동 해제)</span>
        </label>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
