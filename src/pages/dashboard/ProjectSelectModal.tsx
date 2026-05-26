// 프로젝트 선택 팝업 모달 — 박경수님 + SkyClaw STEP-FINANCE-DASHBOARD-UI (2026-05-27)
// 공용 Modal 컴포넌트 활용 (드래그 닫힘 방지 + ESC 닫기 + 한글 메시지)

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import Modal from '../../components/ui/Modal';

interface ProjectOption { id: string; name: string }

interface Props {
  open: boolean;
  projects: ProjectOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}

export default function ProjectSelectModal({ open, projects, selectedId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    : projects;

  function pick(id: string | null) {
    onSelect(id);
    setSearch('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="프로젝트 선택" size="sm">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
            placeholder="프로젝트명 검색"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-violet-400" />
        </div>
        <div className="max-h-[360px] overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
          <button type="button" onClick={() => pick(null)}
            className={`w-full text-left px-4 py-2.5 text-sm font-medium ${
              selectedId === null ? 'bg-violet-50 text-violet-700' : 'hover:bg-slate-50 text-slate-700'
            }`}>
            전체 프로젝트
          </button>
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              {search.trim() ? `'${search}' 검색 결과 없음` : '등록된 프로젝트가 없어요.'}
            </div>
          ) : filtered.map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p.id)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between ${
                selectedId === p.id ? 'bg-violet-50 text-violet-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
              }`}>
              <span className="truncate">{p.name}</span>
              {selectedId === p.id && <X size={12} className="text-violet-500 shrink-0 ml-2" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
