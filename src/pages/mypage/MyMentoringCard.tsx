// bal24 v2 — STEP-MYPAGE 멘토링 카드
// 멘토 / 멘티 역할별로 다른 진입 버튼 표시.

import { Link } from 'react-router-dom';
import { ExternalLink, Users2 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui';
import { BADGE_BASE } from '../../utils/statusStyles';
import type { MyPageMentoring } from '../../types/mypage';

interface Props {
  mentoring: MyPageMentoring;
  /** 마이페이지 보유자 본인의 my_token (멘티 화면 진입 시 사용) */
  myToken: string;
}

export default function MyMentoringCard({ mentoring, myToken }: Props) {
  const isMentor = mentoring.role === 'mentor';
  const planned = mentoring.session_count ?? 0;
  const completed = mentoring.completed_count;

  // 진입 링크 결정
  const link = isMentor
    ? (mentoring.mentor_token ? `/mentoring-mentor/${mentoring.mentor_token}` : null)
    : (mentoring.mentee_token ? `/mentoring-student/${mentoring.mentee_token}` : null);
  const buttonLabel = isMentor ? '일지 작성' : '세션 보기';
  void myToken; // myToken 은 향후 본인 식별용 fallback (현재는 mentee_token 우선)

  return (
    <Card className="h-full hover:border-violet-300 hover:shadow-md transition-all">
      <CardContent className="p-4 space-y-3">
        <header className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${BADGE_BASE} ${
              isMentor
                ? 'bg-violet-50 text-violet-600 border-violet-200'
                : 'bg-orange-50 text-orange-500 border-orange-200'
            }`}>
              {isMentor ? '멘토' : '멘티'}
            </span>
            {mentoring.meet_type && (
              <span className="text-[11px] text-slate-500">· {mentoring.meet_type}</span>
            )}
          </div>
          <h3 className="text-sm font-bold text-[#1E1B4B] truncate">
            {mentoring.program_name ?? '프로그램 미연결'}
          </h3>
          {!isMentor && mentoring.mentor_name && (
            <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
              <Users2 size={11} aria-hidden="true" />
              담당 멘토 {mentoring.mentor_name}
            </p>
          )}
        </header>

        <div className="rounded-xl bg-violet-50/60 p-2.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>진행</span>
            <span className="tabular-nums font-semibold text-violet-700">
              완료 {completed}회 / 계획 {planned}회
            </span>
          </div>
        </div>

        {link ? (
          <Link
            to={link}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors w-full justify-center"
          >
            <ExternalLink size={12} aria-hidden="true" />
            {buttonLabel}
          </Link>
        ) : (
          <p className="text-[11px] text-slate-400 italic text-center">접근 토큰이 아직 없어요.</p>
        )}
      </CardContent>
    </Card>
  );
}
