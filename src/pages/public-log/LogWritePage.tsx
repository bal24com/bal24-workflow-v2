// bal24 v2 — 통합 일지 외부 작성 페이지 (/log/:token)
// 5종 일지 (멘토링·출강·출장·TA보고서·운영보고서) — 모바일 우선

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle2, Upload, X, NotebookPen } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import type { ActivityLog, ActivityLogType } from '../../types/database';
import SignaturePad from './SignaturePad';

const LOG_FILES_BUCKET = 'activity-logs';
const MAX_FILES = 3;

const LOG_TYPE_LABELS: Record<ActivityLogType, string> = {
  mentoring: '멘토링 일지',
  lecture: '출강 일지',
  business_trip: '출장 일지',
  ta: 'TA 운영보고서',
  operation: '운영 보고서',
};

interface UploadedFile {
  name: string;
  url: string;
}

interface FormState {
  authorName: string;
  authorPhone: string;
  authorRole: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  location: string;
  attendeeCount: string;
  content: string;
  outcome: string;
  issues: string;
  nextPlan: string;
  menteeName: string;
  mentoringTopic: string;
}

const EMPTY: FormState = {
  authorName: '',
  authorPhone: '',
  authorRole: 'instructor',
  activityDate: '',
  startTime: '',
  endTime: '',
  location: '',
  attendeeCount: '',
  content: '',
  outcome: '',
  issues: '',
  nextPlan: '',
  menteeName: '',
  mentoringTopic: '',
};

interface LogWithToken extends ActivityLog {
  log_token?: string | null;
  status?: string | null;
}

export default function LogWritePage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [log, setLog] = useState<LogWithToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, program:programs(id, name)')
        .eq('log_token', token)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[log-write] 일지 조회 실패:', error.message);
      }
      const row = (data as LogWithToken | null) ?? null;
      setLog(row);
      if (row?.activity_date) {
        setForm((p) => ({ ...p, activityDate: row.activity_date }));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const update = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (files.length >= MAX_FILES) {
      toast.warning(`첨부는 최대 ${MAX_FILES}개까지 가능해요.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('파일 크기는 10MB 이하여야 해요.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 50);
      const path = `${token}/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage
        .from(LOG_FILES_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(LOG_FILES_BUCKET).getPublicUrl(path);
      setFiles((prev) => [...prev, { name: file.name, url: pub.publicUrl }]);
      toast.success('파일을 업로드했어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[log-write] 파일 업로드 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('bucket not found')) {
        toast.error(`파일 저장소(${LOG_FILES_BUCKET})가 없어요. 관리자에게 문의해 주세요.`);
      } else {
        toast.error('파일 업로드 중 오류가 발생했어요.');
      }
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!log) return;

    if (!form.authorName.trim() || !form.authorPhone.trim()) {
      toast.error('작성자 이름·연락처를 입력해 주세요.');
      return;
    }
    if (!form.activityDate) {
      toast.error('활동 날짜를 선택해 주세요.');
      return;
    }
    if (!form.content.trim()) {
      toast.error('활동 내용을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const attendeeCountNum = form.attendeeCount.trim() ? Number(form.attendeeCount) : null;
      const payload: Record<string, unknown> = {
        author_name: form.authorName.trim(),
        author_phone: form.authorPhone.trim(),
        author_role: form.authorRole || null,
        activity_date: form.activityDate,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
        location: form.location.trim() || null,
        attendee_count: attendeeCountNum,
        content: form.content.trim(),
        outcome: form.outcome.trim() || null,
        issues: form.issues.trim() || null,
        next_plan: form.nextPlan.trim() || null,
        signature_data: signature,
        signed_at: signature ? new Date().toISOString() : null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (log.log_type === 'mentoring') {
        payload.mentee_name = form.menteeName.trim() || null;
        payload.mentee_count = attendeeCountNum;
        payload.mentoring_topic = form.mentoringTopic.trim() || null;
      }
      if (files.length > 0) {
        payload.file_urls = files.map((f) => ({ name: f.name, url: f.url }));
      }

      const { error } = await supabase
        .from('activity_logs')
        .update(payload)
        .eq('id', log.id);
      if (error) throw error;
      toast.success('일지를 제출했어요.');
      setSubmitted(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[log-write] 일지 제출 실패:', raw);
      toast.error('제출 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
      </div>
    );
  }

  if (!log) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center max-w-md">
          <p className="text-lg font-bold text-[#1E1B4B] mb-2">유효하지 않은 링크예요</p>
          <p className="text-sm text-slate-500">링크를 다시 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  if (submitted || log.status === 'submitted' || log.status === 'confirmed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center max-w-md w-full">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={48} aria-hidden="true" />
          <h1 className="text-xl font-bold text-[#1E1B4B] mb-2">일지 제출 완료</h1>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-violet-700">{LOG_TYPE_LABELS[log.log_type]}</span> · 담당자가 검토 후 확인 처리할게요.
          </p>
        </div>
      </div>
    );
  }

  const isMentoring = log.log_type === 'mentoring';
  const typeLabel = LOG_TYPE_LABELS[log.log_type];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-br from-violet-600 to-violet-500 text-white">
        <div className="max-w-2xl mx-auto px-5 py-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold mb-3">
            <NotebookPen size={14} aria-hidden="true" />
            {typeLabel}
          </div>
          <h1 className="text-xl font-bold mb-1">{log.title || '일지 작성'}</h1>
          {log.activity_date && (
            <p className="text-xs opacity-90">{formatDateKo(log.activity_date)}</p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-violet-100 bg-white p-5 sm:p-7 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-5" noValidate>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#1E1B4B]">작성자 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="이름" required value={form.authorName} onChange={(e) => update('authorName', e.target.value)} disabled={submitting} placeholder="홍길동" />
              <Input type="tel" label="연락처" required value={form.authorPhone} onChange={(e) => update('authorPhone', e.target.value)} disabled={submitting} placeholder="010-0000-0000" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#1E1B4B]">활동 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input type="date" label="활동 날짜" required value={form.activityDate} onChange={(e) => update('activityDate', e.target.value)} disabled={submitting} />
              <Input type="time" label="시작" value={form.startTime} onChange={(e) => update('startTime', e.target.value)} disabled={submitting} />
              <Input type="time" label="종료" value={form.endTime} onChange={(e) => update('endTime', e.target.value)} disabled={submitting} />
            </div>
            <Input label="장소" value={form.location} onChange={(e) => update('location', e.target.value)} disabled={submitting} placeholder="활동 장소" />

            {isMentoring && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-violet-100 bg-violet-50/30 p-3">
                <Input label="멘티명" value={form.menteeName} onChange={(e) => update('menteeName', e.target.value)} disabled={submitting} />
                <Input type="number" label="인원" value={form.attendeeCount} onChange={(e) => update('attendeeCount', e.target.value)} disabled={submitting} placeholder="0" min={0} />
                <Input label="멘토링 주제" value={form.mentoringTopic} onChange={(e) => update('mentoringTopic', e.target.value)} disabled={submitting} />
              </div>
            )}
            {!isMentoring && (
              <Input type="number" label="참석 인원 (선택)" value={form.attendeeCount} onChange={(e) => update('attendeeCount', e.target.value)} disabled={submitting} placeholder="0" min={0} />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[#1E1B4B]">내용</h2>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">활동 내용 <span className="text-rose-500">*</span></label>
              <textarea
                value={form.content}
                onChange={(e) => update('content', e.target.value)}
                disabled={submitting}
                rows={4}
                placeholder="활동 내용을 자유롭게 적어주세요."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">결과 / 성과</label>
              <textarea
                value={form.outcome}
                onChange={(e) => update('outcome', e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="활동 결과·성과를 적어주세요."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">문제점 / 건의</label>
                <textarea
                  value={form.issues}
                  onChange={(e) => update('issues', e.target.value)}
                  disabled={submitting}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">향후 계획</label>
                <textarea
                  value={form.nextPlan}
                  onChange={(e) => update('nextPlan', e.target.value)}
                  disabled={submitting}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-sm font-bold text-[#1E1B4B]">첨부 파일 (최대 {MAX_FILES}개, 각 10MB)</label>
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50">
              <Upload size={14} aria-hidden="true" />
              {uploading ? '업로드 중…' : '파일 추가'}
              <input type="file" onChange={handleFileUpload} disabled={submitting || uploading || files.length >= MAX_FILES} className="hidden" />
            </label>
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, idx) => (
                  <li key={f.url} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="flex-1 truncate text-slate-700">{f.name}</span>
                    <button type="button" onClick={() => removeFile(idx)} aria-label="첨부 제거" className="text-slate-400 hover:text-rose-500">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <label className="text-sm font-bold text-[#1E1B4B]">서명</label>
            <SignaturePad onChange={setSignature} disabled={submitting} />
          </section>

          <Button type="submit" variant="primary" loading={submitting} disabled={uploading} className="!w-full !py-3 text-base font-semibold">
            일지 제출
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">© 2026 BalanceDot WorkFlow</p>
      </main>
    </div>
  );
}
