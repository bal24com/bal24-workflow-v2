// bal24 v2 — STEP-CURRICULUM-FULL 인력 팝업 검색 모달
// 전문가(staff_pool) / 팀원(profiles) 탭 + ILIKE 검색 + 선택 콜백

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, UserPlus, X } from 'lucide-react';
import Modal from './Modal';
import { supabase } from '../../lib/supabase';
import type { CurriculumStaffRole } from '../../types/database';

export interface SelectedPerson {
  /** 'manual' = 등록되지 않은 이름 직접 추가 (예: AI 추출 결과 미매칭 강사) */
  sourceType: 'staff_pool' | 'profile' | 'manual';
  id: string;
  name: string;
  organization?: string;
  position?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (person: SelectedPerson) => void;
  role: CurriculumStaffRole;
  excludeIds?: string[];
  /** 미매칭 이름 직접 추가 허용 (AI 추출 미리보기 등) */
  allowManual?: boolean;
}

type Tab = 'staff_pool' | 'profile';

interface SearchRow {
  id: string;
  name: string;
  organization?: string | null;
  department?: string | null;
  position?: string | null;
  note?: string | null;  // 박경수님 요청 — '임시등록' 배지 체크
}

const ROLE_DESC: Record<CurriculumStaffRole, string> = {
  강사: '강의를 담당할 인력', 멘토: '멘토링을 담당할 인력', FT: '퍼실리테이터(FT) 인력', TA: '교육 보조(TA) 인력', 운영진: '운영·진행 담당 인력',
};

async function searchStaffPool(q: string): Promise<SearchRow[]> {
  // 박경수님 요청 — note 컬럼 추가 fetch ('임시등록' 배지 표시용)
  if (!q.trim()) {
    const r = await supabase.from('staff_pool').select('id, name, organization, position, note').order('name').limit(20);
    if (r.error) { console.error('[staff-search] pool 조회 실패:', r.error.message); return []; }
    return (r.data ?? []) as SearchRow[];
  }
  const r = await supabase.from('staff_pool').select('id, name, organization, position, note')
    .or(`name.ilike.%${q}%,organization.ilike.%${q}%`).order('name').limit(20);
  if (r.error) { console.error('[staff-search] pool 검색 실패:', r.error.message); return []; }
  return (r.data ?? []) as SearchRow[];
}

async function searchProfiles(q: string): Promise<SearchRow[]> {
  if (!q.trim()) {
    const r = await supabase.from('profiles').select('id, name, department, position').order('name').limit(20);
    if (r.error) { console.error('[staff-search] profile 조회 실패:', r.error.message); return []; }
    return (r.data ?? []) as SearchRow[];
  }
  const r = await supabase.from('profiles').select('id, name, department, position')
    .or(`name.ilike.%${q}%,department.ilike.%${q}%`).order('name').limit(20);
  if (r.error) { console.error('[staff-search] profile 검색 실패:', r.error.message); return []; }
  return (r.data ?? []) as SearchRow[];
}

export default function StaffSearchModal({ open, onClose, onSelect, role, excludeIds = [], allowManual = false }: Props) {
  const [tab, setTab] = useState<Tab>('staff_pool');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  // 박경수님 요청 — 검색 결과 0건 시 임시 인력 등록 미니폼
  const [tempOpen, setTempOpen] = useState(false);
  const [tempOrg, setTempOrg] = useState('');
  const [tempSaving, setTempSaving] = useState(false);
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  async function handleAddTemp() {
    const name = query.trim();
    if (!name) return;
    setTempSaving(true);
    const { data, error } = await supabase.from('staff_pool')
      .insert({ name, organization: tempOrg.trim() || null, note: '임시등록' })
      .select('id, name, organization, position').single();
    setTempSaving(false);
    if (error || !data) {
      console.error('[staff-search] 임시 등록 실패:', error?.message);
      alert(`임시 등록 실패: ${error?.message ?? '원인 미상'}`);
      return;
    }
    onSelect({ sourceType: 'staff_pool', id: data.id, name: data.name,
      organization: data.organization ?? undefined, position: data.position ?? undefined });
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const data = tab === 'staff_pool' ? await searchStaffPool(debounced) : await searchProfiles(debounced);
      if (!cancelled) { setRows(data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tab, debounced, open]);

  // 모달 닫힐 때 상태 초기화
  useEffect(() => { if (!open) { setQuery(''); setDebounced(''); setRows([]); setTab('staff_pool'); setTempOpen(false); setTempOrg(''); } }, [open]);

  const handlePick = (r: SearchRow) => {
    const subInfo = tab === 'staff_pool' ? r.organization : r.department;
    onSelect({
      sourceType: tab, id: r.id, name: r.name,
      organization: subInfo ?? undefined, position: r.position ?? undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`인력 검색 — ${role}`} description={ROLE_DESC[role]} size="md">
      <div className="space-y-3">
        <div className="inline-flex rounded-lg border border-violet-100 bg-white p-0.5">
          {(['staff_pool', 'profile'] as Tab[]).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                tab === t ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
              }`}>
              {t === 'staff_pool' ? '🎓 전문가' : '👥 팀원'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
            placeholder={tab === 'staff_pool' ? '이름·소속으로 검색' : '이름·부서로 검색'}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
        </div>
        <div className="max-h-[360px] overflow-y-auto rounded-lg border border-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-slate-400">
              <Loader2 size={14} className="animate-spin mr-1.5" /> 검색 중…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <p className="text-xs text-slate-400 italic">{query ? `'${query.trim()}' 검색 결과 없음` : '등록된 인력이 없어요.'}</p>
              {/* 박경수님 요청 — 0건 + 검색어 있을 때 임시 등록 (staff_pool 만) */}
              {tab === 'staff_pool' && query.trim() && !tempOpen && (
                <button type="button" onClick={() => setTempOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200">
                  <UserPlus size={11} aria-hidden="true" /> + 임시 인력으로 등록
                </button>
              )}
              {tempOpen && (
                <div className="mx-3 mt-1 p-3 rounded-lg border border-violet-200 bg-violet-50/40 text-left space-y-2">
                  <div className="text-xs"><span className="text-slate-500">이름:</span> <strong className="text-violet-700">{query.trim()}</strong></div>
                  <input type="text" value={tempOrg} onChange={(e) => setTempOrg(e.target.value)} placeholder="소속 (선택)"
                    className="w-full h-8 px-2 rounded border border-violet-200 bg-white text-xs focus:outline-none focus:border-violet-400" />
                  <div className="flex items-center gap-1.5 justify-end">
                    <button type="button" onClick={() => setTempOpen(false)} disabled={tempSaving}
                      className="px-2.5 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100">취소</button>
                    <button type="button" onClick={() => void handleAddTemp()} disabled={tempSaving}
                      className="px-3 py-1 rounded text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
                      {tempSaving ? '등록 중…' : '등록'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">임시 등록된 인력은 전문가 목록에 [임시] 배지로 표시됩니다 (note='임시등록').</p>
                </div>
              )}
              {tab === 'profile' && query.trim() && (
                <p className="text-[11px] text-slate-400">팀원은 관리자 페이지에서 초대해야 합니다.</p>
              )}
              {allowManual && query.trim() && !tempOpen && (
                <button type="button"
                  onClick={() => { onSelect({ sourceType: 'manual', id: '', name: query.trim() }); onClose(); }}
                  className="block mx-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200">
                  <UserPlus size={11} aria-hidden="true" /> "{query.trim()}" 직접 추가 (DB 저장 안 함)
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const sub = tab === 'staff_pool' ? r.organization : r.department;
                const excluded = excludeSet.has(r.id);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-violet-50/40">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate inline-flex items-center gap-1.5">
                        {r.name}
                        {r.note === '임시등록' && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">임시</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {[sub, r.position].filter(Boolean).join(' · ') || '소속·직위 미지정'}
                      </p>
                    </div>
                    {excluded ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-400 bg-slate-50 rounded-md border border-slate-200">
                        <X size={11} aria-hidden="true" /> 이미 배정
                      </span>
                    ) : (
                      <button type="button" onClick={() => handlePick(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-md">
                        <UserPlus size={11} aria-hidden="true" /> 선택
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {allowManual && query.trim() && rows.length > 0 && (
          <div className="border-t border-slate-100 pt-2">
            <button type="button"
              onClick={() => { onSelect({ sourceType: 'manual', id: '', name: query.trim() }); onClose(); }}
              className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300">
              <UserPlus size={11} aria-hidden="true" /> 위 결과 대신 "{query.trim()}" 직접 추가
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
