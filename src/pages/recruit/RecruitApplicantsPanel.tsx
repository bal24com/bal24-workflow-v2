// bal24 v2 — 모집 지원자 슬라이드 패널 (STEP 11 옵션 B)

import { Loader2, X, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { BADGE_BASE } from '../../utils/statusStyles';
import {
  RECRUIT_TYPE_LABEL,
  type RecruitForm,
  type RecruitApplication,
  type RecruitApplicationStatus,
} from '../../types/application';

interface Props {
  form: RecruitForm;
  applicants: RecruitApplication[];
  loading: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_LABEL: Record<RecruitApplicationStatus, string> = {
  applied: '신청',
  reviewing: '검토중',
  accepted: '합격',
  rejected: '불합격',
};

const STATUS_STYLE: Record<RecruitApplicationStatus, string> = {
  applied: 'bg-slate-100 text-slate-600 border-slate-300',
  reviewing: 'bg-violet-50 text-violet-600 border-violet-200',
  accepted: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-500 border-rose-200',
};

export default function RecruitApplicantsPanel({ form, applicants, loading, onClose, onUpdated }: Props) {
  const toast = useToast();

  const handleStatusChange = async (id: string, status: RecruitApplicationStatus) => {
    const { error } = await supabase
      .from('recruit_applications')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[recruit] 지원자 상태 변경 실패:', error.message);
      toast.error('상태를 변경하지 못했어요.');
      return;
    }
    toast.success(`${STATUS_LABEL[status]} 상태로 변경했어요.`);
    onUpdated();
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} role="presentation">
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="지원자 목록"
      >
        <header className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`${BADGE_BASE} bg-violet-50 text-violet-700 border-violet-200`}>
                {RECRUIT_TYPE_LABEL[form.recruit_type]}
              </span>
              <span className="text-xs text-slate-500">지원자 {applicants.length}명</span>
            </div>
            <h2 className="text-lg font-bold text-[#1E1B4B] truncate">{form.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-700 rounded-lg p-1 transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
            </div>
          ) : applicants.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-12">아직 지원자가 없어요.</p>
          ) : (
            <ul className="space-y-3">
              {applicants.map((a) => (
                <li key={a.id} className="rounded-2xl border border-violet-100 bg-white p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-base font-bold text-[#1E1B4B]">{a.name}</span>
                        <span className={`${BADGE_BASE} ${STATUS_STYLE[a.status]}`}>
                          {STATUS_LABEL[a.status]}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        <a href={`tel:${a.phone}`} className="text-violet-700 hover:underline">{a.phone}</a>
                        {a.email && (
                          <>
                            <span>·</span>
                            <a href={`mailto:${a.email}`} className="text-violet-700 hover:underline">{a.email}</a>
                          </>
                        )}
                        <span>·</span>
                        <span>{formatDateKo(a.created_at)}</span>
                      </div>
                    </div>
                    <select
                      value={a.status}
                      onChange={(e) => void handleStatusChange(a.id, e.target.value as RecruitApplicationStatus)}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-primary"
                    >
                      {(Object.keys(STATUS_LABEL) as RecruitApplicationStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>

                  {a.career && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">경력</div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{a.career}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    {a.specialty && a.specialty.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {a.specialty.map((s) => (
                          <span key={s} className="rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 text-[11px] font-semibold">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {a.available_dates && (
                      <span className="text-slate-500">📅 {a.available_dates}</span>
                    )}
                  </div>

                  {a.message && (
                    <p className="text-xs text-slate-600 italic border-l-2 border-violet-200 pl-2 whitespace-pre-wrap">
                      {a.message}
                    </p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    {a.portfolio_url && (
                      <a
                        href={a.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-violet-700 hover:underline"
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                        포트폴리오
                      </a>
                    )}
                    {a.attachment_urls && a.attachment_urls.length > 0 && a.attachment_urls.map((url, idx) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-600 hover:text-violet-700 hover:underline"
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                        첨부 {idx + 1}
                      </a>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="p-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} className="!w-full">닫기</Button>
        </footer>
      </aside>
    </div>
  );
}
