// STEP-TAGS commit d — 관리자 태그 카테고리 CRUD (client / staff 두 scope)

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Tag, Plus, X, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchTagCategories, createTagCategory, deleteTagCategory,
} from '../../lib/tagUtils';
import type { TagCategory, TagScope } from '../../types/database';

const SCOPE_LABEL: Record<TagScope, string> = {
  client: '고객사 / 주관기관 / 거래처',
  staff: '강사 / 전문가 / 운영진',
};

export default function TagsAdminSection() {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-4">
      <header className="flex items-center gap-2">
        <Tag size={16} className="text-violet-500" aria-hidden="true" />
        <h2 className="text-sm font-bold text-[#1E1B4B]">태그 분류 관리</h2>
        <p className="text-[11px] text-slate-500">
          고객사·전문가 등록 시 선택할 분류를 직접 추가·삭제하세요. 변경은 즉시 반영됩니다.
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScopeCard scope="client" />
        <ScopeCard scope="staff" />
      </div>
    </section>
  );
}

function ScopeCard({ scope }: { scope: TagScope }) {
  const toast = useToast();
  const [cats, setCats] = useState<TagCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const rows = await fetchTagCategories(scope);
    setCats(rows);
    setLoading(false);
  }

  useEffect(() => { void reload(); }, [scope]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const nextOrder = (cats[cats.length - 1]?.order_index ?? 0) + 10;
    const { data, error } = await createTagCategory(scope, name, nextOrder);
    setAdding(false);
    if (error) { toast.error(error); return; }
    if (data) {
      setCats((p) => [...p, data]);
      setNewName('');
      toast.success(`"${data.name}" 태그를 추가했어요.`);
    }
  }

  async function handleRemove(c: TagCategory) {
    if (!window.confirm(`"${c.name}" 태그를 삭제할까요? 기존에 이 태그가 붙은 고객사·전문가는 그대로 유지됩니다.`)) return;
    setRemovingId(c.id);
    const err = await deleteTagCategory(c.id);
    setRemovingId(null);
    if (err) { toast.error(err); return; }
    setCats((p) => p.filter((x) => x.id !== c.id));
    toast.success('태그를 삭제했어요.');
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">{SCOPE_LABEL[scope]}</h3>
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />불러오는 중…
        </div>
      ) : cats.length === 0 ? (
        <p className="text-xs text-slate-400 italic">등록된 태그가 없어요. 아래에서 추가하세요.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-white text-slate-700 border border-slate-200">
              {c.name}
              <button
                type="button"
                onClick={() => void handleRemove(c)}
                disabled={removingId === c.id}
                className="ml-0.5 text-slate-400 hover:text-rose-500 disabled:opacity-40"
                aria-label={`${c.name} 삭제`}
              >
                <X size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} className="flex items-center gap-1.5">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 태그명"
          disabled={adding}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
        <Button type="submit" variant="primary" size="sm" leftIcon={<Plus size={12} />} loading={adding}>추가</Button>
      </form>
    </div>
  );
}
