// 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE Phase 3 — 수혜기관 외부 공유 뷰.
// portal_beneficiary_orgs.token 진입 + PIN 통과 시 — 안내 탭 + 신청 설문 탭.

import { useState } from 'react';
import { Loader2, CheckCircle2, FileText, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SurveyConfig {
  schedule_options?: string[];
  fields?: string[];
}

interface BeneficiaryOrg {
  id: string;
  org_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
}

interface PortalLite {
  id: string;
  title: string;
  intro_title: string | null;
  intro_content: string | null;
  survey_config: SurveyConfig | null;
}

interface Props {
  portal: PortalLite;
  org: BeneficiaryOrg;
  onStatusChange: (status: string) => void;
}

type TabKey = 'intro' | 'apply';

export default function PortalBeneficiaryView({ portal, org, onStatusChange }: Props) {
  const [tab, setTab] = useState<TabKey>('intro');
  const submitted = org.status !== 'pending';
  const cfg = portal.survey_config ?? {};
  const scheduleOpts = cfg.schedule_options ?? [];
  const fields = (cfg.fields && cfg.fields.length > 0) ? cfg.fields : ['희망일정', '참여인원', '담당자명', '연락처'];

  const [answers, setAnswers] = useState<Record<string, string>>({
    희망일정: '',
    참여인원: '',
    담당자명: org.contact_name ?? '',
    연락처:   org.contact_phone ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setAnswer(k: string, v: string) {
    setAnswers((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit() {
    setErr(null);
    // 활성 필드 모두 입력됐는지 확인
    for (const f of fields) {
      if (!String(answers[f] ?? '').trim()) {
        setErr(`'${f}' 항목을 입력해 주세요.`);
        return;
      }
    }
    setSubmitting(true);
    const payload: Record<string, string> = {};
    fields.forEach((f) => { payload[f] = String(answers[f] ?? '').trim(); });

    // 1) 설문 응답 INSERT
    const { error: rErr } = await supabase.from('portal_survey_responses').insert({
      portal_id: portal.id,
      beneficiary_org_id: org.id,
      org_name: org.org_name,
      answers: payload,
    });
    if (rErr) {
      console.error('[PortalBeneficiaryView] 응답 INSERT 실패:', rErr.message);
      setSubmitting(false);
      setErr('신청 제출에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    // 2) 수혜기관 상태 = submitted
    const { error: uErr } = await supabase
      .from('portal_beneficiary_orgs')
      .update({ status: 'submitted' })
      .eq('id', org.id);
    if (uErr) console.warn('[PortalBeneficiaryView] 상태 갱신 경고:', uErr.message);

    setSubmitting(false);
    setSubmitSuccess(true);
    onStatusChange('submitted');
  }

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl border border-violet-100 shadow-card p-6 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#1E1B4B]">{portal.title}</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 border border-violet-200">
              {org.org_name}
            </span>
          </div>
        </div>

        {/* 탭 */}
        <nav className="flex gap-1 border-b border-violet-100" role="tablist">
          {([
            { key: 'intro' as const, label: '개요·안내', Icon: FileText },
            { key: 'apply' as const, label: '신청하기',  Icon: Send },
          ]).map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                  active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-violet-600'
                }`}>
                <t.Icon size={14} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* 탭 컨텐츠 */}
        {tab === 'intro' && (
          <div className="bg-white rounded-2xl border border-violet-100 p-6 space-y-3">
            <h2 className="text-lg font-bold text-[#1E1B4B]">{portal.intro_title || '안내 사항'}</h2>
            {portal.intro_content ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{portal.intro_content}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">관리자가 안내 내용을 등록하지 않았어요.</p>
            )}
            {scheduleOpts.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-700 mb-1.5">참여 가능 일정</p>
                <div className="flex flex-wrap gap-1.5">
                  {scheduleOpts.map((s) => (
                    <span key={s} className="text-xs font-semibold px-2 py-1 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'apply' && (
          <div className="bg-white rounded-2xl border border-violet-100 p-6 space-y-4">
            {submitSuccess || submitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 size={28} aria-hidden="true" />
                </div>
                <h2 className="text-lg font-bold text-[#1E1B4B]">신청이 완료되었습니다</h2>
                <p className="text-sm text-slate-500">담당자가 확인 후 연락드릴게요.</p>
              </div>
            ) : (
              <>
                {fields.map((f) => {
                  if (f === '희망일정' && scheduleOpts.length > 0) {
                    return (
                      <div key={f}>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">{f} *</label>
                        <select value={answers[f] ?? ''} onChange={(e) => setAnswer(f, e.target.value)}
                          className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white outline-none focus:border-violet-500">
                          <option value="">선택해 주세요</option>
                          {scheduleOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div key={f}>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">{f} *</label>
                      <input type="text" value={answers[f] ?? ''} onChange={(e) => setAnswer(f, e.target.value)}
                        placeholder={f === '연락처' ? '예) 010-1234-5678' : `${f} 입력`}
                        className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
                    </div>
                  );
                })}
                {err && (
                  <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p>
                )}
                <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
                  className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  신청 제출
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
