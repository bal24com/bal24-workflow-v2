// bal24 v2 — 멘토링 보고서 작성/수정 모달 (STEP-MENTORING)
// 신규 + 수정 겸용. 시작/종료 → 소요시간 자동 계산. 사진 최대 5장.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { Loader2, Trash2, Upload, X } from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  calcDurationMin, formatDuration,
} from '../../../types/mentoring';
import type { MentoringSession, MentoringSessionMeetType } from '../../../types/mentoring';
import { uploadMentoringPhoto, downloadSessionAsWord } from './mentoringUtils';

interface Props {
  open: boolean;
  assignmentId: string;
  mentorName: string;
  session?: MentoringSession | null; // 있으면 수정, 없으면 신규
  /** STEP-PM-VIEWER: PM/ADMIN 뷰어 모드 — 저장·삭제 비활성화 */
  readOnly?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const MAX_PHOTOS = 5;
const today = () => new Date().toISOString().slice(0, 10);

export default function MentoringSessionModal({
  open, assignmentId, mentorName, session, readOnly = false, onClose, onSaved,
}: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState(today());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [meetType, setMeetType] = useState<MentoringSessionMeetType>('대면');
  const [team, setTeam] = useState('');
  const [item, setItem] = useState('');
  const [attendees, setAttendees] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (session) {
      setDate(session.session_date);
      setStart(session.start_time ?? '');
      setEnd(session.end_time ?? '');
      setMeetType(session.meet_type ?? '대면');
      setTeam(session.team_name ?? '');
      setItem(session.item_name ?? '');
      setAttendees(session.attendee_names ?? '');
      setTitle(session.title);
      setContent(session.content);
      setPhotoUrls(session.photo_urls ?? []);
    } else {
      setDate(today());
      setStart(''); setEnd(''); setMeetType('대면');
      setTeam(''); setItem(''); setAttendees('');
      setTitle(''); setContent(''); setPhotoUrls([]);
    }
  }, [open, session]);

  const durationMin = useMemo(() => calcDurationMin(start, end), [start, end]);

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (photoUrls.length + files.length > MAX_PHOTOS) {
      toast.error(`사진은 최대 ${MAX_PHOTOS}장까지 첨부 가능해요.`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const f of files) {
        const url = await uploadMentoringPhoto(f, assignmentId);
        if (url) uploaded.push(url);
      }
      setPhotoUrls((prev) => [...prev, ...uploaded]);
      if (uploaded.length < files.length) {
        toast.error('일부 사진 업로드에 실패했어요. 다시 시도해 주세요.');
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = (idx: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('제목을 입력해 주세요.'); return; }
    if (!content.trim()) { toast.error('내용을 입력해 주세요.'); return; }
    setSubmitting(true);
    try {
      const payload = {
        assignment_id: assignmentId,
        session_date: date,
        start_time: start || null,
        end_time: end || null,
        duration_min: durationMin || null,
        meet_type: meetType,
        team_name: team.trim() || null,
        item_name: item.trim() || null,
        attendee_names: attendees.trim() || null,
        title: title.trim(),
        content: content.trim(),
        photo_urls: photoUrls,
        submitted_by: user?.id ?? null,
        submitted_at: new Date().toISOString(),
      };
      const res = session
        ? await supabase.from('mentoring_sessions').update(payload).eq('id', session.id)
        : await supabase.from('mentoring_sessions').insert(payload);
      if (res.error) {
        console.error('[mentoring] 보고서 저장 실패:', res.error.message);
        toast.error('보고서 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      toast.success('보고서를 저장했어요.');
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    if (!window.confirm('이 보고서를 삭제할까요?')) return;
    const { error } = await supabase.from('mentoring_sessions').delete().eq('id', session.id);
    if (error) {
      console.error('[mentoring] 보고서 삭제 실패:', error.message);
      toast.error('삭제에 실패했어요.');
      return;
    }
    toast.success('보고서를 삭제했어요.');
    onSaved();
    onClose();
  };

  const handleDownload = () => {
    if (!session) {
      toast.info('저장 후 다운로드할 수 있어요.');
      return;
    }
    downloadSessionAsWord(session, mentorName);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={session ? '멘토링 보고서 수정' : '멘토링 보고서 작성'}
      size="lg"
      closeOnBackdrop={!submitting && !uploading}
      footer={
        <>
          {session && (
            <Button variant="outline" onClick={handleDelete} disabled={submitting || readOnly} leftIcon={<Trash2 size={14} />}>삭제</Button>
          )}
          {session && (
            <Button variant="outline" onClick={handleDownload} disabled={submitting}>Word 다운로드</Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={submitting}>{readOnly ? '닫기' : '취소'}</Button>
          {!readOnly && (
            <Button type="submit" form="mentoring-session-form" variant="primary" loading={submitting}>저장</Button>
          )}
        </>
      }
    >
      <form id="mentoring-session-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* 기본 정보 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="멘토" value={mentorName} disabled />
          <Input label="팀명" value={team} onChange={(e) => setTeam(e.target.value)} disabled={submitting} placeholder="예) A팀" />
          <Input label="아이템명" value={item} onChange={(e) => setItem(e.target.value)} disabled={submitting} placeholder="예) AI 명함 인식 앱" />
          <Input label="참여자/회원명의" value={attendees} onChange={(e) => setAttendees(e.target.value)} disabled={submitting} placeholder="예) 김민수, 박지영" />
        </div>

        {/* 멘토링 정보 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Input type="date" label="날짜" value={date} onChange={(e) => setDate(e.target.value)} disabled={submitting} />
          <Input label="시작" value={start} onChange={(e) => setStart(e.target.value)} disabled={submitting} placeholder="14:00" />
          <Input label="종료" value={end} onChange={(e) => setEnd(e.target.value)} disabled={submitting} placeholder="16:30" />
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">소요</label>
            <div className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 tabular-nums">
              {formatDuration(durationMin)}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">유형</label>
          <div className="flex items-center gap-2">
            {(['대면', '비대면'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMeetType(m)}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  meetType === m
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >{m}</button>
            ))}
          </div>
        </div>

        <Input label="보고서 제목" required value={title} onChange={(e) => setTitle(e.target.value)} disabled={submitting} placeholder="예) 1차 멘토링 — 사업계획 검토" />

        <div className="space-y-1.5">
          <label htmlFor="mentoring-content" className="text-sm font-semibold text-slate-700">컨설팅 상세 내용 <span className="text-rose-500">*</span></label>
          <textarea
            id="mentoring-content"
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={submitting}
            placeholder="멘토링 진행 내용·논의·다음 액션을 적어 주세요."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-y"
          />
        </div>

        {/* 사진 첨부 */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">
            사진 첨부 ({photoUrls.length}/{MAX_PHOTOS})
          </label>
          <div className="flex flex-wrap gap-2">
            {photoUrls.map((url, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                <img src={url} alt={`photo-${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  disabled={submitting}
                  className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label={`사진 ${idx + 1} 삭제`}
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </div>
            ))}
            {photoUrls.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || submitting}
                className="inline-flex items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/40 text-violet-500 hover:bg-violet-100 disabled:opacity-50"
              >
                {uploading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Upload size={18} aria-hidden="true" />}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void handlePhotoUpload(e)}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
