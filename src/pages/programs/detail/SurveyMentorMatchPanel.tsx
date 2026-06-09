// 박경수님 2026-06-08 — 설문 응답 기반 멘토 매칭 패널
// date-schedule 응답에서 희망 일정 파싱 + club-autofill 에서 팀 정보 추출 → 멘토 배정

import { useState } from 'react';
import { UserCog, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { useCurriculumStaff } from './useCurriculumStaff';
import type { SurveyFormQuestion } from '../../../types/database';

interface ResponseSet {
  key: string;
  token: string;
  role: string;
  created_at: string;
  answers: ({ question_id: string | null; answer_text: string | null; answer_score: number | null } | undefined)[];
}

interface Props {
  programId: string;
  questions: SurveyFormQuestion[];
  responseSets: ResponseSet[];
}

interface ClubAnswer { clubId?: string; clubName?: string; school?: string; teacher?: string; phone?: string; }
interface DateScheduleAnswer { [month: string]: { date: string; time: string; duration: string }[] }

function parseClubAnswer(text: string | null): ClubAnswer | null {
  if (!text) return null;
  try { return JSON.parse(text) as ClubAnswer; } catch { return null; }
}

function parseDateSchedule(text: string | null): DateScheduleAnswer | null {
  if (!text) return null;
  try { return JSON.parse(text) as DateScheduleAnswer; } catch { return null; }
}

function formatScheduleSummary(ds: DateScheduleAnswer): string {
  return Object.entries(ds)
    .map(([month, slots]) => {
      const valid = slots.filter((s) => s.date);
      if (valid.length === 0) return null;
      return `${month}: ${valid.map((s, i) => `${i + 1}순위 ${s.date}${s.time ? ' ' + s.time : ''}`).join(', ')}`;
    })
    .filter(Boolean)
    .join(' / ');
}

// 희망일정 → 확정 후보 날짜 목록 (라벨)
function scheduleDateOptions(ds: DateScheduleAnswer | null): string[] {
  if (!ds) return [];
  const out: string[] = [];
  Object.entries(ds).forEach(([month, slots]) => {
    (slots ?? []).forEach((s) => {
      if (s.date) out.push(`${month} ${s.date}${s.time ? ` ${s.time}` : ''}${s.duration ? ` (${s.duration})` : ''}`);
    });
  });
  return out;
}

export default function SurveyMentorMatchPanel({ programId, questions, responseSets }: Props) {
  const toast = useToast();
  // 커리큘럼과 동일한 인력 목록 (전문가 풀 + 내부직원)
  const { staffOptions } = useCurriculumStaff();
  // 각 응답 세트의 멘토 배정값 (옵션 키 'sourceType_id') + 확정 날짜
  const [mentorMap, setMentorMap] = useState<Record<string, string>>({});
  const [dateMap, setDateMap] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  // club-autofill, date-schedule 문항 인덱스 찾기
  const clubIdx = questions.findIndex((q) => q.type === 'club-autofill');
  const dateIdx = questions.findIndex((q) => q.type === 'date-schedule');

  if (responseSets.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic text-center py-8">
        응답이 없어요. 팀이 설문에 응답하면 여기서 멘토를 매칭할 수 있어요.
      </p>
    );
  }

  async function handleSave(set: ResponseSet) {
    const optKey = mentorMap[set.key] ?? '';
    const opt = staffOptions.find((s) => `${s.sourceType}_${s.id}` === optKey);
    if (!opt) { toast.error('멘토를 선택해 주세요.'); return; }
    const mentor = opt.name;
    const confirmedDate = (dateMap[set.key] ?? '').trim();

    // club-autofill 에서 팀 정보
    const clubAns = clubIdx >= 0 ? parseClubAnswer(set.answers[clubIdx]?.answer_text ?? null) : null;
    const clubId = clubAns?.clubId;
    const teamName = clubAns?.clubName ?? set.token;

    setSavingKey(set.key);

    // 1) 팀(동아리)에 멘토 저장
    if (clubId) {
      const { error } = await supabase
        .from('program_clubs')
        .update({ mentor_name: mentor, updated_at: new Date().toISOString() })
        .eq('id', clubId);
      if (error) {
        console.error('[SurveyMentorMatchPanel] 멘토 저장 실패:', error.message);
        toast.error('저장 실패. 동아리 정보를 확인해 주세요.');
        setSavingKey(null); return;
      }
    }

    // 2) 강사진(instructor_invitations) 자동 등록 — 멘토 역할
    const sessionInfo = `${teamName} 멘토링${confirmedDate ? ` · ${confirmedDate}` : ''}`;
    const { error: invErr } = await supabase.from('instructor_invitations').insert({
      program_id: programId,
      expert_id: opt.sourceType === 'staff_pool' ? opt.id : null,
      staff_pool_id: opt.sourceType === 'staff_pool' ? opt.id : null,
      profile_id: opt.sourceType === 'profile' ? opt.id : null,
      name: mentor,
      role: 'mentor',
      status: '대기',
      session_info: sessionInfo,
      notes: `설문 멘토 매칭 자동 등록 (${teamName})`,
      invited_at: new Date().toISOString(),
    });
    if (invErr) {
      console.error('[SurveyMentorMatchPanel] 강사 자동등록 실패:', invErr.message);
      toast.error('멘토는 저장됐지만 강사진 자동등록에 실패했어요.');
      setSavingKey(null);
      setSavedKeys((prev) => new Set(prev).add(set.key));
      return;
    }

    setSavingKey(null);
    setSavedKeys((prev) => new Set(prev).add(set.key));
    toast.success(`${mentor} 멘토를 배정하고 강사진에 등록했어요.`);
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">
        설문 응답에서 추출한 팀 정보와 희망 일정이에요. 멘토를 배정하면 해당 팀의 멘토 정보가 업데이트돼요.
      </p>

      {responseSets.map((set) => {
        const clubAns = clubIdx >= 0 ? parseClubAnswer(set.answers[clubIdx]?.answer_text ?? null) : null;
        const dateAns = dateIdx >= 0 ? parseDateSchedule(set.answers[dateIdx]?.answer_text ?? null) : null;
        const isSaved = savedKeys.has(set.key);
        const isSaving = savingKey === set.key;

        return (
          <div key={set.key}
            className={`rounded-xl border p-3 space-y-2 ${isSaved ? 'border-emerald-200 bg-emerald-50/30' : 'border-violet-100 bg-white'}`}>
            {/* 팀 정보 */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-[#1E1B4B]">
                  {clubAns?.clubName ?? '팀 미지정'}
                  {clubAns?.school && <span className="text-slate-500 font-normal text-xs ml-1.5">({clubAns.school})</span>}
                </p>
                {clubAns?.teacher && (
                  <p className="text-[11px] text-slate-500">지도교사 {clubAns.teacher}{clubAns.phone ? ` · ${clubAns.phone}` : ''}</p>
                )}
              </div>
              {isSaved && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold shrink-0">
                  <CheckCircle2 size={13} aria-hidden="true" /> 배정 완료
                </span>
              )}
            </div>

            {/* 희망 일정 */}
            {dateAns && (
              <div className="rounded-lg bg-violet-50/50 border border-violet-100 px-3 py-2 text-[11px] text-slate-600">
                <span className="font-bold text-violet-700 mr-1.5">희망 일정</span>
                {formatScheduleSummary(dateAns) || '미입력'}
              </div>
            )}

            {/* 멘토 배정 — 인력 명단 선택 + 확정 날짜 선택 → 배정 시 강사진 자동 등록 */}
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <UserCog size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" aria-hidden="true" />
                  <select
                    value={mentorMap[set.key] ?? ''}
                    onChange={(e) => setMentorMap((prev) => ({ ...prev, [set.key]: e.target.value }))}
                    className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-violet-400"
                  >
                    <option value="">멘토 선택</option>
                    {staffOptions.map((s) => (
                      <option key={`${s.sourceType}_${s.id}`} value={`${s.sourceType}_${s.id}`}>
                        {s.name}{s.organization ? ` (${s.organization})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSave(set)}
                  disabled={isSaving || !(mentorMap[set.key] ?? '')}
                  className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 shrink-0"
                >
                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  배정
                </button>
              </div>
              {/* 확정 날짜 선택 (희망일정에서) */}
              {(() => {
                const opts = scheduleDateOptions(dateAns);
                if (opts.length === 0) return null;
                return (
                  <select
                    value={dateMap[set.key] ?? ''}
                    onChange={(e) => setDateMap((prev) => ({ ...prev, [set.key]: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-violet-400 text-slate-600"
                  >
                    <option value="">확정 날짜 선택 (선택) — 희망일정 중</option>
                    {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}
