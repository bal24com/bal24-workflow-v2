// bal24 v2 — 외부공유 항목 · 교재 (programs.notice_files)

import { Paperclip, Download, FileText } from 'lucide-react';
import type { ProgramFile } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  files: ProgramFile[];
}

function formatBytes(b?: number): string {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function MaterialsItem({ files }: Props) {
  return (
    <ItemCard
      icon={<Paperclip size={18} aria-hidden="true" />}
      title="교재·자료"
      hint={`${files.length}개 파일 — 클릭하여 다운로드`}
    >
      {files.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-2">아직 등록된 자료가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.url}-${i}`}>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 hover:bg-violet-50 px-3 py-2.5 transition-colors"
              >
                <FileText size={14} className="shrink-0 text-violet-500" aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-sm font-semibold text-[#1E1B4B]">
                  {f.name}
                </span>
                {f.size != null && (
                  <span className="shrink-0 text-[10px] text-slate-400 tabular-nums">
                    {formatBytes(f.size)}
                  </span>
                )}
                <Download size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </ItemCard>
  );
}
