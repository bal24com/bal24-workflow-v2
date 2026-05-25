// 태그 다중 선택 패널 — 관리자 등록 카테고리를 칩 체크박스로 (Client/Expert 폼 공용)

import { useEffect, useState } from 'react';
import { Tag, Loader2 } from 'lucide-react';
import { fetchTagCategories } from '../lib/tagUtils';
import type { TagCategory, TagScope } from '../types/database';

interface Props {
  scope: TagScope;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export default function TagsSelector({ scope, value, onChange, disabled }: Props) {
  const [cats, setCats] = useState<TagCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchTagCategories(scope).then((rows) => {
      if (cancelled) return;
      setCats(rows);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [scope]);

  function toggle(name: string) {
    if (disabled) return;
    onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700 inline-flex items-center gap-1.5">
        <Tag size={13} aria-hidden="true" />분류 태그
      </label>
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />불러오는 중…
        </div>
      ) : cats.length === 0 ? (
        <p className="text-xs text-slate-400 italic">관리자가 등록한 태그가 없어요. 설정 → 태그 관리에서 추가하세요.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {cats.map((c) => {
            const active = value.includes(c.name);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.name)}
                disabled={disabled}
                aria-pressed={active}
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                } disabled:opacity-60`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
