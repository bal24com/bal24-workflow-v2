// 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE Phase 2 — 주관기관 외부 공유 뷰.
// portal_role='operator' 토큰 진입 시 — 수혜기관 목록 + 각 기관 신청 응답 조회.

import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, Phone, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ProjectPortal } from './portalUtils';

interface OrgRow {
  id: string;
  org_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
}

interface ResponseRow {
  id: string;
  beneficiary_org_id: string | null;
  org_name: string | null;
  answers: Record<string, unknown>;
  submitted_at: string;
}

interface Props {
  portal: ProjectPortal & {
    intro_title?: string | null;
    intro_content?: string | null;
  };
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '대기',     cls: 'bg-slate-100 text-slate-600' },
  submitted: { label: '제출완료', cls: 'bg-emerald-100 text-emerald-700' },
  confirmed: { label: '확정',     cls: 'bg-violet-100 text-violet-700' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}/${mm}/${dd}`;
}

export default function PortalOperatorView({ portal }: Props) {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [oRes, rRes] = await Promise.all([
        supabase.from('portal_beneficiary_orgs')
          .select('id, org_name, contact_name, contact_phone, status, created_at')
          .eq('portal_id', portal.id)
          .order('created_at'),
        supabase.from('portal_survey_responses')
          .select('id, beneficiary_org_id, org_name, answers, submitted_at')
          .eq('portal_id', portal.id)
          .order('submitted_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (oRes.error) console.error('[PortalOperatorView] orgs 조회:', oRes.error.message);
      if (rRes.error) console.error('[PortalOperatorView] responses 조회:', rRes.error.message);
      setOrgs((oRes.data ?? []) as OrgRow[]);
      setResponses((rRes.data ?? []) as ResponseRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [portal.id]);

  const submittedCount = orgs.filter((o) => o.status !== 'pending').length;

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-2xl border border-violet-100 shadow-card p-6 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#1E1B4B]">{portal.title}</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 border border-violet-200">
              주관기관 전용
            </span>
          </div>
          {portal.intro_title && (
            <p className="text-sm font-semibold text-slate-700 mt-2">{portal.intro_title}</p>
          )}
          {portal.intro_content && (
            <p className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">{portal.intro_content}</p>
          )}
        </div>

        {/* 현황 카드 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-violet-100 p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">전체 수혜기관</p>
            <p className="text-2xl font-bold text-[#1E1B4B] tabular-nums mt-1">{orgs.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 p-4">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">신청 완료</p>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-1">{submittedCount}</p>
          </div>
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-violet-100 p-8 text-center text-sm text-slate-400">
            아직 등록된 수혜기관이 없어요.
          </div>
        ) : (
          <ul className="space-y-2">
            {orgs.map((o) => {
              const badge = STATUS_BADGE[o.status] ?? STATUS_BADGE.pending;
              const orgResponses = responses.filter((r) => r.beneficiary_org_id === o.id);
              const expanded = expandedId === o.id;
              return (
                <li key={o.id} className="bg-white rounded-2xl border border-violet-100 overflow-hidden">
                  <button type="button" onClick={() => setExpandedId(expanded ? null : o.id)}
                    className="w-full p-4 text-left hover:bg-violet-50/30 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-bold text-[#1E1B4B] flex-1">{o.org_name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                      {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                      {o.contact_name && <span>{o.contact_name}</span>}
                      {o.contact_phone && (
                        <span className="inline-flex items-center gap-0.5">
                          <Phone size={10} aria-hidden="true" /> {o.contact_phone}
                        </span>
                      )}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
                      {orgResponses.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">아직 제출된 신청서가 없어요.</p>
                      ) : orgResponses.map((r) => (
                        <div key={r.id} className="bg-white rounded-lg border border-violet-100 p-3 space-y-1.5">
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Calendar size={10} aria-hidden="true" />
                            제출 {fmtDate(r.submitted_at)}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(r.answers ?? {}).map(([k, v]) => (
                              <div key={k} className="text-xs">
                                <span className="text-slate-500 font-semibold">{k}</span>
                                <span className="text-slate-400 mx-1">·</span>
                                <span className="text-slate-700">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
