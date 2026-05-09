// bal24 v2 — STEP-MYPAGE 타입 정의
// /my/:token 참여자 마이페이지 전용 타입.

export interface MyPageProfile {
  id: string;
  name: string;
  role: string | null;
  my_token: string;
}

export interface MyPageProgram {
  id: string;
  name: string;
  /** STEP-PROGRAM-TYPE 의 program_type (확장 13종) */
  program_type: string | null;
  /** legacy programs.type — 표시 fallback */
  type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  /** V2 실측: programs.venue (명세 location 보정) */
  venue: string | null;
  /** 입장코드 보유 여부 판정용 — 화면 표시는 안 함 */
  entry_code: string | null;
  /** mentoring_assignments 존재 → '승인' 단순 매핑 */
  application_status: string | null;
}

export interface MyPageMentoring {
  id: string;
  program_id: string;
  program_name: string | null;
  meet_type: string | null;
  session_count: number | null;
  completed_count: number;
  role: 'mentor' | 'mentee';
  /** 멘티 화면에서 멘토 이름 표시 */
  mentor_name: string | null;
  /** 멘토 외부 링크용 토큰 (mentoring_assignments.mentor_access_token) */
  mentor_token: string | null;
  /** 멘티 외부 링크용 토큰 (mentoring_assignments.mentee_access_token) */
  mentee_token: string | null;
}

export interface MyPageStats {
  programCount: number;
  mentoringCount: number;
  completedSessionCount: number;
  pendingFeedbackCount: number;
}
