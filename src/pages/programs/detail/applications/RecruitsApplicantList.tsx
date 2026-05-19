// bal24 v2 — 모집 공고 펼침 내부의 지원자 목록 (RecruitsPanel에서 분리)
// STEP-PARTICIPANT-BULK-DELETE — V-1 한도 준수를 위해 ApplicantList 별도 파일 분리.

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Check, X, RotateCcw, Phone, Mail, ExternalLink, Briefcase,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { formatDateKo } from '../../../../lib/utils';
import { BADGE_BASE } from '../../../../utils/statusStyles';
import type {
  RecruitApplication, RecruitApplicationStatus,
} from '../../../../types/application';

type AppRow = Pick<
  RecruitApplication,
  'id' | 'form_id' | 'name' | 'phone' | 'email' | 'career' | 'portfolio_url' |
  'specialty' | 'message' | 'status' | 'created_at'
>;

const APP_STATUS_LABEL: Record<RecruitApplicationStatus, string> = {
  applied: '지원',
  reviewing: '검토중',
  accepted: '합격',
  rejected: '불합격',
};

const APP_STATUS_STYLE: Record<RecruitApplicationStatus, string> = {
  applied: 'bg-slate-100 text-slate-500 border-slate-300',
  reviewing: 'bg-orange-50 text-orange-600 border-orange-200',
  accepted: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-600 border-rose-200',
};

interface Props { formId: string }

export default function RecruitsApplicantList({ formId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('recruit_applications')
      .select(
        'id, form_id, name, phone, email, career, portfolio_url, specialty, message, status, created_at',
      )
      .eq('form_id', formId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[step-11/recruit] 지원자 조회 실패:', error.message);
      toast.error('지원자 목록을 불러오지 못했어요.');
      return;
    }
    setRows((data as AppRow[] | null) ?? []);
  }, [formId, toast]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  async function changeStatus(id: string, next: RecruitApplicationStatus) {
    setBusy(id);
    try {
      const { error } = await supabase
        .from('recruit_applications')
        .update({
          status: next,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) {
        console.error('[step-11/recruit] 상태 변경 실패:', error.message);
        toast.error('상태 변경에 실패했어요.');
        return;
      }
      toast.success(`${APP_STATUS_LABEL[next]} 처리했어요.`);
      void refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-t border-violet-100/70 bg-violet-50/20 px-3 py-3">
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-violet-400" size={16} aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic text-center py-2">아직 지원자가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((a) => {
            const isOpen = openId === a.id;
            return (
              <li key={a.id} className="rounded-md border border-violet-100 bg-white overflow-hidden">
                <button type="button" onClick={() => setOpenId(isOpen ? null : a.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-violet-50/30 transition-colors">
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">{a.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                    {formatDateKo(a.created_at).replace(/^\d{4}년\s/, '')}
                  </span>
                  <span className={`${BADGE_BASE} ${APP_STATUS_STYLE[a.status]} shrink-0`}>
                    {APP_STATUS_LABEL[a.status]}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-violet-100/70 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 pt-1">
                      <span className="inline-flex items-center gap-1"><Phone size={11} aria-hidden="true" />{a.phone}</span>
                      {a.email && <span className="inline-flex items-center gap-1"><Mail size={11} aria-hidden="true" />{a.email}</span>}
                    </div>
                    {a.specialty && a.specialty.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {a.specialty.map((s) => (
                          <span key={s} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-700 border border-violet-100">{s}</span>
                        ))}
                      </div>
                    )}
                    {a.career && (
                      <div className="rounded-md bg-violet-50/30 border border-violet-100 px-3 py-2">
                        <p className="text-[10px] font-bold text-slate-500 mb-0.5 inline-flex items-center gap-1"><Briefcase size={10} aria-hidden="true" />경력</p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{a.career}</p>
                      </div>
                    )}
                    {a.message && (
                      <div className="rounded-md bg-violet-50/30 border border-violet-100 px-3 py-2">
                        <p className="text-[10px] font-bold text-slate-500 mb-0.5">지원 메시지</p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{a.message}</p>
                      </div>
                    )}
                    {a.portfolio_url && (
                      <a href={a.portfolio_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline">
                        <ExternalLink size={11} aria-hidden="true" />포트폴리오 새 탭
                      </a>
                    )}
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-violet-100/70">
                      {a.status === 'applied' && (
                        <button type="button" onClick={() => void changeStatus(a.id, 'reviewing')} disabled={busy === a.id}
                          className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50">
                          <RotateCcw size={11} aria-hidden="true" />검토 시작
                        </button>
                      )}
                      {a.status !== 'rejected' && (
                        <button type="button" onClick={() => void changeStatus(a.id, 'rejected')} disabled={busy === a.id}
                          className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                          <X size={11} aria-hidden="true" />불합격
                        </button>
                      )}
                      {a.status !== 'accepted' && (
                        <button type="button" onClick={() => void changeStatus(a.id, 'accepted')} disabled={busy === a.id}
                          className="inline-flex items-center gap-0.5 px-3 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                          <Check size={11} aria-hidden="true" />합격
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
