// bal24 v2 — 모집 공고·지원자 관리 패널 (Stage 11-③)
// recruit_forms (program_id) + recruit_applications (form_id) 합격/불합격.

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Megaphone, ChevronDown, ChevronRight, Check, X, RotateCcw,
  Phone, Mail, ExternalLink, Briefcase,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import { formatDateKo } from '../../../../lib/utils';
import { BADGE_BASE } from '../../../../utils/statusStyles';
import { useAuth } from '../../../../contexts/AuthContext';
import { RECRUIT_TYPE_LABEL } from '../../../../types/application';
import type {
  RecruitForm, RecruitApplication, RecruitApplicationStatus,
} from '../../../../types/application';
import { Copy } from 'lucide-react';

interface Props {
  programId: string;
}

type FormRow = Pick<
  RecruitForm,
  'id' | 'recruit_type' | 'title' | 'deadline' | 'is_active' | 'form_token' | 'max_count'
> & {
  application_count: number;
};

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

function buildRecruitUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/recruit/${token}`;
}

export default function RecruitsPanel({ programId }: Props) {
  const toast = useToast();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFormId, setOpenFormId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('recruit_forms')
      .select(
        'id, recruit_type, title, deadline, is_active, form_token, max_count, applications:recruit_applications(id)',
      )
      .eq('program_id', programId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[step-11/recruit] 모집 공고 조회 실패:', error.message);
      toast.error('모집 공고를 불러오지 못했어요.');
      return;
    }
    type Row = Omit<FormRow, 'application_count'> & { applications: { id: string }[] };
    setForms(((data as Row[] | null) ?? []).map((r) => ({
      id: r.id,
      recruit_type: r.recruit_type,
      title: r.title,
      deadline: r.deadline,
      is_active: r.is_active,
      form_token: r.form_token,
      max_count: r.max_count,
      application_count: r.applications?.length ?? 0,
    })));
  }, [programId, toast]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, refresh]);

  async function handleCopy(token: string, label: string) {
    const ok = await copyToClipboard(buildRecruitUrl(token));
    if (ok) toast.success(`${label} 모집 링크 복사 완료`);
    else toast.error('링크 복사에 실패했어요.');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Megaphone size={16} className="text-orange-500" aria-hidden="true" />
          모집 공고 ({forms.length})
        </h3>
        <p className="text-[11px] text-slate-500">펼치면 지원자 + 합격/불합격</p>
      </header>

      {forms.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">
          등록된 모집 공고가 없어요. 모집 메뉴에서 발행하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {forms.map((f) => {
            const isOpen = openFormId === f.id;
            return (
              <li key={f.id} className="rounded-xl border border-violet-100 bg-white overflow-hidden">
                <header className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenFormId(isOpen ? null : f.id)}
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-violet-600 hover:bg-violet-50"
                    aria-label={isOpen ? '접기' : '펼치기'}
                  >
                    {isOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                  </button>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-700 shrink-0">
                    {RECRUIT_TYPE_LABEL[f.recruit_type]}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-[#1E1B4B]">{f.title}</span>
                  {f.deadline && (
                    <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">
                      ~ {formatDateKo(f.deadline).replace(/^\d{4}년\s/, '')}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                    지원 {f.application_count}{f.max_count != null ? `/${f.max_count}` : ''}
                  </span>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      f.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {f.is_active ? '진행중' : '종료'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(f.form_token, RECRUIT_TYPE_LABEL[f.recruit_type])}
                    title="모집 링크 복사"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <Copy size={12} aria-hidden="true" />
                  </button>
                  <a
                    href={buildRecruitUrl(f.form_token)}
                    target="_blank"
                    rel="noreferrer"
                    title="새 탭"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </header>

                {isOpen && <ApplicantList formId={f.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ApplicantList({ formId }: { formId: string }) {
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
              <li
                key={a.id}
                className="rounded-md border border-violet-100 bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-violet-50/30 transition-colors"
                >
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                    {a.name}
                  </span>
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
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} aria-hidden="true" />
                        {a.phone}
                      </span>
                      {a.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail size={11} aria-hidden="true" />
                          {a.email}
                        </span>
                      )}
                    </div>

                    {a.specialty && a.specialty.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {a.specialty.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-700 border border-violet-100"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {a.career && (
                      <div className="rounded-md bg-violet-50/30 border border-violet-100 px-3 py-2">
                        <p className="text-[10px] font-bold text-slate-500 mb-0.5 inline-flex items-center gap-1">
                          <Briefcase size={10} aria-hidden="true" />
                          경력
                        </p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {a.career}
                        </p>
                      </div>
                    )}

                    {a.message && (
                      <div className="rounded-md bg-violet-50/30 border border-violet-100 px-3 py-2">
                        <p className="text-[10px] font-bold text-slate-500 mb-0.5">지원 메시지</p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {a.message}
                        </p>
                      </div>
                    )}

                    {a.portfolio_url && (
                      <a
                        href={a.portfolio_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline"
                      >
                        <ExternalLink size={11} aria-hidden="true" />
                        포트폴리오 새 탭
                      </a>
                    )}

                    {/* 액션 */}
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-violet-100/70">
                      {a.status === 'applied' && (
                        <button
                          type="button"
                          onClick={() => void changeStatus(a.id, 'reviewing')}
                          disabled={busy === a.id}
                          className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                        >
                          <RotateCcw size={11} aria-hidden="true" />
                          검토 시작
                        </button>
                      )}
                      {a.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => void changeStatus(a.id, 'rejected')}
                          disabled={busy === a.id}
                          className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <X size={11} aria-hidden="true" />
                          불합격
                        </button>
                      )}
                      {a.status !== 'accepted' && (
                        <button
                          type="button"
                          onClick={() => void changeStatus(a.id, 'accepted')}
                          disabled={busy === a.id}
                          className="inline-flex items-center gap-0.5 px-3 py-1 rounded-md text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check size={11} aria-hidden="true" />
                          합격
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
