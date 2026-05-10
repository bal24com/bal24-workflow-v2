// bal24 v2 — STEP-PARTICIPANT-PORTAL 참여자 외부 토큰 포털 (/participant/:token)

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Calendar, MapPin, ExternalLink, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  PARTICIPANT_ROLE_LABEL, PARTICIPANT_ROLE_BADGE,
  fetchParticipantByToken, type ParticipantPortalContext,
} from '../../lib/participantUtils';
import { formatDateKo } from '../../lib/utils';
import type { ProgramCurriculum } from '../../types/database';

type Screen = 'loading' | 'invalid' | 'expired' | 'ready';

interface CertSummary {
  id: string;
  cert_number: string | null;
  issue_date: string;
  token: string;
}

export default function ParticipantPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<Screen>('loading');
  const [ctx, setCtx] = useState<ParticipantPortalContext | null>(null);
  const [curriculum, setCurriculum] = useState<ProgramCurriculum[]>([]);
  const [cert, setCert] = useState<CertSummary | null>(null);

  useEffect(() => {
    if (!token) { setScreen('invalid'); return; }
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchParticipantByToken(token);
        if (cancelled) return;
        if (!result) { setScreen('invalid'); return; }
        setCtx(result);

        // 커리큘럼 + 수료증 병렬 조회
        const [curRes, certRes] = await Promise.all([
          supabase.from('program_curriculum').select('*')
            .eq('program_id', result.program.id).order('session_no'),
          result.participant.status === 'completed'
            ? supabase.from('issued_certificates')
                .select('id, cert_number, issue_date, token')
                .eq('program_id', result.program.id)
                .ilike('recipient_name', result.participant.name)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (cancelled) return;
        if (curRes.error) console.error('[participant-portal] 커리큘럼 조회 실패:', curRes.error.message);
        if (certRes.error) console.error('[participant-portal] 수료증 조회 실패:', certRes.error.message);
        setCurriculum((curRes.data ?? []) as ProgramCurriculum[]);
        setCert((certRes.data as CertSummary | null) ?? null);
        setScreen('ready');
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[participant-portal] 처리 중 오류:', raw);
        setScreen('invalid');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 size={28} className="animate-spin text-violet-500" aria-hidden="true" />
          <p className="text-sm text-muted">참여 정보를 불러오는 중이에요…</p>
        </div>
      </div>
    );
  }

  if (screen === 'invalid' || !ctx) {
    return <CenterCard emoji="🔍" title="유효하지 않은 링크입니다." desc="링크를 다시 확인해 주세요." />;
  }

  if (screen === 'expired') {
    return <CenterCard emoji="⏱️" title="링크가 만료됐어요." desc="담당자에게 문의해 주세요." />;
  }

  const { participant: p, program } = ctx;
  const statusLabel = p.status === 'completed' ? '수료 완료' : '참여 중';
  const statusClass = p.status === 'completed'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-emerald-100 text-emerald-800';

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8">
      <div className="w-full max-w-2xl mx-auto space-y-4">
        {/* 헤더 */}
        <header className="rounded-2xl bg-violet-600 text-white px-6 py-5 shadow-md">
          <div className="text-xs text-white/70 mb-1">BalanceDot WorkFlow</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PARTICIPANT_ROLE_BADGE[p.role]}`}>
              {PARTICIPANT_ROLE_LABEL[p.role]}
            </span>
            <h1 className="text-lg font-bold">{p.name}님</h1>
          </div>
        </header>

        {/* 프로그램 카드 */}
        <section className="rounded-2xl bg-white border border-violet-100 shadow-sm p-6 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-900">{program.name}</h2>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusClass}`}>{statusLabel}</span>
          </div>
          <div className="space-y-1.5 text-sm text-slate-600">
            {(program.start_date || program.end_date) && (
              <div className="flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" aria-hidden="true" />
                {formatDateKo(program.start_date)} ~ {formatDateKo(program.end_date)}
              </div>
            )}
            {program.venue && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-slate-400" aria-hidden="true" />
                {program.venue}
              </div>
            )}
          </div>
        </section>

        {/* 커리큘럼 */}
        <section className="rounded-2xl bg-white border border-violet-100 shadow-sm p-6 space-y-3">
          <h3 className="text-sm font-bold text-gray-900">커리큘럼</h3>
          {curriculum.length === 0 ? (
            <p className="text-sm text-slate-400 italic">등록된 커리큘럼이 없어요.</p>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-1">
              {curriculum.map((c) => (
                <li key={c.id} className="px-1 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-violet-600 tabular-nums">#{c.session_no}</span>
                    <span className="text-sm font-semibold text-slate-800">{c.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    {c.day_label && <span>{c.day_label}</span>}
                    {c.session_date && <span>{formatDateKo(c.session_date)}</span>}
                    {c.start_time && c.end_time && <span>{c.start_time.slice(0, 5)} ~ {c.end_time.slice(0, 5)}</span>}
                    {c.venue && <span>· {c.venue}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 수료증 안내 (status=completed) */}
        {p.status === 'completed' && (
          <section className="rounded-2xl bg-blue-50 border border-blue-200 p-6 space-y-2">
            <h3 className="text-sm font-bold text-blue-900 inline-flex items-center gap-1">
              <Award size={14} aria-hidden="true" />
              수료증 안내
            </h3>
            {cert ? (
              <div className="space-y-2">
                <p className="text-sm text-blue-800">수료증이 발급됐어요.</p>
                <p className="text-[11px] text-blue-700">
                  {cert.cert_number && `증서번호. ${cert.cert_number} · `}발급일. {formatDateKo(cert.issue_date)}
                </p>
                <a href={`/cert/${cert.token}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
                  수료증 보기 <ExternalLink size={12} aria-hidden="true" />
                </a>
              </div>
            ) : (
              <p className="text-sm text-blue-700">수료증은 담당자가 발급 후 확인할 수 있어요.</p>
            )}
          </section>
        )}

        <p className="text-center text-xs text-slate-400 py-4">
          © 2026 (주)밸런스닷 · WorkFlow
        </p>
      </div>
    </div>
  );
}

function CenterCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-2 max-w-sm">
        <div className="text-3xl">{emoji}</div>
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
