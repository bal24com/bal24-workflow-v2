// bal24 v2 — 교육생 신청 상세 모달 (STEP 11 옵션 B)
// 박경수님 2026-06-02 STEP-RECRUIT-CUSTOM-QUESTIONS — 추가 질문 응답 섹션 추가.

import { useEffect, useState } from 'react';
import { Mail, Phone, Building2, MapPin, Calendar, FileText, MessageSquare } from 'lucide-react';
import { Modal, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import type { ParticipantApplication, AppQuestion } from '../../types/application';

interface Props {
  application: ParticipantApplication;
  /** 박경수님 2026-06-02 — 프로그램별 추가 질문 정의 (없으면 빈 배열) */
  questions?: AppQuestion[];
  onClose: () => void;
  onSaved: () => void;
}

const GENDER_LABEL: Record<string, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
};

export default function ApplicationDetailModal({ application, questions, onClose, onSaved }: Props) {
  const toast = useToast();
  const [reviewNotes, setReviewNotes] = useState(application.review_notes ?? '');
  const [attendanceRate, setAttendanceRate] = useState<string>(
    application.attendance_rate != null ? String(application.attendance_rate) : '',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReviewNotes(application.review_notes ?? '');
    setAttendanceRate(application.attendance_rate != null ? String(application.attendance_rate) : '');
  }, [application]);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('participant_applications')
        .update({
          review_notes: reviewNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', application.id);
      if (error) throw error;
      toast.success('검토 메모를 저장했어요.');
      onSaved();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[applications] 메모 저장 실패:', raw);
      toast.error('저장 중 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    const rate = Number(attendanceRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('출석률은 0~100 사이 숫자로 입력해 주세요.');
      return;
    }
    if (!window.confirm(`"${application.name}"님을 수료 처리할까요?\n출석률 ${rate}%로 기록됩니다.`)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('participant_applications')
        .update({
          status: 'completed',
          attendance_rate: rate,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', application.id);
      if (error) throw error;
      toast.success('수료 처리했어요.');
      onSaved();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[applications] 수료 처리 실패:', raw);
      toast.error('수료 처리 중 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={application.name}
      description="신청자 상세 정보 — ADMIN·PM만 접근"
      size="brand"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {application.status === 'accepted' ? (
            <Button type="button" variant="outline" onClick={() => void handleComplete()} loading={saving} className="!border-cyan-200 !text-cyan-700 hover:!bg-cyan-50">
              수료 처리
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>닫기</Button>
            <Button variant="primary" onClick={() => void handleSaveNotes()} loading={saving}>
              메모 저장
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4 space-y-2 text-sm">
          <Row icon={<Phone size={14} aria-hidden="true" />} label="연락처">
            <a href={`tel:${application.phone}`} className="text-violet-700 hover:underline">{application.phone}</a>
          </Row>
          {application.email && (
            <Row icon={<Mail size={14} aria-hidden="true" />} label="이메일">
              <a href={`mailto:${application.email}`} className="text-violet-700 hover:underline">{application.email}</a>
            </Row>
          )}
          {application.birth_year && (
            <Row icon={<Calendar size={14} aria-hidden="true" />} label="생년월일">
              {formatDateKo(application.birth_year)}
            </Row>
          )}
          {application.gender && (
            <Row icon={<FileText size={14} aria-hidden="true" />} label="성별">
              {GENDER_LABEL[application.gender] ?? application.gender}
            </Row>
          )}
          {application.organization && (
            <Row icon={<Building2 size={14} aria-hidden="true" />} label="소속">
              {application.organization}
            </Row>
          )}
          {application.address && (
            <Row icon={<MapPin size={14} aria-hidden="true" />} label="주소">
              {application.address}
            </Row>
          )}
        </section>

        {application.motivation && (
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">지원 동기</h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-3">{application.motivation}</p>
          </section>
        )}

        {application.experience && (
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">관련 경험</h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-3">{application.experience}</p>
          </section>
        )}

        {/* 박경수님 2026-06-02 STEP-RECRUIT-CUSTOM-QUESTIONS — 추가 질문 응답 */}
        {questions && questions.length > 0 && (
          <section>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 inline-flex items-center gap-1">
              <MessageSquare size={11} aria-hidden="true" /> 추가 질문 응답
            </h4>
            <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-3 space-y-1.5">
              {questions.map((q) => {
                const ans = (application.extra_answers ?? {})[q.id]?.trim();
                return (
                  <div key={q.id} className="flex items-start gap-2 text-sm">
                    <span className="text-slate-500 w-32 shrink-0 truncate" title={q.label}>{q.label}</span>
                    <span className={`flex-1 min-w-0 break-words ${ans ? 'text-slate-700 font-semibold' : 'text-slate-300 italic'}`}>
                      {ans || '미응답'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">검토 메모</label>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            disabled={saving}
            rows={3}
            placeholder="내부 검토 메모를 적어주세요. (지원자에게 공개되지 않아요)"
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </section>

        {application.status === 'accepted' && (
          <section className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4 space-y-2">
            <h4 className="text-xs font-bold text-cyan-700 uppercase tracking-wide">수료 처리</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={attendanceRate}
                onChange={(e) => setAttendanceRate(e.target.value)}
                disabled={saving}
                placeholder="출석률 %"
                className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-slate-500">% (0 ~ 100)</span>
            </div>
            <p className="text-xs text-cyan-700">합격 상태에서만 수료 처리 가능. 수료 처리 시 자동으로 완료 상태로 변경됩니다.</p>
          </section>
        )}

        {application.completed_at && application.attendance_rate != null && (
          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm">
            ✅ 수료 완료 — {formatDateKo(application.completed_at)} · 출석률 {application.attendance_rate}%
          </section>
        )}
      </div>
    </Modal>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-violet-500 mt-0.5">{icon}</span>
      <span className="text-slate-500 w-16 shrink-0">{label}</span>
      <span className="text-slate-700 flex-1 min-w-0 break-words">{children}</span>
    </div>
  );
}
