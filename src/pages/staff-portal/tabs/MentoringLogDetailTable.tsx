// bal24 v2 — 박경수님 2026-05-26 멘토링 일지 양식 상세 표 (StaffLogTab 펼침 시 표시)
// PDF 양식과 동일한 행 구조: 참여팀명 / 참여자 / 일시 / 주제 / 다음 계획 / 제출처.

import { formatDateKo } from '../../../lib/utils';

interface Props {
  teamName: string | null | undefined;
  menteeNames: string[] | undefined;
  date: string;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  durationMin: number | null | undefined;
  subject: string | null | undefined;
  nextPlan: string | null | undefined;
  recipient: string | null | undefined;
}

export default function MentoringLogDetailTable({
  teamName, menteeNames, date, startTime, endTime, durationMin,
  subject, nextPlan, recipient,
}: Props) {
  return (
    <div className="mt-3 border border-violet-200 rounded-lg overflow-hidden bg-white">
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <th className="bg-slate-50 text-slate-600 font-semibold px-2.5 py-1.5 w-20 border-b border-violet-100 text-left">참여팀명</th>
            <td className="px-2.5 py-1.5 text-slate-800 border-b border-violet-100">{teamName || '—'}</td>
          </tr>
          <tr>
            <th className="bg-slate-50 text-slate-600 font-semibold px-2.5 py-1.5 border-b border-violet-100 text-left">참여자</th>
            <td className="px-2.5 py-1.5 text-slate-800 border-b border-violet-100">
              {(menteeNames && menteeNames.length > 0) ? menteeNames.join(', ') : '—'}
            </td>
          </tr>
          <tr>
            <th className="bg-slate-50 text-slate-600 font-semibold px-2.5 py-1.5 border-b border-violet-100 text-left">일시</th>
            <td className="px-2.5 py-1.5 text-slate-800 border-b border-violet-100 tabular-nums">
              {formatDateKo(date)}
              {startTime && endTime && ` · ${startTime.slice(0, 5)} ~ ${endTime.slice(0, 5)}`}
              {durationMin != null && durationMin > 0 && <span className="text-slate-400"> ({durationMin}분)</span>}
            </td>
          </tr>
          <tr>
            <th className="bg-slate-50 text-slate-600 font-semibold px-2.5 py-1.5 border-b border-violet-100 text-left">주제</th>
            <td className="px-2.5 py-1.5 text-slate-800 border-b border-violet-100">{subject || '—'}</td>
          </tr>
          {nextPlan && (
            <tr>
              <th className="bg-slate-50 text-slate-600 font-semibold px-2.5 py-1.5 border-b border-violet-100 text-left">다음 계획</th>
              <td className="px-2.5 py-1.5 text-slate-700 border-b border-violet-100 whitespace-pre-wrap">{nextPlan}</td>
            </tr>
          )}
          {recipient && (
            <tr>
              <th className="bg-slate-50 text-slate-600 font-semibold px-2.5 py-1.5 text-left">제출처</th>
              <td className="px-2.5 py-1.5 text-slate-800">{recipient} <span className="text-slate-400">귀하</span></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
