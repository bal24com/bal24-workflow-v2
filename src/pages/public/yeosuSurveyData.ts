// 2026 여수 해양·창업 학생 동아리 사전 수요조사 — 데이터 상수.
// 박경수님 2026-05-28 STEP-PROGRAM-SURVEY.

export interface ClubData {
  school: string;
  club: string;
  type: string;        // 해양/창업/융합
  grade: string;       // 학년
  mem: string;         // 인원
  teacher: string;
  phone: string;
  email: string;
}

export const YEOSU_CLUBS: ClubData[] = [
  { school: '경호초',         club: '꿈틀꿈틀 해양 창업가',           type: '융합', grade: '1,2학년', mem: '7', teacher: '장나운', phone: '010-7255-0527', email: '' },
  { school: '경호초',         club: '경호도 바다살림 소설 스타트업', type: '융합', grade: '5학년',   mem: '6', teacher: '이춘우', phone: '010-4621-3275', email: '' },
  { school: '여수삼일중',     club: '스타트업 삼일',                   type: '융합', grade: '1~3학년', mem: '3', teacher: '최진기', phone: '010-6385-4242', email: '' },
  { school: '진성여고',       club: '달콤한연구소',                     type: '창업', grade: '3학년',   mem: '4', teacher: '이경은', phone: '010-7669-3327', email: '' },
  { school: '진성여고',       club: '블루오션 메이커스',               type: '융합', grade: '1~3학년', mem: '3', teacher: '양가희', phone: '010-9981-2326', email: '' },
  { school: '여수화양고',     club: '화양연화',                         type: '창업', grade: '1~3학년', mem: '3', teacher: '강병원', phone: '010-3118-1543', email: '' },
  { school: '여수정보과학고', club: 'A.I랩',                            type: '창업', grade: '1~3학년', mem: '3', teacher: '양경아', phone: '010-5337-9617', email: '' },
  { school: '여수정보과학고', club: '빵카토',                           type: '창업', grade: '1~3학년', mem: '4', teacher: '윤나라', phone: '010-7603-8595', email: '' },
];

export const YEOSU_TIMES = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
] as const;

export const YEOSU_DURS = [
  '1시간 (60분)', '1시간 30분 (90분)', '2시간 (120분)',
  '2시간 30분 (150분)', '3시간 (180분)', '협의 후 결정',
] as const;

export const YEOSU_PROGS = [
  { id: 'p1', label: '창업 아이디어 개발 멘토링' },
  { id: 'p2', label: '창업 기획서 작성 지도' },
  { id: 'p3', label: '비즈니스 모델(BM) 설계' },
  { id: 'p4', label: 'AI 활용 창업 교육' },
  { id: 'p5', label: '시장 조사 및 분석 실습' },
  { id: 'p6', label: '피치덱·발표 준비 지원' },
  { id: 'p7', label: '현장 체험 연계 프로그램' },
  { id: 'p8', label: '브랜딩·마케팅 실습' },
  { id: 'po', label: '기타 (직접 입력)', other: true as const },
] as const;

export const YEOSU_VISIT_COUNTS = ['5회', '협의 후 결정'] as const;

export interface MonthSlot {
  date: string;    // YYYY-MM-DD
  time: string;    // HH:MM
  duration: string;
}

export const EMPTY_SLOT: MonthSlot = { date: '', time: '', duration: '' };

export interface YeosuSurveyForm {
  selectedClubIndex: number | null;
  clubName: string;
  clubType: string;
  clubGrade: string;
  clubMembers: string;
  teacherName: string;
  teacherPhone: string;
  teacherEmail: string;
  visitCount: string;
  jun:  { p1: MonthSlot; p2: MonthSlot };
  sep:  { p1: MonthSlot; p2: MonthSlot };
  oct:  { p1: MonthSlot; p2: MonthSlot };
  programs: string[];        // 체크된 라벨
  otherProgram: string;
  venue: string;
  studentNote: string;
  request: string;
}

export const EMPTY_FORM: YeosuSurveyForm = {
  selectedClubIndex: null,
  clubName: '', clubType: '', clubGrade: '', clubMembers: '',
  teacherName: '', teacherPhone: '', teacherEmail: '',
  visitCount: '',
  jun: { p1: { ...EMPTY_SLOT }, p2: { ...EMPTY_SLOT } },
  sep: { p1: { ...EMPTY_SLOT }, p2: { ...EMPTY_SLOT } },
  oct: { p1: { ...EMPTY_SLOT }, p2: { ...EMPTY_SLOT } },
  programs: [], otherProgram: '',
  venue: '', studentNote: '', request: '',
};
