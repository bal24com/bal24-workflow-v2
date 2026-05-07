// bal24 v2 — 프로그램 수정 풀 페이지 · ③ 공지사항 + ③-1 첨부
// notice (text) + notice_files (jsonb).

import { Paperclip, X } from 'lucide-react';
import CardShell, { Field, textareaClass } from './CardShell';
import type { ProgramFile } from '../../../../types/database';
import type { ProgramEditForm } from '../programEditUtils';

interface Props {
  form: ProgramEditForm;
  onChange: <K extends keyof ProgramEditForm>(key: K, value: ProgramEditForm[K]) => void;
}

function formatBytes(b?: number): string {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function NoticeCard({ form, onChange }: Props) {
  const files = form.notice_files;

  function removeFile(idx: number) {
    onChange(
      'notice_files',
      files.filter((_, i) => i !== idx),
    );
  }

  function addFileByUrl() {
    const url = window.prompt('공지 첨부 파일 URL을 입력해 주세요. (드래그·업로드 UI는 후속 STEP에서 추가 예정)');
    if (!url || !url.trim()) return;
    const name = window.prompt('파일 표시 이름', url.split('/').pop() ?? '첨부 파일') ?? '첨부 파일';
    const next: ProgramFile = { url: url.trim(), name: name.trim() };
    onChange('notice_files', [...files, next]);
  }

  return (
    <CardShell
      step="③"
      title="공지사항"
      description="집합 장소·시간·준비물 등 — 외부 신청자가 볼 수 있는 안내."
    >
      <Field label="공지 본문">
        <textarea
          value={form.notice}
          onChange={(e) => onChange('notice', e.target.value)}
          placeholder="예) 본 캠프는 09:00까지 정문 앞 집합입니다. 노트북·필기도구 지참."
          className={textareaClass}
        />
      </Field>

      <Field label="첨부 파일" hint="이미지·자료 등 — 1단계는 URL 입력. 드래그·업로드는 후속 STEP">
        <div className="flex flex-col gap-1.5">
          {files.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic">첨부된 파일이 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {files.map((f, i) => (
                <li
                  key={`${f.url}-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2"
                >
                  <Paperclip size={13} className="shrink-0 text-violet-500" aria-hidden="true" />
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-0 truncate text-xs font-semibold text-violet-700 hover:underline"
                  >
                    {f.name}
                  </a>
                  {f.size != null && (
                    <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                      {formatBytes(f.size)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    title="삭제"
                    className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={addFileByUrl}
            className="self-start inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-violet-50/40 text-xs font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-200 transition-colors"
          >
            <Paperclip size={12} aria-hidden="true" />
            URL로 첨부 추가
          </button>
        </div>
      </Field>
    </CardShell>
  );
}
