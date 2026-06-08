// 동아리 팀별 외부 링크를 학교별로 묶어 발송용 메시지로 생성하는 슬라이드 패널.

import { useRef, useState } from 'react';
import { X, Copy, CheckCircle2, Send, Download, School } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import type { ProgramClub } from '../../../../types/database';

interface Props {
  bySchool: [string, ProgramClub[]][];
  onClose: () => void;
}

function buildMessage(school: string, clubs: ProgramClub[], origin: string): string {
  const lines: string[] = [
    `안녕하세요, ${school} 담당 선생님!`,
    '멘토링 사전 수요조사를 진행합니다.',
    '아래 팀별 링크를 각 팀에 전달해 주세요.',
    '',
    ...clubs.map((c) => `📌 ${c.club_name}  →  ${origin}/share/club/${c.club_token}`),
    '',
    '※ 팀마다 다른 링크를 사용해야 합니다.',
    '감사합니다.',
  ];
  return lines.join('\n');
}

export default function ClubLinkDispatchPanel({ bySchool, onClose }: Props) {
  const toast = useToast();
  const [copiedSchool, setCopiedSchool] = useState<string | null>(null);
  const mouseDownOnBackdropRef = useRef(false);
  const origin = window.location.origin;
  const totalClubs = bySchool.reduce((s, [, c]) => s + c.length, 0);

  async function copySchool(school: string, clubs: ProgramClub[]) {
    const ok = await copyToClipboard(buildMessage(school, clubs, origin));
    if (ok) {
      setCopiedSchool(school);
      toast.success(`${school} 링크 메시지를 복사했어요.`);
      setTimeout(() => setCopiedSchool(null), 3000);
    } else {
      toast.error('복사에 실패했어요.');
    }
  }

  async function copyAll() {
    const text = bySchool
      .map(([school, clubs]) => buildMessage(school, clubs, origin))
      .join('\n\n---\n\n');
    const ok = await copyToClipboard(text);
    if (ok) toast.success('전체 메시지를 복사했어요.');
    else toast.error('복사에 실패했어요.');
  }

  function downloadTxt() {
    const text = bySchool
      .map(([school, clubs]) => buildMessage(school, clubs, origin))
      .join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '링크_발송_목록.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('텍스트 파일을 다운로드했어요.');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onMouseDown={(e) => { mouseDownOnBackdropRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl">

        {/* 상단 헤더 */}
        <div className="sticky top-0 bg-white z-10 border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
              <Send size={15} className="text-violet-600" aria-hidden="true" />
              링크 발송 준비
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {bySchool.length}개 학교 · {totalClubs}개 팀
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={downloadTxt}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
            >
              <Download size={12} aria-hidden="true" /> TXT
            </button>
            <button
              type="button"
              onClick={() => void copyAll()}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700"
            >
              <Copy size={12} aria-hidden="true" /> 전체 복사
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="p-1.5 rounded hover:bg-slate-100"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* 사용 안내 */}
          <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-[11px] text-violet-700 space-y-1">
            <p className="font-bold mb-1">발송 방법</p>
            <p>① 학교별 [복사] 버튼으로 메시지를 복사하세요.</p>
            <p>② 담당 선생님에게 카카오톡·이메일로 전송하세요.</p>
            <p>③ 선생님이 팀에 링크를 전달하면 응답이 자동으로 집계돼요.</p>
          </div>

          {bySchool.length === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-10">
              등록된 동아리가 없어요.
            </p>
          )}

          {/* 학교별 카드 */}
          {bySchool.map(([school, clubs]) => {
            const isCopied = copiedSchool === school;
            const preview = buildMessage(school, clubs, origin);

            return (
              <div key={school} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* 학교 헤더 */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <School size={13} className="text-violet-600 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-bold text-[#1E1B4B]">{school}</span>
                    <span className="text-[11px] text-slate-500 shrink-0">{clubs.length}팀</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copySchool(school, clubs)}
                    className={`inline-flex items-center gap-1 px-3 h-7 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                      isCopied
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                    }`}
                  >
                    {isCopied
                      ? <><CheckCircle2 size={12} aria-hidden="true" /> 복사됨</>
                      : <><Copy size={12} aria-hidden="true" /> 복사</>
                    }
                  </button>
                </div>

                {/* 팀 링크 미리보기 */}
                <div className="px-4 py-3">
                  <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">
                    {preview}
                  </pre>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
