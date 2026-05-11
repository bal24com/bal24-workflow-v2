// bal24 v2 — 전문가(staff_pool) 등록·수정 모달
// 기본정보 + 계좌 + 민감정보(주민번호 마스킹) + 프로필 사진 + 명함 인식
// STEP-EXPERT-CRUD-FULL — 학력·경력·자격·이력서 + edit 모드 + soft-delete

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ScanLine, Loader2 } from 'lucide-react';
import { Modal, Button, Input, FileDropZone } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { extractBusinessCardInfo, ClaudeApiKeyMissingError, ClaudeApiError } from '../../lib/claude';
import ExpertFormExtSection from './ExpertFormExtSection';
import {
  EXPERT_STORAGE_BUCKET, EMPTY_EXPERT_FORM, expertToForm, maskIdNumber,
  translateInsertError, translateUploadError, uploadResume, buildExpertPayload,
  type ExpertFormState,
} from './expertFormUtils';
import type { CareerItem, CertItem, EducationItem, StaffPool, StaffType } from '../../types/database';

type Props = {
  open: boolean;
  /** STEP-EXPERT-CRUD-FULL — 수정 모드 시 expert 전달, 미전달 시 신규 등록 */
  expert?: StaffPool | null;
  onClose: () => void;
  onCreated: () => void;
};

export default function ExpertFormModal({ open, expert, onClose, onCreated }: Props) {
  const isEdit = Boolean(expert);
  const [form, setForm] = useState<ExpertFormState>(EMPTY_EXPERT_FORM);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  // STEP-EXPERT-CRUD-FULL — 확장 필드
  const [staffType, setStaffType] = useState<StaffType | ''>('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [educations, setEducations] = useState<EducationItem[]>([]);
  const [careers, setCareers] = useState<CareerItem[]>([]);
  const [certs, setCerts] = useState<CertItem[]>([]);
  // STEP-DELETE-RESUME-FULL — 이력서 파일 업로드 (staff-files 버킷)
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeUploading, setResumeUploading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const cardInputRef = useRef<HTMLInputElement | null>(null);

  // 모달 열릴 때 — expert 있으면 prefill, 없으면 EMPTY
  useEffect(() => {
    if (!open) return;
    if (expert) {
      setForm(expertToForm(expert));
      setPhotoUrl(expert.profile_image_url ?? null);
      setPhotoName(expert.profile_image_url ? '등록된 프로필' : null);
      setStaffType((expert.staff_type ?? '') as StaffType | '');
      setResumeUrl(expert.resume_url ?? '');
      setEducations(expert.education_history ?? []);
      setCareers(expert.career_history ?? []);
      setCerts(expert.certifications ?? []);
    } else {
      setForm(EMPTY_EXPERT_FORM); setPhotoUrl(null); setPhotoName(null);
      setStaffType(''); setResumeUrl('');
      setEducations([]); setCareers([]); setCerts([]);
    }
    setResumeFile(null); setNameError(null); setErrorMsg(null); setInfoMsg(null);
  }, [open, expert]);

  // STEP-V1-SPLIT-FULL — uploadResume 유틸 호출 wrapper (loading 상태 + 에러 메시지만 컴포넌트가 관리)
  async function uploadResumeIfNeeded(): Promise<string | null> {
    setResumeUploading(true);
    try {
      const r = await uploadResume(resumeFile, resumeUrl);
      if (!r.ok) {
        setErrorMsg(r.reason === 'size'
          ? '이력서 파일 용량이 10MB를 초과해요.'
          : '이력서 업로드에 실패했어요. (staff-files 버킷이 생성되어 있는지 확인해 주세요)');
        return null;
      }
      return r.url;
    } finally { setResumeUploading(false); }
  }

  const update = <K extends keyof ExpertFormState>(key: K, value: ExpertFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhotoSelected = async (file: File) => {
    setUploading(true);
    setErrorMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
      const path = `profiles/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage.from(EXPERT_STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(EXPERT_STORAGE_BUCKET).getPublicUrl(path);
      setPhotoUrl(pub.publicUrl);
      setPhotoName(file.name);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[experts] 프로필 사진 업로드 실패:', raw);
      setErrorMsg(translateUploadError(raw));
    } finally {
      setUploading(false);
    }
  };

  const handleScanCard = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setScanning(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const info = await extractBusinessCardInfo(file);
      setForm((prev) => ({
        ...prev,
        name: info.name ?? prev.name,
        organization: info.organization ?? prev.organization,
        position: info.position ?? prev.position,
        phoneMobile: info.phone_mobile ?? prev.phoneMobile,
        phoneOffice: info.phone_office ?? prev.phoneOffice,
        email: info.email ?? prev.email,
      }));
      const filled = [info.name, info.organization, info.position, info.phone_mobile, info.phone_office, info.email].filter(Boolean).length;
      setInfoMsg(`명함에서 ${filled}개 항목을 읽어왔어요. 내용을 확인해 주세요.`);
    } catch (err) {
      if (err instanceof ClaudeApiKeyMissingError) {
        setErrorMsg(err.message);
      } else if (err instanceof ClaudeApiError) {
        setErrorMsg(err.friendlyMessage);
      } else {
        const raw = err instanceof Error ? err.message : '';
        console.error('[experts] 명함 인식 실패:', raw);
        setErrorMsg('명함 인식 중 오류가 발생했어요.');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameError(null);
    setErrorMsg(null);
    if (!form.name.trim()) {
      setNameError('이름을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      // STEP-DELETE-RESUME-FULL — 이력서 파일 우선 업로드. 실패 시 저장 중단.
      const finalResumeUrl = await uploadResumeIfNeeded();
      if (resumeFile && finalResumeUrl === null) { setSubmitting(false); return; }

      const payload = buildExpertPayload({
        form, photoUrl, staffType,
        resumeUrl: finalResumeUrl,
        educations, careers, certs,
      });

      const { error } = isEdit && expert
        ? await supabase.from('staff_pool').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', expert.id)
        : await supabase.from('staff_pool').insert(payload);

      if (error) throw error;
      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error(`[experts] ${isEdit ? '수정' : '등록'} 실패:`, raw);
      setErrorMsg(translateInsertError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '전문가 수정' : '전문가 신규 등록'}
      description={isEdit ? '정보를 수정하고 저장하면 즉시 반영돼요.' : "이름만 필수예요. '명함 인식'으로 빠르게 채울 수 있어요."}
      size="lg"
      closeOnBackdrop={!submitting && !uploading && !scanning}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting || uploading || scanning}>취소</Button>
          <Button type="submit" form="expert-form" variant="primary" loading={submitting} disabled={uploading || scanning}>
            {isEdit ? '수정 완료' : '저장하기'}
          </Button>
        </>
      }
    >
      <form id="expert-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
          <div className="text-xs text-text">
            <span className="font-bold">명함 인식</span> — 이미지를 선택하면 이름·소속·직책·연락처·이메일을 자동으로 입력해요.
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={scanning ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
            onClick={() => cardInputRef.current?.click()}
            disabled={scanning || submitting}
          >
            {scanning ? '인식 중…' : '명함 인식'}
          </Button>
          <input ref={cardInputRef} type="file" accept="image/*" hidden onChange={(e) => void handleScanCard(e)} />
        </div>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">기본 정보</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="이름" required value={form.name} onChange={(e) => update('name', e.target.value)} disabled={submitting} error={nameError} />
            <Input label="소속" value={form.organization} onChange={(e) => update('organization', e.target.value)} disabled={submitting} placeholder="예) ○○대학교 / ○○컨설팅" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="직책" value={form.position} onChange={(e) => update('position', e.target.value)} disabled={submitting} placeholder="예) 교수 / 컨설턴트" />
            <Input label="분야" value={form.specialty} onChange={(e) => update('specialty', e.target.value)} disabled={submitting} placeholder="콤마로 구분 (예: 교육, 컨설팅)" helperText="필터·검색 키워드로 사용돼요." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="휴대폰" value={form.phoneMobile} onChange={(e) => update('phoneMobile', e.target.value)} disabled={submitting} placeholder="010-0000-0000" />
            <Input label="사무실" value={form.phoneOffice} onChange={(e) => update('phoneOffice', e.target.value)} disabled={submitting} />
            <Input label="이메일" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expert-duties" className="text-sm font-semibold text-slate-700">주요업무</label>
            <textarea id="expert-duties" rows={2} value={form.mainDuties} onChange={(e) => update('mainDuties', e.target.value)} disabled={submitting} placeholder="강의 주제·전문 분야 요약" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expert-career" className="text-sm font-semibold text-slate-700">약력</label>
            <textarea id="expert-career" rows={3} value={form.careerSummary} onChange={(e) => update('careerSummary', e.target.value)} disabled={submitting} placeholder="학력·경력·수상 등" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none" />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">계좌</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="은행명" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} disabled={submitting} />
            <Input label="계좌번호" value={form.bankAccount} onChange={(e) => update('bankAccount', e.target.value)} disabled={submitting} />
            <Input label="예금주" value={form.bankHolder} onChange={(e) => update('bankHolder', e.target.value)} disabled={submitting} />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">민감 정보</h3>
          <Input
            label="주민등록번호"
            value={form.idNumber}
            onChange={(e) => update('idNumber', e.target.value)}
            disabled={submitting}
            placeholder="901201-1234567"
            helperText={form.idNumber.replace(/\D/g, '').length >= 7 ? `표시: ${maskIdNumber(form.idNumber)}` : '입력은 전체 / 화면 표시는 자동 마스킹돼요.'}
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">프로필 사진</h3>
          <FileDropZone
            fileUrl={photoUrl}
            fileName={photoName}
            uploading={uploading}
            onFileSelected={(f) => void handlePhotoSelected(f)}
            onClear={() => { setPhotoUrl(null); setPhotoName(null); }}
            disabled={submitting}
            accept="image/*"
          />
        </section>

        {/* STEP-EXPERT-CRUD-FULL + STEP-DELETE-RESUME-FULL — 주 역할 + 학력 + 경력 + 자격 + 이력서 파일 */}
        <ExpertFormExtSection
          staffType={staffType}
          resumeUrl={resumeUrl}
          educations={educations}
          careers={careers}
          certs={certs}
          disabled={submitting}
          onStaffType={setStaffType}
          onResumeUrl={setResumeUrl}
          onEducations={setEducations}
          onCareers={setCareers}
          onCerts={setCerts}
          resumeFile={resumeFile}
          resumeUploading={resumeUploading}
          onResumeFile={setResumeFile}
        />

        {infoMsg && (
          <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-700">{infoMsg}</div>
        )}
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
