// bal24 v2 — 박경수님 2026-05-26 멘토링 (컨설팅) 상담일지 양식 (StaffLogTab 상세 펼침 시)
// PDF 와 동일한 구조: 멘토(4셀) · 멘티(2행 — 참여팀명/참여자) · 일시 · 주제 · 멘토링 내용 · 사진첨부 · 제출문 · 수신처.

import { formatDateKo } from '../../../lib/utils';

interface Props {
  programName: string | null;
  projectName?: string | null;
  // 멘토
  mentorName: string;
  mentorOrg: string | null;
  mentorPosition: string | null;
  mentorSignatureUrl: string | null;
  // 멘티
  teamName: string | null | undefined;
  menteeNames: string[] | undefined;
  // 일시
  date: string;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  durationMin: number | null | undefined;
  // 본문
  subject: string | null | undefined;
  content: string;
  // 첨부 사진
  imageUrls?: string[];
  // 제출문
  recipient: string | null | undefined;
}

const TH_LABEL = 'bg-slate-50 text-slate-700 font-bold text-center border border-slate-300 px-2 py-1.5 whitespace-nowrap';
const TD_VAL = 'border border-slate-300 px-2.5 py-1.5 text-slate-800 align-middle';

export default function MentoringLogDetailTable({
  programName, projectName,
  mentorName, mentorOrg, mentorPosition, mentorSignatureUrl,
  teamName, menteeNames, date, startTime, endTime, durationMin,
  subject, content, imageUrls = [], recipient,
}: Props) {
  const dateRange = (() => {
    const datePart = formatDateKo(date);
    if (startTime && endTime) {
      return `${datePart} ${startTime.slice(0, 5)} ~ ${endTime.slice(0, 5)}`;
    }
    return datePart;
  })();
  const orgPos = [mentorOrg, mentorPosition].filter(Boolean).join(' / ') || '—';
  const menteeStr = (menteeNames && menteeNames.length > 0) ? menteeNames.join(', ') : '—';
  const teamStr = teamName && teamName.trim() ? teamName : '—';
  const programHeader = projectName ? `${projectName} — ${programName}` : programName;

  return (
    <div className="mt-3 bg-white rounded-lg overflow-hidden">
      {/* 제목 */}
      <h3 className="text-center text-base font-extrabold tracking-[0.3em] text-[#1E1B4B] my-3">
        멘 토 링 (컨설팅) 상 담 일 지
      </h3>

      <table className="w-full text-xs border-collapse border border-slate-300">
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '30%' }} />
        </colgroup>
        <tbody>
          {/* 프로그램명 헤더 */}
          <tr>
            <td className={`${TD_VAL} text-center font-bold bg-slate-50/60`} colSpan={5}>
              {programHeader ?? '(프로그램 미지정)'}
            </td>
          </tr>

          {/* 멘토 — 4 컬럼 */}
          <tr>
            <th className={TH_LABEL} rowSpan={1}>멘 토</th>
            <th className={TH_LABEL}>소속/직위</th>
            <td className={TD_VAL}>{orgPos}</td>
            <th className={TH_LABEL}>성 명</th>
            <td className={TD_VAL}>{mentorName}</td>
          </tr>

          {/* 멘티 — rowspan 2 */}
          <tr>
            <th className={TH_LABEL} rowSpan={2}>멘 티</th>
            <th className={TH_LABEL}>참여팀명</th>
            <td className={TD_VAL} colSpan={3}>{teamStr}</td>
          </tr>
          <tr>
            <th className={TH_LABEL}>참 여 자</th>
            <td className={TD_VAL} colSpan={3}>{menteeStr}</td>
          </tr>

          {/* 멘토링 일시 */}
          <tr>
            <th className={TH_LABEL} colSpan={2}>멘토링 일시</th>
            <td className={TD_VAL} colSpan={3}>
              <span className="tabular-nums">{dateRange}</span>
              {durationMin != null && durationMin > 0 && (
                <span className="text-slate-400 ml-1">({durationMin}분)</span>
              )}
            </td>
          </tr>

          {/* 멘토링 내용 헤더 */}
          <tr>
            <td className={`${TD_VAL} text-center font-bold bg-violet-50 text-violet-800`} colSpan={5}>
              멘토링 내용
            </td>
          </tr>

          {/* 주제 */}
          <tr>
            <th className={TH_LABEL} colSpan={2}>주 제</th>
            <td className={TD_VAL} colSpan={3}>{subject || '—'}</td>
          </tr>

          {/* 멘토링 내용 본문 */}
          <tr>
            <th className={TH_LABEL} colSpan={2}>멘토링 내용</th>
            <td className={`${TD_VAL} whitespace-pre-wrap leading-relaxed`} colSpan={3} style={{ minHeight: 160 }}>
              {content}
            </td>
          </tr>

          {/* 사진첨부 */}
          {/* 박경수님 2026-05-26 — 사진 행 항상 표시 (없으면 "사진 없음" 안내). */}
          <tr>
            <th className={TH_LABEL} colSpan={2}>멘토링<br />사진첨부</th>
            <td className={TD_VAL} colSpan={3}>
              {imageUrls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {imageUrls.slice(0, 6).map((url, idx) => (
                    <a key={`${idx}-${url}`} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`사진 ${idx + 1}`}
                        className="w-24 h-20 object-cover rounded border border-slate-200 hover:opacity-80" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">첨부된 사진이 없어요.</p>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 제출문 */}
      <div className="mt-4 text-center text-xs leading-relaxed">
        위와 같이 멘토링 상담일지를 제출합니다.<br />
        <span className="tabular-nums">{formatDateKo(date)}</span><br />
        <span className="mt-1 inline-flex items-center gap-2">
          성명 <span className="font-bold">{mentorName}</span>
          {mentorSignatureUrl ? (
            <img src={mentorSignatureUrl} alt="서명"
              className="h-7 inline-block align-middle ml-1" />
          ) : (
            <span className="text-slate-400 text-[10px]">(서명)</span>
          )}
        </span>
      </div>

      {/* 수신처 */}
      <p className="mt-3 text-xs font-bold text-slate-700">
        {recipient ? recipient : '담당자'} 귀하
      </p>
    </div>
  );
}
