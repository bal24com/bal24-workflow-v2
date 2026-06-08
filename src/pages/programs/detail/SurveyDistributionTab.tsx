// 설문 배포 관리 탭 — 사전 등록 동아리별 응답 현황 추적 + 링크 일괄 복사.
// program_clubs × survey_responses 교차 분석 → 미응답자 선별 발송 지원.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Copy, CheckCircle2, ExternalLink, School, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import type { ProgramSurveyForm } from '../../../types/database';

interface Props {
  form: ProgramSurveyForm;
}

interface ClubRow {
  id: string;
  club_name: string;
  school_name: string | null;
  teacher_name: string | null;
  teacher_phone: string | null;
  club_token: string;
}

interface ClubStatus extends ClubRow {
  responded: boolean;
}

function buildLink(token: string) {
  return `${window.location.origin}/share/club/${token}`;
}

function buildMessage(school: string, clubs: ClubStatus[], onlyPending: boolean): string {
  const targets = onlyPending ? clubs.filter((c) => !c.responded) : clubs;
  if (targets.length === 0) return '';
  const lines = [
    `안녕하세요, ${school} 담당 선생님!`,
    onlyPending
      ? '[재안내] 아직 응답하지 않은 팀의 링크를 보내드려요. 빠른 참여 부탁드려요.'
      : '설문 링크를 안내드려요. 아래 팀별 링크로 응답해 주세요.',
    '',
    ...targets.map((c) => `📌 ${c.club_name}  →  ${buildLink(c.club_token)}`),
    '',
    '※ 팀마다 다른 링크를 사용해야 합니다.',
    '감사합니다.',
  ];
  return lines.join('\n');
}

export default function SurveyDistributionTab({ form }: Props) {
  const toast = useToast();
  const [clubs, setClubs] = useState<ClubStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // 사전 등록 동아리 목록
    const { data: clubData, error: clubErr } = await supabase
      .from('program_clubs')
      .select('id, club_name, school_name, teacher_name, teacher_phone, club_token')
      .eq('program_id', form.program_id)
      .order('school_name');
    if (clubErr) {
      console.error('[SurveyDistributionTab] 동아리 조회 실패:', clubErr.message);
      toast.error('동아리 목록을 불러오지 못했어요.');
      setLoading(false);
      return;
    }
    const list = (clubData ?? []) as ClubRow[];

    // 이 설문에 응답한 토큰 집합
    const respondedSet = new Set<string>();
    if (list.length > 0) {
      const { data: resData, error: resErr } = await supabase
        .from('survey_responses')
        .select('respondent_token')
        .eq('form_id', form.id);
      if (resErr) {
        console.error('[SurveyDistributionTab] 응답 조회 실패:', resErr.message);
      } else {
        (resData ?? []).forEach((r) => {
          const t = (r as { respondent_token: string | null }).respondent_token;
          if (t) respondedSet.add(t);
        });
      }
    }

    setClubs(list.map((c) => ({ ...c, responded: respondedSet.has(c.club_token) })));
    setLoading(false);
  }, [form.id, form.program_id, toast]);

  useEffect(() => { void load(); }, [load]);

  // 학교별 그룹
  const bySchool = (() => {
    const map = new Map<string, ClubStatus[]>();
    clubs.forEach((c) => {
      const key = c.school_name ?? '학교 미지정';
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  })();

  const respondedCount = clubs.filter((c) => c.responded).length;
  const pendingCount = clubs.length - respondedCount;
  const pct = clubs.length > 0 ? Math.round((respondedCount / clubs.length) * 100) : 0;

  async function copyIndividual(club: ClubStatus) {
    const ok = await copyToClipboard(buildLink(club.club_token));
    if (ok) {
      setCopiedToken(club.club_token);
      toast.success(`${club.club_name} 링크를 복사했어요.`);
      setTimeout(() => setCopiedToken(null), 2500);
    } else {
      toast.error('복사에 실패했어요.');
    }
  }

  async function copySchool(school: string, schoolClubs: ClubStatus[], onlyPending: boolean) {
    const msg = buildMessage(school, schoolClubs, onlyPending);
    if (!msg) { toast.error('복사할 대상이 없어요.'); return; }
    const ok = await copyToClipboard(msg);
    if (ok) toast.success(`${school} ${onlyPending ? '미응답' : '전체'} 링크를 복사했어요.`);
    else toast.error('복사에 실패했어요.');
  }

  async function copyAllPending() {
    const parts = bySchool
      .map(([school, sc]) => buildMessage(school, sc, true))
      .filter(Boolean);
    if (parts.length === 0) { toast.error('미응답 팀이 없어요.'); return; }
    const ok = await copyToClipboard(parts.join('\n\n---\n\n'));
    if (ok) toast.success('미응답 팀 전체 링크를 복사했어요.');
    else toast.error('복사에 실패했어요.');
  }

  async function copyAll() {
    const parts = bySchool
      .map(([school, sc]) => buildMessage(school, sc, false))
      .filter(Boolean);
    if (parts.length === 0) { toast.error('복사할 동아리가 없어요.'); return; }
    const ok = await copyToClipboard(parts.join('\n\n---\n\n'));
    if (ok) toast.success('전체 링크를 복사했어요.');
    else toast.error('복사에 실패했어요.');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (clubs.length === 0) {
    return (
      <div className="text-center py-10 space-y-2">
        <p className="text-sm text-slate-500">등록된 동아리가 없어요.</p>
        <p className="text-xs text-slate-400">동아리 탭에서 먼저 등록하면 여기서 응답 현황을 관리할 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 응답 현황 요약 */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-violet-700">전체 {clubs.length}팀 응답 현황</span>
          <button type="button" onClick={() => void load()}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-violet-700">
            <RefreshCw size={11} aria-hidden="true" /> 새로고침
          </button>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className="bg-violet-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-3 text-[11px]">
          <span className="text-emerald-700 font-bold">✅ 응답 {respondedCount}팀</span>
          <span className="text-slate-500">·</span>
          <span className="text-orange-600 font-bold">⏳ 미응답 {pendingCount}팀</span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-600">{pct}%</span>
        </div>
      </div>

      {/* 일괄 복사 버튼 */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => void copyAllPending()}
          disabled={pendingCount === 0}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-40">
          <Copy size={12} aria-hidden="true" /> 미응답 {pendingCount}팀 링크 복사
        </button>
        <button type="button" onClick={() => void copyAll()}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-violet-200 text-violet-700 text-xs font-bold hover:bg-violet-50">
          <Copy size={12} aria-hidden="true" /> 전체 링크 복사
        </button>
      </div>

      {/* 학교별 목록 */}
      <div className="space-y-3">
        {bySchool.map(([school, schoolClubs]) => {
          const schoolPending = schoolClubs.filter((c) => !c.responded).length;
          return (
            <div key={school} className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <School size={12} className="text-violet-600 shrink-0" aria-hidden="true" />
                  <span className="text-xs font-bold text-[#1E1B4B] truncate">{school}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {schoolClubs.filter((c) => c.responded).length}/{schoolClubs.length} 응답
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {schoolPending > 0 && (
                    <button type="button" onClick={() => void copySchool(school, schoolClubs, true)}
                      className="inline-flex items-center gap-1 px-2 h-6 rounded text-[10px] font-bold bg-orange-100 text-orange-700 hover:bg-orange-200">
                      미응답 복사
                    </button>
                  )}
                  <button type="button" onClick={() => void copySchool(school, schoolClubs, false)}
                    className="inline-flex items-center gap-1 px-2 h-6 rounded text-[10px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-200">
                    전체 복사
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-slate-100">
                {schoolClubs.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1E1B4B] truncate">{c.club_name}</p>
                      {c.teacher_name && (
                        <p className="text-[10px] text-slate-400 truncate">
                          지도교사 {c.teacher_name}{c.teacher_phone ? ` · ${c.teacher_phone}` : ''}
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      c.responded
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {c.responded ? '✅ 응답' : '⏳ 미응답'}
                    </span>
                    <div className="flex gap-0.5 shrink-0">
                      <button type="button" onClick={() => void copyIndividual(c)}
                        title="링크 복사"
                        className={`p-1.5 rounded transition-colors ${
                          copiedToken === c.club_token
                            ? 'text-emerald-600 bg-emerald-50'
                            : 'text-violet-600 hover:bg-violet-50'
                        }`}>
                        {copiedToken === c.club_token
                          ? <CheckCircle2 size={13} aria-hidden="true" />
                          : <Copy size={13} aria-hidden="true" />}
                      </button>
                      <a href={buildLink(c.club_token)} target="_blank" rel="noreferrer"
                        title="새 탭에서 열기"
                        className="p-1.5 rounded text-violet-600 hover:bg-violet-50">
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
