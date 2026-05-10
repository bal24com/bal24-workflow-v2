// bal24 v2 — STEP-MENTOR-TEAM-VIEW 멘토링 일지 작성 모달
// activity_logs INSERT (log_type='mentoring') + 본인의 기존 일지 5건 표시.

import { useEffect, useState } from 'react';
import {
  Loader2, Save, CalendarDays, NotebookPen, ExternalLink,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { Button, Input } from '../../../components/ui';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import { isMissingTableError } from '../../schedule/scheduleUtils';
import type { ActivityLog } from '../../../types/database';

interface Props {
  programId: string;
  applicationId: string | null;
  mentorStaffPoolId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const HISTORY_LIMIT = 5;

export default function MentoringLogModal({
  programId, applicationId, mentorStaffPoolId, onClose, onSaved,
}: Props) {
  const toast = useToast();
  const { user } = useAuth();

  // 폼 상태
  const today = new Date().toISOString().slice(0, 10);
  const [activityDate, setActivityDate] = useState(today);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 기존 일지 목록
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setHistoryLoading(true);
      // expert_id 매칭 — 멘토 본인의 일지만
      let q = supabase
        .from('activity_logs')
        .select('*')
        .eq('program_id', programId)
        .eq('log_type', 'mentoring')
        .order('activity_date', { ascending: false })
        .limit(HISTORY_LIMIT);
      if (mentorStaffPoolId) {
        q = q.eq('expert_id', mentorStaffPoolId);
      } else if (user?.id) {
        // staff_pool_id 미연결 멘토는 created_by 기준으로 본인 일지 표시
        q = q.eq('created_by', user.id);
      }
      const { data, error } = await q;
      if (cancelled) return;
      if (error) {
        if (isMissingTableError(error.message)) {
          setTableMissing(true);
        } else {
          console.error('[mentoring-log] 이력 조회 실패:', error.message);
        }
        setHistory([]);
      } else {
        setTableMissing(false);
        setHistory((data ?? []) as ActivityLog[]);
      }
      setHistoryLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, mentorStaffPoolId, user?.id]);

  async function handleSave() {
    if (!title.trim()) { toast.error('주제를 입력해 주세요.'); return; }
    if (!activityDate) { toast.error('멘토링 일시를 선택해 주세요.'); return; }
    if (!content.trim()) { toast.error('멘토링 내용을 입력해 주세요.'); return; }

    setSubmitting(true);
    const payload = {
      program_id: programId,
      log_type: 'mentoring' as const,
      title: title.trim(),
      activity_date: activityDate,
      content: content.trim(),
      next_plan: memo.trim() || null,
      expert_id: mentorStaffPoolId,
      created_by: user?.id ?? null,
    };
    const { error } = await supabase.from('activity_logs').insert(payload);
    setSubmitting(false);

    if (error) {
      if (isMissingTableError(error.message)) {
        toast.error('멘토링 일지 기능이 아직 준비 중이에요.');
      } else {
        console.error('[mentoring-log] 저장 실패:', error.message);
        toast.error('일지 저장 중 오류가 발생했어요.');
      }
      return;
    }
    toast.success('멘토링 일지를 저장했어요.');
    onSaved();
  }

  if (tableMissing) {
    return (
      <Modal open onClose={onClose} title="멘토링 일지" size="md">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          멘토링 일지 기능이 아직 준비 중이에요.
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="멘토링 일지 작성"
      description={applicationId ? '담당팀 한 곳에 대한 멘토링 기록이에요.' : undefined}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button variant="primary" leftIcon={<Save size={14} />} onClick={() => void handleSave()} loading={submitting}>
            저장
          </Button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        {/* 입력 폼 */}
        <section className="space-y-3">
          <Input
            type="date"
            label="멘토링 일시"
            required
            value={activityDate}
            onChange={(e) => setActivityDate(e.target.value)}
            disabled={submitting}
          />
          <Input
            label="주제"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            placeholder="예) 마케팅 전략 점검"
          />
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">
              멘토링 내용 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
              rows={5}
              placeholder="진행한 멘토링 내용을 적어 주세요."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-y leading-relaxed"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">추가 메모 (선택)</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="다음 만남 계획, 후속 조치 등"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-y leading-relaxed"
            />
          </div>
          {!mentorStaffPoolId && user?.id && (
            <p className="text-[11px] text-slate-400">
              ⓘ 전문가 풀에 연결되어 있지 않아 본인 계정 기준으로 일지가 저장돼요.
            </p>
          )}
        </section>

        {/* 기존 일지 목록 */}
        <section className="space-y-2 pt-3 border-t border-slate-200">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <NotebookPen size={14} className="text-violet-600" aria-hidden="true" />
            최근 멘토링 일지 ({history.length})
          </h3>
          {historyLoading ? (
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" />불러오는 중…
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-400">아직 작성된 일지가 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-[#1E1B4B] truncate">{h.title}</p>
                    <span className="text-[10px] text-slate-500 tabular-nums whitespace-nowrap flex items-center gap-0.5">
                      <CalendarDays size={10} aria-hidden="true" />
                      {formatDateKo(h.activity_date)}
                    </span>
                  </div>
                  {h.content && (
                    <p className="text-slate-600 line-clamp-2 whitespace-pre-wrap">{h.content}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <a
            href="/activity-logs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-[11px] text-violet-600 hover:underline"
          >
            <ExternalLink size={11} aria-hidden="true" />
            전체 일지 보기
          </a>
        </section>
      </div>
    </Modal>
  );
}
