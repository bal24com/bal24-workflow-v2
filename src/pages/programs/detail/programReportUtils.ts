// bal24 v2 — STEP-PROGRAM-REPORT-TAB
// 결과보고서 섹션 fetch·upsert + 6섹션 자동집계 (AI 없이 DB 데이터로 순수 텍스트 조합)

import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import type { ProgramReportSection, ProgramReportSectionKey } from '../../../types/database';

export async function fetchReportSections(programId: string): Promise<ProgramReportSection[]> {
  const { data, error } = await supabase
    .from('program_report_sections')
    .select('*')
    .eq('program_id', programId)
    .order('sort_order');
  if (error) {
    console.error('[program-report] 섹션 조회 실패:', error.message);
    return [];
  }
  return (data ?? []) as ProgramReportSection[];
}

export async function saveReportSection(
  programId: string,
  sectionKey: ProgramReportSectionKey,
  content: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from('program_report_sections')
    .upsert(
      { program_id: programId, section_key: sectionKey, content, sort_order: sortOrder, updated_at: new Date().toISOString() },
      { onConflict: 'program_id,section_key' },
    );
  if (error) {
    console.error('[program-report] 저장 실패:', error.message);
    throw new Error(error.message);
  }
}

// ─── 자동집계 ─────────────────────────────────────────

export async function generateOverview(programId: string): Promise<string> {
  const { data, error } = await supabase.from('programs')
    .select('name, type, start_date, end_date, venue, capacity, target_audience, client_org, description')
    .eq('id', programId).maybeSingle();
  if (error || !data) return '프로그램 정보를 불러오지 못했어요.';
  const lines: string[] = [];
  lines.push(`■ 사업명: ${data.name}`);
  if (data.type) lines.push(`■ 유형: ${data.type}`);
  if (data.client_org) lines.push(`■ 주관: ${data.client_org}`);
  if (data.start_date || data.end_date) {
    lines.push(`■ 기간: ${formatDateKo(data.start_date) || '미정'} ~ ${formatDateKo(data.end_date) || '미정'}`);
  }
  if (data.venue) lines.push(`■ 장소: ${data.venue}`);
  if (data.target_audience) lines.push(`■ 교육 대상: ${data.target_audience}`);
  if (data.capacity != null) lines.push(`■ 정원: ${data.capacity}명`);
  if (data.description) lines.push('', '■ 사업 개요', data.description);
  return lines.join('\n');
}

export async function generateCurriculum(programId: string): Promise<string> {
  // report_curriculum_type 우선 사용 (없으면 'actual')
  const progRes = await supabase.from('programs').select('report_curriculum_type').eq('id', programId).maybeSingle();
  const targetType = progRes.data?.report_curriculum_type ?? 'actual';
  const { data, error } = await supabase.from('program_curriculum')
    .select('session_no, day_label, title, content, start_time, end_time, venue, curriculum_type')
    .eq('program_id', programId).eq('curriculum_type', targetType)
    .order('session_no');
  if (error) return '커리큘럼 정보를 불러오지 못했어요.';
  if (!data || data.length === 0) return `등록된 ${targetType === 'actual' ? '실제 운영' : '제안'} 커리큘럼이 없어요.`;
  const lines: string[] = [`총 ${data.length}차시 커리큘럼이 운영되었습니다.`, ''];
  for (const c of data) {
    const day = c.day_label ? `[${c.day_label}] ` : '';
    const time = (c.start_time && c.end_time) ? ` (${c.start_time.slice(0, 5)}~${c.end_time.slice(0, 5)})` : '';
    lines.push(`${c.session_no}차시 — ${day}${c.title}${time}`);
    if (c.content) lines.push(`  · ${c.content}`);
    if (c.venue) lines.push(`  · 장소: ${c.venue}`);
  }
  return lines.join('\n');
}

export async function generateParticipants(programId: string): Promise<string> {
  const { data, error } = await supabase.from('participant_applications')
    .select('status, attendance_rate, completed_at, gender')
    .eq('program_id', programId).is('deleted_at', null);
  if (error) return '교육생 신청 데이터를 불러오지 못했어요.';
  if (!data || data.length === 0) return '교육생 신청 데이터가 없어요.';
  const total = data.length;
  const counts = data.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const completed = data.filter((r) => r.completed_at != null).length;
  const rates = data.map((r) => r.attendance_rate).filter((v): v is number => v != null);
  const avgRate = rates.length > 0 ? Math.round(rates.reduce((s, v) => s + v, 0) / rates.length) : null;
  const genderM = data.filter((r) => r.gender === 'male').length;
  const genderF = data.filter((r) => r.gender === 'female').length;
  const lines = [
    `■ 신청 인원: 총 ${total}명`,
    `  · 신청: ${counts.applied ?? 0} · 검토: ${counts.reviewing ?? 0} · 승인: ${counts.accepted ?? 0} · 반려: ${counts.rejected ?? 0} · 철회: ${counts.withdrawn ?? 0}`,
    `■ 수료: ${completed}명${total > 0 ? ` (${Math.round((completed / total) * 100)}%)` : ''}`,
  ];
  if (avgRate != null) lines.push(`■ 평균 출석률: ${avgRate}%`);
  if (genderM + genderF > 0) lines.push(`■ 성별: 남 ${genderM}명 · 여 ${genderF}명`);
  return lines.join('\n');
}

export async function generateAttendance(programId: string): Promise<string> {
  const { data, error } = await supabase.from('program_attendance_records')
    .select('participant_id, day_label, is_present')
    .eq('program_id', programId);
  if (error) return '출석 데이터를 불러오지 못했어요.';
  if (!data || data.length === 0) return '출석 기록이 없어요.';
  const days = Array.from(new Set(data.map((r) => r.day_label).filter(Boolean))) as string[];
  const totalChecks = data.length;
  const presentCnt = data.filter((r) => r.is_present === true).length;
  const overallRate = totalChecks > 0 ? Math.round((presentCnt / totalChecks) * 100) : 0;
  const lines = [
    `■ 총 출석 기록: ${totalChecks}건`,
    `■ 전체 출석률: ${overallRate}% (${presentCnt}/${totalChecks})`,
    `■ 진행 차수: ${days.length}일차`,
  ];
  if (days.length > 0) {
    lines.push('', '■ 일자별 출석 현황');
    for (const d of days.sort((a, b) => {
      const na = Number((a.match(/\d+/) ?? ['0'])[0]);
      const nb = Number((b.match(/\d+/) ?? ['0'])[0]);
      return na - nb;
    })) {
      const rows = data.filter((r) => r.day_label === d);
      const p = rows.filter((r) => r.is_present === true).length;
      lines.push(`  · ${d}: ${p}/${rows.length}명 출석 (${rows.length > 0 ? Math.round((p / rows.length) * 100) : 0}%)`);
    }
  }
  return lines.join('\n');
}

export async function generateSatisfaction(programId: string): Promise<string> {
  const { data, error } = await supabase.from('satisfaction_surveys')
    .select('total_count, avg_overall, summary_json, ai_overall, comments')
    .eq('program_id', programId).order('uploaded_at', { ascending: false });
  if (error) return '만족도 데이터를 불러오지 못했어요.';
  if (!data || data.length === 0) return '업로드된 만족도 응답이 없어요.';
  const totalResponses = data.reduce((s, r) => s + (r.total_count ?? 0), 0);
  const avgs = data.map((r) => r.avg_overall).filter((v): v is number => v != null);
  const overall = avgs.length > 0 ? (avgs.reduce((s, v) => s + v, 0) / avgs.length).toFixed(2) : null;
  const lines = [`■ 응답 수: 총 ${totalResponses}건`, `■ 분석 파일: ${data.length}건`];
  if (overall != null) lines.push(`■ 전체 만족도 평균: ${overall} / 5.0`);
  // 항목별 평균 (가장 최근 파일 우선)
  const latest = data[0];
  if (latest.summary_json && typeof latest.summary_json === 'object') {
    const entries = Object.entries(latest.summary_json as Record<string, number>);
    if (entries.length > 0) {
      lines.push('', '■ 항목별 평균 (최근 분석)');
      for (const [q, v] of entries) lines.push(`  · ${q}: ${typeof v === 'number' ? v.toFixed(2) : v}`);
    }
  }
  if (latest.ai_overall) lines.push('', '■ AI 분석 요약', latest.ai_overall);
  const comments = (latest.comments ?? []).filter(Boolean).slice(0, 5);
  if (comments.length > 0) {
    lines.push('', '■ 자유 의견 (상위 5건)');
    for (const c of comments) lines.push(`  · ${c}`);
  }
  return lines.join('\n');
}

export function generateOutcomesPlaceholder(): string {
  return [
    '■ 주요 성과',
    '  · ',
    '',
    '■ 정성적 효과',
    '  · ',
    '',
    '■ 개선·시사점',
    '  · ',
    '',
    '※ 자동집계 불가 항목입니다. 직접 작성해 주세요.',
  ].join('\n');
}

export type SectionGenerator = (programId: string) => Promise<string>;

export const SECTION_GENERATORS: Record<ProgramReportSectionKey, SectionGenerator | null> = {
  overview:     generateOverview,
  curriculum:   generateCurriculum,
  participants: generateParticipants,
  attendance:   generateAttendance,
  satisfaction: generateSatisfaction,
  outcomes:     async () => generateOutcomesPlaceholder(),
  extra:        null,
};
