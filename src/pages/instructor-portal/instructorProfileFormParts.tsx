// bal24 v2 — InstructorProfileForm 헬퍼 컴포넌트 분리

import type { ChangeEvent } from 'react';
import { Plus, Trash2, Paperclip, CheckCircle2 } from 'lucide-react';

export function Field(props: { label: string; required?: boolean; value: string; onChange: (v: string) => void; helper?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-600">
        {props.label}{props.required && <span className="text-rose-500"> *</span>}
      </label>
      <input type="text" value={props.value} onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
      {props.helper && <p className="text-[10px] text-slate-500">{props.helper}</p>}
    </div>
  );
}

interface DynamicListProps<T> {
  title: string;
  items: T[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onPatch: (idx: number, patch: Partial<T>) => void;
  fields: { key: keyof T; placeholder: string }[];
}

export function DynamicList<T extends Record<string, string | undefined>>(p: DynamicListProps<T>) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-600">{p.title}</h3>
        <button type="button" onClick={p.onAdd}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-violet-700 hover:bg-violet-50">
          <Plus size={11} aria-hidden="true" /> 추가
        </button>
      </div>
      {p.items.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">추가 버튼으로 입력해 주세요.</p>
      ) : (
        <ul className="space-y-1.5">
          {p.items.map((row, idx) => (
            <li key={idx} className="flex items-center gap-2">
              {p.fields.map((f) => (
                <input key={String(f.key)} type="text"
                  value={row[f.key] ?? ''}
                  onChange={(e) => p.onPatch(idx, { [f.key]: e.target.value } as Partial<T>)}
                  placeholder={f.placeholder}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-violet-400" />
              ))}
              <button type="button" onClick={() => p.onRemove(idx)} aria-label="삭제"
                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50">
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FileUploadRow(props: { label: string; value: string | null; uploading: boolean; onPick: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-violet-300">
      <Paperclip size={12} className="text-slate-400 shrink-0" aria-hidden="true" />
      <span className="text-xs font-semibold text-slate-700 shrink-0">{props.label}</span>
      <span className="text-[11px] text-slate-400 truncate flex-1">
        {props.uploading ? '업로드 중…' : props.value ? '✓ 등록됨' : '파일 선택'}
      </span>
      {props.value && !props.uploading && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" aria-hidden="true" />}
      <input type="file" hidden onChange={props.onPick} disabled={props.uploading} />
    </label>
  );
}
