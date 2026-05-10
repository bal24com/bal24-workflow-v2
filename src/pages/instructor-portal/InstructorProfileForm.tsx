// bal24 v2 — STEP-INSTRUCTOR-INVITE-A 강사 외부 프로필 입력 폼 (AI 자동채우기 + 동의)

import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Paperclip } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sanitizeFileName } from '../../components/files/sharedFilesUtils';
import {
  extractInstructorFromFile, applyExtractedInstructor,
} from '../../lib/instructorProfileUtils';
import { INSTRUCTOR_FILES_BUCKET } from './invitationUtils';
import { Field, DynamicList, FileUploadRow } from './instructorProfileFormParts';
import type {
  InstructorInvitation, InstructorCareerEntry, InstructorAwardEntry,
} from '../../types/database';

interface Props {
  invitation: InstructorInvitation;
  onSubmitted: () => void;
}

interface FormState {
  real_name: string;
  phone: string;
  email: string;
  id_number: string;
  bio: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  career: InstructorCareerEntry[];
  awards: InstructorAwardEntry[];
  photo_url: string | null;
  bankbook_url: string | null;
  id_card_url: string | null;
  lecture_file_url: string | null;
  privacy_agreed: boolean;
}

const EMPTY: FormState = {
  real_name: '', phone: '', email: '', id_number: '', bio: '',
  bank_name: '', bank_account: '', bank_holder: '',
  career: [], awards: [],
  photo_url: null, bankbook_url: null, id_card_url: null, lecture_file_url: null,
  privacy_agreed: false,
};

type FileField = 'photo_url' | 'bankbook_url' | 'id_card_url' | 'lecture_file_url';
const FILE_LABELS: Record<FileField, string> = {
  photo_url: '프로필 사진',
  bankbook_url: '통장 사본',
  id_card_url: '신분증 사본',
  lecture_file_url: '강의 교안',
};

export default function InstructorProfileForm({ invitation, onSubmitted }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<FileField | null>(null);
  const aiInputRef = useRef<HTMLInputElement | null>(null);

  // 마운트 시 인력풀(profile_id) 자동채우기 + 기존 instructor_profiles 로드
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: existing } = await supabase
        .from('instructor_profiles').select('*').eq('invitation_id', invitation.id).maybeSingle();
      if (cancelled) return;
      if (existing) {
        setForm({
          real_name: existing.real_name ?? '',
          phone: existing.phone ?? '',
          email: existing.email ?? '',
          id_number: existing.id_number ?? '',
          bio: existing.bio ?? '',
          bank_name: existing.bank_name ?? '',
          bank_account: existing.bank_account ?? '',
          bank_holder: existing.bank_holder ?? '',
          career: (existing.career_json ?? []) as InstructorCareerEntry[],
          awards: (existing.awards_json ?? []) as InstructorAwardEntry[],
          photo_url: existing.photo_url ?? null,
          bankbook_url: existing.bankbook_url ?? null,
          id_card_url: existing.id_card_url ?? null,
          lecture_file_url: existing.lecture_file_url ?? null,
          privacy_agreed: existing.privacy_agreed ?? false,
        });
        return;
      }
      // 신규 — invitation 정보로 1차 채움
      setForm((p) => ({ ...p, real_name: invitation.name ?? '', phone: invitation.phone ?? '', email: invitation.email ?? '' }));
      // 인력풀 매칭된 경우 profiles 추가 채움
      if (invitation.profile_id) {
        const { data: prof } = await supabase
          .from('profiles').select('name, phone, email').eq('id', invitation.profile_id).maybeSingle();
        if (cancelled) return;
        if (prof) setForm((p) => ({
          ...p,
          real_name: p.real_name || (prof.name ?? ''),
          phone: p.phone || (prof.phone ?? ''),
          email: p.email || (prof.email ?? ''),
        }));
      }
    })();
    return () => { cancelled = true; };
  }, [invitation.id, invitation.profile_id, invitation.name, invitation.phone, invitation.email]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleAiRun() {
    if (!aiFile) return;
    setAiRunning(true);
    try {
      const prof = await extractInstructorFromFile(aiFile);
      const count = applyExtractedInstructor(prof, {
        setRealName:    (v) => patch('real_name', v),
        setPhone:       (v) => patch('phone', v),
        setEmail:       (v) => patch('email', v),
        setBio:         (v) => patch('bio', v),
        setBankName:    (v) => patch('bank_name', v),
        setBankAccount: (v) => patch('bank_account', v),
        setBankHolder:  (v) => patch('bank_holder', v),
      });
      setErrorMsg(count > 0 ? null : '자동채우기에 실패했어요. 직접 입력해 주세요.');
    } finally {
      setAiRunning(false);
    }
  }

  async function handleFileUpload(field: FileField, file: File) {
    setUploadingField(field);
    setErrorMsg(null);
    try {
      const safe = sanitizeFileName(file.name);
      const path = `${invitation.id}/${field}_${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from(INSTRUCTOR_FILES_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      patch(field, path);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[instructor-profile] 파일 업로드 실패:', raw);
      setErrorMsg('파일 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUploadingField(null);
    }
  }

  async function handleSubmit() {
    if (!form.real_name.trim()) { setErrorMsg('이름(실명)을 입력해 주세요.'); return; }
    if (!form.phone.trim())     { setErrorMsg('연락처를 입력해 주세요.'); return; }
    if (!form.id_number.trim()) { setErrorMsg('주민번호를 입력해 주세요. (강사료 신고용)'); return; }
    if (!form.bank_name.trim() || !form.bank_account.trim() || !form.bank_holder.trim()) {
      setErrorMsg('강사료 입금 정보(은행·계좌·예금주)를 모두 입력해 주세요.'); return;
    }
    if (!form.privacy_agreed) { setErrorMsg('개인정보 수집·이용에 동의해 주세요.'); return; }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('instructor_profiles').upsert({
        invitation_id: invitation.id,
        profile_id: invitation.profile_id ?? null,
        real_name: form.real_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        id_number: form.id_number.trim() || null,
        bio: form.bio.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_account: form.bank_account.trim() || null,
        bank_holder: form.bank_holder.trim() || null,
        career_json: form.career,
        awards_json: form.awards,
        photo_url: form.photo_url,
        bankbook_url: form.bankbook_url,
        id_card_url: form.id_card_url,
        lecture_file_url: form.lecture_file_url,
        privacy_agreed: true,
        privacy_agreed_at: now,
        submitted: true,
        submitted_at: now,
        updated_at: now,
      }, { onConflict: 'invitation_id' });
      if (error) throw error;
      onSubmitted();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[instructor-profile] 제출 실패:', raw);
      setErrorMsg('제출 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 space-y-5">
      <header className="space-y-1">
        <h2 className="text-lg font-bold text-text">강사 프로필 입력</h2>
        <p className="text-xs text-muted">강사료 지급·세무 신고를 위해 정보를 입력해 주세요.</p>
      </header>

      {/* 섹션 1 — AI 자동채우기 */}
      <section className="rounded-xl bg-violet-50 border border-violet-200 p-4 space-y-2">
        <p className="text-sm font-bold text-violet-800 inline-flex items-center gap-1">
          <Sparkles size={14} aria-hidden="true" /> 이력서·명함으로 자동채우기 (선택)
        </p>
        <p className="text-[11px] text-violet-700/80">
          PDF·이미지·DOCX 업로드 → AI가 이름·연락처·약력·계좌를 채워드려요.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={aiInputRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp" hidden
            onChange={(e) => setAiFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => aiInputRef.current?.click()} disabled={aiRunning}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40">
            <Paperclip size={12} aria-hidden="true" /> 파일 선택
          </button>
          {aiFile && <span className="text-[11px] text-violet-700 truncate max-w-[220px]" title={aiFile.name}>{aiFile.name}</span>}
          <button type="button" onClick={() => void handleAiRun()} disabled={!aiFile || aiRunning}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-300 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40">
            {aiRunning ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
            {aiRunning ? '분석 중…' : 'AI로 자동 채우기'}
          </button>
        </div>
      </section>

      {/* 섹션 2 — 기본 정보 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="이름(실명)" required value={form.real_name} onChange={(v) => patch('real_name', v)} />
        <Field label="연락처"     required value={form.phone}     onChange={(v) => patch('phone', v)} />
        <Field label="이메일"     value={form.email}              onChange={(v) => patch('email', v)} />
        <Field label="주민번호"   required value={form.id_number} onChange={(v) => patch('id_number', v)}
          helper="강사료 원천징수 신고에만 사용돼요." />
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-bold text-slate-600">약력·소개</label>
          <textarea rows={4} value={form.bio} onChange={(e) => patch('bio', e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none" />
        </div>
      </section>

      {/* 섹션 3 — 경력 */}
      <DynamicList<InstructorCareerEntry>
        title="경력 (선택)"
        items={form.career}
        onAdd={() => patch('career', [...form.career, { org: '', role: '', period: '' }])}
        onRemove={(i) => patch('career', form.career.filter((_, idx) => idx !== i))}
        onPatch={(i, p) => patch('career', form.career.map((row, idx) => (idx === i ? { ...row, ...p } : row)))}
        fields={[{ key: 'org', placeholder: '기관명' }, { key: 'role', placeholder: '직책' }, { key: 'period', placeholder: '기간' }]}
      />

      {/* 섹션 4 — 자격·수상 */}
      <DynamicList<InstructorAwardEntry>
        title="자격·수상 (선택)"
        items={form.awards}
        onAdd={() => patch('awards', [...form.awards, { name: '', year: '' }])}
        onRemove={(i) => patch('awards', form.awards.filter((_, idx) => idx !== i))}
        onPatch={(i, p) => patch('awards', form.awards.map((row, idx) => (idx === i ? { ...row, ...p } : row)))}
        fields={[{ key: 'name', placeholder: '항목명' }, { key: 'year', placeholder: '연도' }]}
      />

      {/* 섹션 5 — 강사료 입금 정보 */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-600">강사료 입금 정보</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="은행명"     required value={form.bank_name}    onChange={(v) => patch('bank_name', v)} />
          <Field label="계좌번호"   required value={form.bank_account} onChange={(v) => patch('bank_account', v)} />
          <Field label="예금주"     required value={form.bank_holder}  onChange={(v) => patch('bank_holder', v)} />
        </div>
      </section>

      {/* 섹션 6 — 첨부 파일 */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-600">첨부 파일 (선택)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(FILE_LABELS) as FileField[]).map((field) => (
            <FileUploadRow key={field} label={FILE_LABELS[field]} value={form[field]}
              uploading={uploadingField === field}
              onPick={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileUpload(field, f);
              }} />
          ))}
        </div>
      </section>

      {/* 섹션 7 — 개인정보 동의 */}
      <section className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-700">개인정보 수집·이용 동의</h3>
        <ul className="text-[11px] text-slate-600 space-y-0.5 list-disc pl-4">
          <li>수집 항목. 이름, 연락처, 이메일, 주민번호, 계좌정보, 첨부파일</li>
          <li>이용 목적. 강사료 지급, 세무신고, 교육 운영 자료 보관</li>
          <li>보관 기간. 관련 법규에 따라 최대 5년</li>
          <li>동의 거부 시 강사 활동이 어려울 수 있어요.</li>
        </ul>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.privacy_agreed}
            onChange={(e) => patch('privacy_agreed', e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-300" />
          <span>위 내용을 확인하고 개인정보 수집·이용에 동의합니다. (필수)</span>
        </label>
      </section>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      <button type="button" onClick={() => void handleSubmit()}
        disabled={!form.privacy_agreed || submitting}
        className="w-full rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: form.privacy_agreed && !submitting ? 'linear-gradient(to right, #7C3AED, #EC4899)' : '#CBD5E1' }}>
        {submitting ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> 제출 중…</span> : '제출하기'}
      </button>
    </div>
  );
}

