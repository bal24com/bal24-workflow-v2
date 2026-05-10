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
import type { CareerItem, CertItem, EducationItem, StaffPool, StaffType } from '../../types/database';

const STORAGE_BUCKET = 'expert-files';

type Props = {
  open: boolean;
  /** STEP-EXPERT-CRUD-FULL — 수정 모드 시 expert 전달, 미전달 시 신규 등록 */
  expert?: StaffPool | null;
  onClose: () => void;
  onCreated: () => void;
};

type FormState = {
  name: string;
  organization: string;
  position: string;
  specialty: string;     // 콤마 구분 입력 → 배열로 저장
  phoneMobile: string;
  phoneOffice: string;
  email: string;
  mainDuties: string;
  careerSummary: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  idNumber: string;       // 주민등록번호
};

const EMPTY: FormState = {
  name: '', organization: '', position: '', specialty: '',
  phoneMobile: '', phoneOffice: '', email: '',
  mainDuties: '', careerSummary: '',
  bankName: '', bankAccount: '', bankHolder: '',
  idNumber: '',
};

function expertToForm(s: StaffPool): FormState {
  return {
    name: s.name ?? '', organization: s.organization ?? '', position: s.position ?? '',
    specialty: (s.specialty ?? []).join(', '),
    phoneMobile: s.phone_mobile ?? '', phoneOffice: s.phone_office ?? '', email: s.email ?? '',
    mainDuties: s.main_duties ?? '', careerSummary: s.career_summary ?? '',
    bankName: s.bank_name ?? '', bankAccount: s.bank_account ?? '', bankHolder: s.bank_holder ?? '',
    idNumber: s.id_number ?? '',
  };
}

function maskIdNumber(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length < 7) return d;
  return `${d.slice(0, 6)}-${d[6]}******`;
}

function translateInsertError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('column') && m.includes('does not exist')) {
    return '전문가 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return '전문가를 등록할 권한이 없어요. 관리자에게 문의해 주세요.';
  }
  return '전문가 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

function translateUploadError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('bucket not found')) return `파일 저장소(${STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`;
  if (m.includes('payload too large') || m.includes('exceeded')) return '파일 용량이 너무 커요.';
  if (m.includes('row-level security') || m.includes('permission denied')) return '파일을 올릴 권한이 없어요.';
  return '파일 업로드 중 오류가 발생했어요.';
}

export default function ExpertFormModal({ open, expert, onClose, onCreated }: Props) {
  const isEdit = Boolean(expert);
  const [form, setForm] = useState<FormState>(EMPTY);
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
      setForm(EMPTY); setPhotoUrl(null); setPhotoName(null);
      setStaffType(''); setResumeUrl('');
      setEducations([]); setCareers([]); setCerts([]);
    }
    setResumeFile(null); setNameError(null); setErrorMsg(null); setInfoMsg(null);
  }, [open, expert]);

  // STEP-DELETE-RESUME-FULL — 이력서 파일을 staff-files 버킷에 업로드 후 publicUrl 반환
  async function uploadResumeIfNeeded(): Promise<string | null> {
    if (!resumeFile) return resumeUrl || null;
    if (resumeFile.size > 10 * 1024 * 1024) { setErrorMsg('이력서 파일 용량이 10MB를 초과해요.'); return null; }
    setResumeUploading(true);
    try {
      const ext = resumeFile.name.includes('.') ? resumeFile.name.split('.').pop() : 'pdf';
      const safeBase = resumeFile.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 60);
      const path = `resumes/${Date.now()}_${safeBase}.${ext}`;
      const up = await supabase.storage.from('staff-files').upload(path, resumeFile, { upsert: false, contentType: resumeFile.type || undefined });
      if (up.error) {
        console.error('[experts] 이력서 업로드 실패:', up.error.message);
        setErrorMsg('이력서 업로드에 실패했어요. (staff-files 버킷이 생성되어 있는지 확인해 주세요)');
        return null;
      }
      return supabase.storage.from('staff-files').getPublicUrl(path).data.publicUrl;
    } finally { setResumeUploading(false); }
  }

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhotoSelected = async (file: File) => {
    setUploading(true);
    setErrorMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 60);
      const path = `profiles/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
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

      const specialtyArr = form.specialty
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const idDigits = form.idNumber.replace(/\D/g, '');
      // 빈 항목 정리 (저장 시 noise 제거)
      const eduClean = educations.filter((e) => e.school.trim() || e.major.trim() || e.year.trim());
      const careerClean = careers.filter((c) => c.company.trim() || c.role.trim() || c.period.trim());
      const certsClean = certs.filter((c) => c.name.trim() || c.issuer.trim() || c.year.trim());

      const payload = {
        name: form.name.trim(),
        organization: form.organization.trim() || null,
        position: form.position.trim() || null,
        specialty: specialtyArr.length ? specialtyArr : null,
        phone_mobile: form.phoneMobile.trim() || null,
        phone_office: form.phoneOffice.trim() || null,
        email: form.email.trim() || null,
        main_duties: form.mainDuties.trim() || null,
        career_summary: form.careerSummary.trim() || null,
        bank_name: form.bankName.trim() || null,
        bank_account: form.bankAccount.trim() || null,
        bank_holder: form.bankHolder.trim() || null,
        id_number: idDigits || null,
        profile_image_url: photoUrl,
        // STEP-EXPERT-CRUD-FULL — 확장 필드
        staff_type: staffType || null,
        // STEP-DELETE-RESUME-FULL — 파일 업로드 결과 우선, 없으면 기존 URL 유지
        resume_url: finalResumeUrl,
        education_history: eduClean,
        career_history: careerClean,
        certifications: certsClean,
      };

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
