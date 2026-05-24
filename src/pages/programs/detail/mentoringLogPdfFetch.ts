// bal24 v2 — STEP-MENTORING-P2-PDF
// 멘토링 일지 한 건의 PDF 출력에 필요한 데이터 조합.
// SkyClaw 지시문 보정: expert_id → assignment_id 경로, log_date 사용, mentee_ids는 mentoring_logs 자체 컬럼.

import { supabase } from '../../../lib/supabase';
import type { MentoringLogForPdf } from './mentoringLogPdf';

export async function fetchLogForPdf(logId: string): Promise<MentoringLogForPdf | null> {
  // 1) mentoring_logs 기본 (mentee_ids는 mentoring_logs 자체 컬럼)
  const { data: log, error } = await supabase
    .from('mentoring_logs')
    .select(`
      id, subject, content, log_date, duration_min, recipient,
      mentor_signature_url, status, assignment_id, program_id, mentee_ids
    `)
    .eq('id', logId)
    .maybeSingle();
  if (error || !log) {
    console.error('[mentoring-log-pdf] 일지 조회 실패:', error?.message);
    return null;
  }
  type LogRow = {
    id: string; subject: string | null; content: string | null;
    log_date: string | null; duration_min: number | null; recipient: string | null;
    mentor_signature_url: string | null; status: string;
    assignment_id: string | null; program_id: string | null;
    mentee_ids: string[] | null;
  };
  const l = log as LogRow;

  // 2) program + project 이름
  let programName = '프로그램';
  let projectName = '';
  if (l.program_id) {
    const { data: prog } = await supabase.from('programs')
      .select('name, project:projects(name)').eq('id', l.program_id).maybeSingle();
    if (prog) {
      programName = (prog.name as string) ?? programName;
      const proj = Array.isArray(prog.project) ? prog.project[0] : prog.project;
      projectName = (proj as { name?: string } | null)?.name ?? '';
    }
  }

  // 3) 멘토 정보 (assignment → mentor_pool_id|mentor_profile_id → staff_pool|profiles)
  // STEP-MENTORING-P3 — signature_url 우선순위: 일지의 mentor_signature_url > 강사 프로필 signature_url
  let mentorName = '(이름 없음)';
  let mentorOrg = '';
  let mentorPosition = '전문가';
  let mentorProfileSignature: string | null = null;
  if (l.assignment_id) {
    const { data: asn } = await supabase.from('mentoring_assignments')
      .select('mentor_pool_id, mentor_profile_id, mentor_name_raw')
      .eq('id', l.assignment_id).maybeSingle();
    type AsnRow = { mentor_pool_id: string | null; mentor_profile_id: string | null; mentor_name_raw: string | null };
    const a = asn as AsnRow | null;
    if (a?.mentor_pool_id) {
      // STEP-MENTORING-P3 — signature_url 도 함께 fetch (멘토 프로필 서명)
      const { data: sp } = await supabase.from('staff_pool')
        .select('name, organization, position, signature_url').eq('id', a.mentor_pool_id).maybeSingle();
      const s = sp as { name: string; organization: string | null; position: string | null; signature_url: string | null } | null;
      if (s) {
        mentorName = s.name ?? mentorName;
        mentorOrg = s.organization ?? '';
        mentorPosition = s.position ?? mentorPosition;
        if (s.signature_url) mentorProfileSignature = s.signature_url;
      }
    } else if (a?.mentor_profile_id) {
      const { data: pr } = await supabase.from('profiles')
        .select('name, department, position, signature_url').eq('id', a.mentor_profile_id).maybeSingle();
      const p = pr as { name: string | null; department: string | null; position: string | null; signature_url: string | null } | null;
      if (p) {
        mentorName = p.name ?? mentorName;
        mentorOrg = p.department ?? '';
        mentorPosition = p.position ?? mentorPosition;
        if (p.signature_url) mentorProfileSignature = p.signature_url;
      }
    } else if (a?.mentor_name_raw) {
      mentorName = a.mentor_name_raw;
    }
  }

  // 4) 멘티 이름 (mentee_ids → program_participants)
  let menteeNames: string[] = [];
  const menteeIds = l.mentee_ids ?? [];
  if (menteeIds.length > 0) {
    const { data: parts } = await supabase.from('program_participants')
      .select('id, name').in('id', menteeIds);
    const idToName = new Map((parts ?? []).map((p) => [(p as { id: string }).id, (p as { name: string }).name]));
    // mentee_ids 순서 유지
    menteeNames = menteeIds.map((id) => idToName.get(id)).filter((n): n is string => !!n);
  }

  // 5) 첨부 이미지 (mentoring_log_files, file_type='image' 만)
  let imageUrls: string[] = [];
  const { data: files, error: fErr } = await supabase.from('mentoring_log_files')
    .select('file_url, file_type').eq('log_id', logId)
    .order('created_at', { ascending: true });
  if (fErr) {
    const m = (fErr.message ?? '').toLowerCase();
    if (!m.includes('does not exist') && !m.includes('pgrst205')) {
      console.warn('[mentoring-log-pdf] 파일 조회 경고:', fErr.message);
    }
  } else {
    imageUrls = ((files ?? []) as Array<{ file_url: string; file_type: string }>)
      .filter((f) => f.file_type === 'image')
      .map((f) => f.file_url).filter(Boolean).slice(0, 3);
  }

  return {
    id: l.id,
    subject: l.subject,
    content: l.content,
    log_date: l.log_date,
    duration_min: l.duration_min,
    recipient: l.recipient,
    // STEP-MENTORING-P3 — 일지 자체 서명(임시) > 강사 프로필 서명(영구) > null
    mentor_signature_url: l.mentor_signature_url ?? mentorProfileSignature,
    status: l.status,
    mentor_name: mentorName,
    mentor_org: mentorOrg,
    mentor_position: mentorPosition,
    mentee_names: menteeNames,
    program_name: programName,
    project_name: projectName,
    image_urls: imageUrls,
  };
}
