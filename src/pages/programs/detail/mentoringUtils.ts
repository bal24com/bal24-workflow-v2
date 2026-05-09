// bal24 v2 — 멘토링 fetch / Storage / Word 다운로드 헬퍼 (STEP-MENTORING)

import { supabase } from '../../../lib/supabase';
import type { MentoringAssignment, MentoringSession } from '../../../types/mentoring';

const MENTORING_BUCKET = 'mentoring-sessions';

/** 프로그램의 모든 멘토링 배정 + 세션 fetch */
export async function fetchMentoringAssignments(
  programId: string,
): Promise<MentoringAssignment[]> {
  const { data, error } = await supabase
    .from('mentoring_assignments')
    .select(`
      *,
      mentor_pool:staff_pool!mentor_pool_id(id, name, specialty),
      mentor_profile:profiles!mentor_profile_id(id, name, specialty),
      sessions:mentoring_sessions(*)
    `)
    .eq('program_id', programId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[mentoring] 멘토링 배정 조회 실패:', error.message);
    return [];
  }
  return (data as unknown as MentoringAssignment[] | null) ?? [];
}

/** 토큰으로 멘토 본인 배정 fetch */
export async function fetchAssignmentByMentorToken(
  token: string,
): Promise<MentoringAssignment | null> {
  const { data, error } = await supabase
    .from('mentoring_assignments')
    .select(`
      *,
      mentor_pool:staff_pool!mentor_pool_id(id, name, specialty),
      mentor_profile:profiles!mentor_profile_id(id, name, specialty),
      sessions:mentoring_sessions(*)
    `)
    .eq('mentor_access_token', token)
    .maybeSingle();
  if (error) {
    console.error('[mentoring] 멘토 토큰 조회 실패:', error.message);
    return null;
  }
  return (data as unknown as MentoringAssignment | null) ?? null;
}

/** 토큰으로 멘티 측 배정 fetch */
export async function fetchAssignmentByMenteeToken(
  token: string,
): Promise<MentoringAssignment | null> {
  const { data, error } = await supabase
    .from('mentoring_assignments')
    .select(`
      *,
      mentor_pool:staff_pool!mentor_pool_id(id, name, specialty),
      mentor_profile:profiles!mentor_profile_id(id, name, specialty),
      sessions:mentoring_sessions(*)
    `)
    .eq('mentee_access_token', token)
    .maybeSingle();
  if (error) {
    console.error('[mentoring] 멘티 토큰 조회 실패:', error.message);
    return null;
  }
  return (data as unknown as MentoringAssignment | null) ?? null;
}

/** PARTNER 로그인 사용자의 본인 배정 목록 */
export async function fetchMyMentorAssignments(
  profileId: string,
): Promise<MentoringAssignment[]> {
  const { data, error } = await supabase
    .from('mentoring_assignments')
    .select(`
      *,
      mentor_profile:profiles!mentor_profile_id(id, name, specialty),
      sessions:mentoring_sessions(*),
      program:programs(id, name, status)
    `)
    .eq('mentor_profile_id', profileId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[mentoring] 본인 배정 조회 실패:', error.message);
    return [];
  }
  return (data as unknown as MentoringAssignment[] | null) ?? [];
}

/** Storage 사진 업로드 — 단일 파일 → publicUrl */
export async function uploadMentoringPhoto(file: File, assignmentId: string): Promise<string | null> {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 40);
  const path = `${assignmentId}/${Date.now()}_${safeBase}.${ext}`;
  const { error } = await supabase.storage.from(MENTORING_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) {
    console.error('[mentoring] 사진 업로드 실패:', error.message);
    return null;
  }
  const { data: pub } = supabase.storage.from(MENTORING_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/** 완료된 세션 카운트 (submitted_at != null) */
export function countCompletedSessions(sessions: MentoringSession[] | null | undefined): number {
  if (!sessions) return 0;
  return sessions.filter((s) => !!s.submitted_at).length;
}

/** 간단한 HTML → Word 다운로드 (Blob, application/msword) */
export function downloadSessionAsWord(session: MentoringSession, mentorName: string): void {
  const safeTitle = (session.title || '멘토링보고서').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 40);
  const photos = (session.photo_urls ?? [])
    .map((u) => `<img src="${u}" style="max-width:600px;margin:6px 0;" />`)
    .join('');
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${safeTitle}</title></head>
<body style="font-family: 'Malgun Gothic', sans-serif;">
  <h1 style="border-bottom:2px solid #7C3AED; padding-bottom:8px;">${session.title}</h1>
  <table style="border-collapse:collapse;">
    <tr><td><b>멘토</b></td><td>${mentorName}</td></tr>
    <tr><td><b>날짜</b></td><td>${session.session_date}</td></tr>
    <tr><td><b>시간</b></td><td>${session.start_time ?? '-'} ~ ${session.end_time ?? '-'}</td></tr>
    <tr><td><b>유형</b></td><td>${session.meet_type ?? '-'}</td></tr>
    <tr><td><b>팀명</b></td><td>${session.team_name ?? '-'}</td></tr>
    <tr><td><b>아이템</b></td><td>${session.item_name ?? '-'}</td></tr>
    <tr><td><b>참여자</b></td><td>${session.attendee_names ?? '-'}</td></tr>
  </table>
  <h2>컨설팅 내용</h2>
  <p style="white-space:pre-wrap;">${session.content}</p>
  ${photos}
</body></html>`;
  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
