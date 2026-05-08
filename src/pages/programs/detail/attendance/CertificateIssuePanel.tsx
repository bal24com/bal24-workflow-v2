// bal24 v2 — 수료증 일괄 발급 패널 (Stage 11-②)
// 출석률 자동 산출 (80% 이상 = 수료) + 후보 목록 + [일괄 발급] → issued_certificates INSERT.

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, RefreshCw, Award, CheckCircle2, ExternalLink, Copy,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import {
  calculateAttendanceForProgram, COMPLETION_THRESHOLD, type AttendanceStats,
} from '../../../../lib/attendanceCalculator';
import { formatDateKo } from '../../../../lib/utils';
import type { CertificateTemplate } from '../../../../types/database';

interface Props {
  programId: string;
}

interface IssuedRow {
  id: string;
  recipient_name: string;
  cert_number: string | null;
  issue_date: string;
  token: string;
}

function buildCertUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/cert/${token}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CertificateIssuePanel({ programId }: Props) {
  const toast = useToast();
  const [stats, setStats] = useState<AttendanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [template, setTemplate] = useState<CertificateTemplate | null>(null);
  const [issued, setIssued] = useState<IssuedRow[]>([]);
  const [issuing, setIssuing] = useState(false);

  const refresh = useCallback(async () => {
    setCalculating(true);
    try {
      const [s, tpl, iss] = await Promise.all([
        calculateAttendanceForProgram(programId),
        supabase
          .from('certificate_templates')
          .select('*')
          .eq('program_id', programId)
          .eq('cert_type', 'completion')
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('issued_certificates')
          .select('id, recipient_name, cert_number, issue_date, token')
          .eq('program_id', programId)
          .eq('cert_type', 'completion')
          .order('issue_date', { ascending: false }),
      ]);
      setStats(s);
      if (tpl.error) console.error('[step-11/cert] 템플릿 조회 실패:', tpl.error.message);
      else setTemplate((tpl.data as CertificateTemplate | null) ?? null);
      if (iss.error) console.error('[step-11/cert] 발급 목록 실패:', iss.error.message);
      else setIssued((iss.data as IssuedRow[] | null) ?? []);
    } finally {
      setCalculating(false);
    }
  }, [programId]);

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

  const candidates = stats.filter((s) => s.isCompletion);
  const issuedNames = new Set(issued.map((i) => i.recipient_name));
  const newCandidates = candidates.filter((c) => !issuedNames.has(c.name));

  async function issueAll() {
    if (newCandidates.length === 0) {
      toast.info('새로 발급할 후보가 없어요.');
      return;
    }
    if (!template) {
      toast.error('수료증 템플릿이 없어요. 수료증 메뉴에서 먼저 만들어 주세요.');
      return;
    }
    if (!window.confirm(`${newCandidates.length}명에게 수료증을 일괄 발급할까요?`)) return;

    setIssuing(true);
    try {
      const today = todayIso();
      const lastNo = issued.reduce((m, r) => {
        const num = parseInt((r.cert_number ?? '').replace(/\D/g, ''), 10);
        return Number.isFinite(num) ? Math.max(m, num) : m;
      }, 0);

      const payload = newCandidates.map((c, idx) => ({
        template_id: template.id,
        program_id: programId,
        cert_type: 'completion' as const,
        recipient_type: 'student' as const,
        recipient_name: c.name,
        issue_date: today,
        cert_number: `CERT-${today.replace(/-/g, '')}-${String(lastNo + idx + 1).padStart(4, '0')}`,
      }));

      const { error } = await supabase.from('issued_certificates').insert(payload);
      if (error) {
        console.error('[step-11/cert] 일괄 발급 실패:', error.message);
        toast.error('일괄 발급에 실패했어요.');
        return;
      }
      toast.success(`${newCandidates.length}명에게 수료증을 발급했어요.`);
      void refresh();
    } finally {
      setIssuing(false);
    }
  }

  async function handleCopyCert(token: string, name: string) {
    const ok = await copyToClipboard(buildCertUrl(token));
    if (ok) toast.success(`${name}님 수료증 링크 복사 완료`);
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
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-bold text-[#1E1B4B]">수료증 일괄 발급</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            출석률 {COMPLETION_THRESHOLD}% 이상 자동 산출 — 검토 후 일괄 발급
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={calculating}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 transition-colors"
          >
            {calculating ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={12} aria-hidden="true" />}
            다시 계산
          </button>
          <button
            type="button"
            onClick={() => void issueAll()}
            disabled={issuing || newCandidates.length === 0 || !template}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {issuing ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Award size={12} aria-hidden="true" />}
            일괄 발급 ({newCandidates.length})
          </button>
        </div>
      </header>

      {!template && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800">
          ⚠️ 이 프로그램의 수료증 템플릿이 없어요. <b>수료증 메뉴 (`/certificates`)</b>에서 먼저 만들고 다시 시도해 주세요.
        </div>
      )}

      {/* 출석률 산출 결과 */}
      <section className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
        <p className="text-[11px] font-bold text-slate-600 mb-2">학생별 출석률 ({stats.length}명)</p>
        {stats.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-2">
            아직 출석 기록이 없어요. 먼저 출석 세션을 만들고 학생들의 체크인을 받아주세요.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {stats.map((s) => (
              <li
                key={s.key}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                  s.isCompletion ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white opacity-80'
                }`}
              >
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[#1E1B4B]">
                  {s.name}
                </span>
                {s.phone && (
                  <span className="hidden sm:inline shrink-0 text-[10px] text-slate-400 tabular-nums">
                    {s.phone}
                  </span>
                )}
                <span className={`shrink-0 text-xs font-bold tabular-nums ${
                  s.isCompletion ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  {s.attendanceRate}%
                </span>
                {s.isCompletion && (
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-600" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        )}
        {stats.length > 0 && (
          <p className="mt-2 text-[10px] text-slate-500">
            ⓘ 분모: 프로그램의 모든 출석 세션 / 분자: O+△ 카운트. 동일 학생 식별은 전화번호 기준.
          </p>
        )}
      </section>

      {/* 발급 완료 목록 */}
      {issued.length > 0 && (
        <section className="rounded-xl border border-violet-100 bg-white p-3">
          <p className="text-[11px] font-bold text-slate-600 mb-2">발급된 수료증 ({issued.length}건)</p>
          <ul className="flex flex-col gap-1.5">
            {issued.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-md border border-violet-100 bg-violet-50/30 px-3 py-2"
              >
                <Award size={13} className="shrink-0 text-violet-600" aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[#1E1B4B]">
                  {r.recipient_name}
                </span>
                {r.cert_number && (
                  <span className="hidden sm:inline shrink-0 text-[10px] text-slate-500 tabular-nums">
                    {r.cert_number}
                  </span>
                )}
                <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                  {formatDateKo(r.issue_date).replace(/^\d{4}년\s/, '')}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyCert(r.token, r.recipient_name)}
                  title="수료증 링크 복사"
                  className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                >
                  <Copy size={12} aria-hidden="true" />
                </button>
                <a
                  href={buildCertUrl(r.token)}
                  target="_blank"
                  rel="noreferrer"
                  title="수료증 새 탭"
                  className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                >
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
