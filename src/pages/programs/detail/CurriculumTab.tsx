// bal24 v2 — 프로그램 상세 · 커리큘럼 탭 (V7 NewEducationV9 ⑥ 차용)
// 테이블형 차시 + DateTimePicker + 매칭 모달 + 드래그 정렬.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, Upload, Save, Download, UserPlus, Copy, Trash2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import SubToggle from './SubToggle';
import CurriculumRow from './curriculum/CurriculumRow';
import SaveTemplateModal from './curriculum/SaveTemplateModal';
import LoadTemplateModal from './curriculum/LoadTemplateModal';
import AiCurriculumModal from './curriculum/AiCurriculumModal';
import CurriculumAiDropZone from './curriculum/CurriculumAiDropZone';
// STEP-OVERVIEW-UI-FULL PART C — CurriculumStaffSection 제거 (차시 행 강사 컬럼으로 통합)
import InvitationManagePanel from '../InvitationManagePanel';
import { fetchCurriculumBundle, trimTime, type CurriculumWithStaff } from './curriculum/curriculumTabUtils';
import { useCurriculumStaff } from './useCurriculumStaff';
import {
  dbAddCurriculum, dbCopyPlannedToActual, dbSwapSessionNo,
  dbSaveCurriculum, dbRemoveCurriculum, dbPersistOrder,
} from './curriculumHandlers';
import type {
  CurriculumType, ProgramCurriculum, InvitationStatus,
} from '../../../types/database';

interface InvitationSummary { id: string; name: string; status: InvitationStatus; }
import type { CurriculumSessionMeta } from './curriculum/curriculumTemplateUtils';

interface Props {
  programId: string;
  programName?: string;
  /** STEP-OVERVIEW-UI-FULL — 강사명 클릭 시 상위 탭 전환 */
  onSwitchToInstructorTab?: () => void;
}

export default function CurriculumTab({ programId, programName, onSwitchToInstructorTab }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<CurriculumWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  // STEP-CURRICULUM-FULL — 제안/실제 운영 토글 + 카운트
  const [curriculumType, setCurriculumType] = useState<CurriculumType>('planned');
  const [counts, setCounts] = useState({ planned: 0, actual: 0 });
  const [copying, setCopying] = useState(false);
  const [saveTplOpen, setSaveTplOpen] = useState(false); const [loadTplOpen, setLoadTplOpen] = useState(false);
  const [aiCurriculumOpen, setAiCurriculumOpen] = useState(false);
  // STEP-INSTRUCTOR-INVITE-A — 강사 초대 패널
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [inviteCurriculumId, setInviteCurriculumId] = useState<string | null>(null);
  const [inviteSessionInfo, setInviteSessionInfo] = useState<string>('');
  const [inviteMessage, setInviteMessage] = useState<string>('');
  // STEP-CURRICULUM-INSTRUCTOR-FIX — 차시별 강사 초대 매핑
  const [invitationMap, setInvitationMap] = useState<Map<string, InvitationSummary>>(new Map());
  // STEP-V1-SPLIT-FULL — staff_pool + profiles 통합 옵션 (훅으로 분리)
  const { staffOptions } = useCurriculumStaff();
  // STEP-CURRICULUM-BULK-DELETE — 다중 선택 일괄 삭제
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`${selectedIds.size}개 차시를 삭제할까요? 매칭된 인력 정보도 함께 삭제되며 되돌릴 수 없어요.`)) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('program_curriculum').delete().in('id', ids);
    setBulkDeleting(false);
    if (error) {
      console.error('[curriculum-tab] 일괄 삭제 실패:', error.message);
      toast.error('삭제 중 오류가 발생했어요.');
      return;
    }
    toast.success(`${ids.length}개 차시를 삭제했어요.`);
    setSelectedIds(new Set());
    void refresh();
  }

  function openInvite(curriculumId: string | null, sessionInfo: string) {
    setInviteCurriculumId(curriculumId);
    setInviteSessionInfo(sessionInfo);
    setInviteMessage(sessionInfo ? `${sessionInfo} 담당 강의를 부탁드립니다.` : '');
    setInvitePanelOpen(true);
  }

  const refresh = useCallback(async () => {
    const next = await fetchCurriculumBundle(programId, curriculumType);
    setItems(next);
    // STEP-CURRICULUM-INSTRUCTOR-FIX — 차시별 강사 초대 매핑 갱신
    const { data: invs, error: invErr } = await supabase
      .from('instructor_invitations').select('id, name, status, curriculum_id')
      .eq('program_id', programId);
    if (invErr) console.error('[curriculum-tab] invitations 조회 실패:', invErr.message);
    const map = new Map<string, InvitationSummary>();
    for (const inv of (invs ?? []) as Array<InvitationSummary & { curriculum_id: string | null }>) {
      if (inv.curriculum_id) map.set(inv.curriculum_id, { id: inv.id, name: inv.name, status: inv.status });
    }
    setInvitationMap(map);
    // STEP-CURRICULUM-FULL — 양 탭 카운트 동기 갱신
    const cnt = await supabase.from('program_curriculum').select('curriculum_type', { count: 'exact', head: false })
      .eq('program_id', programId);
    if (!cnt.error && cnt.data) {
      const types = (cnt.data as Array<{ curriculum_type: CurriculumType }>);
      setCounts({
        planned: types.filter((r) => (r.curriculum_type ?? 'planned') === 'planned').length,
        actual:  types.filter((r) => r.curriculum_type === 'actual').length,
      });
    }
  }, [programId, curriculumType]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, refresh]);

  async function addCurriculum() {
    const nextNo = items.reduce((m, c) => (c.session_no > m ? c.session_no : m), 0) + 1;
    const r = await dbAddCurriculum(programId, curriculumType, nextNo);
    if (!r.ok) {
      toast.error(
        r.kind === 'column' ? '커리큘럼 테이블 컬럼이 적용되지 않았어요. Supabase 마이그레이션 실행 필요.'
        : r.kind === 'rls'  ? '차시 추가 권한이 없어요. 관리자에게 문의해 주세요.'
                            : '차시 추가에 실패했어요. 다시 시도해 주세요.',
      );
      return;
    }
    setItems((prev) => [...prev, { ...r.data, staff: [] }]);
    void refresh();
    toast.success('차시를 추가했어요.');
  }

  async function copyPlannedToActual() {
    setCopying(true);
    try {
      const cnt = await dbCopyPlannedToActual(programId);
      if (cnt == null) { toast.error('실제 운영으로 복사에 실패했어요.'); return; }
      if (cnt === 0)   { toast.error('복사할 제안 차시가 없어요.'); return; }
      toast.success(`${cnt}개 차시를 실제 운영으로 복사했습니다.`);
      void refresh();
    } finally { setCopying(false); }
  }

  async function swapWith(idx: number, dir: 'up' | 'down') {
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    const ok = await dbSwapSessionNo(a.id, a.session_no, b.id, b.session_no);
    if (!ok) { toast.error('순서 변경 실패'); return; }
    void refresh();
  }

  async function saveCurriculum(id: string, patch: Partial<ProgramCurriculum>) {
    const ok = await dbSaveCurriculum(id, patch);
    if (!ok) { toast.error('차시 저장에 실패했어요.'); return; }
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    toast.success('차시를 저장했어요.');
  }

  async function removeCurriculum(id: string) {
    if (!window.confirm('이 차시와 매칭된 인력 정보를 모두 삭제할까요?')) return;
    const ok = await dbRemoveCurriculum(id);
    if (!ok) { toast.error('차시 삭제에 실패했어요.'); return; }
    setItems((prev) => prev.filter((c) => c.id !== id));
    toast.success('차시를 삭제했어요.');
  }

  async function persistOrder(reordered: CurriculumWithStaff[]) {
    setItems(reordered.map((c, i) => ({ ...c, session_no: i + 1 })));
    const failId = await dbPersistOrder(reordered);
    if (failId) {
      toast.error('순서 저장에 실패했어요.');
      void refresh();
    }
  }

  function handleDragEnter(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setItems((prev) => {
      const fromIdx = prev.findIndex((c) => c.id === dragId);
      const toIdx = prev.findIndex((c) => c.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  async function handleDragEnd() {
    setDragId(null);
    await persistOrder(items);
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#1E1B4B]">커리큘럼</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            ⋮⋮ 드래그로 순서 변경 · 차시 펼침으로 입력 후 [저장] · 시간은 시·분 picker로 선택
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { onClick: () => setLoadTplOpen(true), Icon: Download, label: '템플릿 가져오기' },
            { onClick: () => setSaveTplOpen(true), Icon: Save, label: '템플릿으로 저장', disabled: items.length === 0 },
            { onClick: () => setAiCurriculumOpen(true), Icon: Upload, label: '새 파일' },
            { onClick: () => setAiCurriculumOpen(true), Icon: Sparkles, label: 'AI 생성', accent: true },
            { onClick: () => openInvite(null, ''), Icon: UserPlus, label: '강사 현황' },
          ]).map((b, i) => (
            <button key={i} type="button" onClick={b.onClick} disabled={b.disabled}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 ${b.accent ? 'bg-violet-50/40 hover:bg-violet-100' : 'bg-white hover:bg-violet-50'} text-xs font-semibold text-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}>
              <b.Icon size={12} aria-hidden="true" />
              {b.label}
            </button>
          ))}
          <button type="button" onClick={() => void addCurriculum()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors">
            <Plus size={12} aria-hidden="true" /> 차시 추가
          </button>
        </div>
      </header>

      {/* STEP-CURRICULUM-FULL — 제안/실제 운영 토글 */}
      <SubToggle
        items={[
          { key: 'planned', label: `📋 제안 (${counts.planned}차시)` },
          { key: 'actual',  label: `⚡ 실제 운영 (${counts.actual}차시)` },
        ]}
        active={curriculumType}
        onChange={(k) => setCurriculumType(k as CurriculumType)}
      />

      {/* AI 드롭존 — planned 탭에만 노출 */}
      {curriculumType === 'planned' && (
        <CurriculumAiDropZone programId={programId}
          lastSessionNo={items.reduce((m, c) => (c.session_no > m ? c.session_no : m), 0)}
          onSessionsInserted={() => void refresh()} />
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-sm text-slate-400 italic">
            {curriculumType === 'actual'
              ? '실제 운영 차시가 없어요. 제안 커리큘럼에서 복사해서 시작할 수 있어요.'
              : '등록된 차시가 없어요. 위 드롭존에서 AI 추출을 시작하거나 "차시 추가" 버튼을 눌러 주세요.'}
          </p>
          {curriculumType === 'actual' && counts.planned > 0 && (
            <button type="button" onClick={() => void copyPlannedToActual()} disabled={copying}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
              {copying ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} aria-hidden="true" />}
              제안 커리큘럼에서 복사하기 ({counts.planned}차시)
            </button>
          )}
        </div>
      ) : (
        <>
          {/* STEP-OVERVIEW-UI-FULL — 강사 컬럼 추가 (12 컬럼) */}
          <div className="grid grid-cols-[28px_28px_48px_80px_minmax(110px,130px)_minmax(110px,130px)_minmax(0,1fr)_minmax(90px,120px)_minmax(110px,140px)_auto_28px_28px] items-center gap-2 px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {/* STEP-CURRICULUM-BULK-DELETE — 전체 선택 체크박스 */}
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              aria-label="전체 선택"
              className="w-3.5 h-3.5 rounded border-violet-300 text-violet-600 focus:ring-violet-400 mx-auto cursor-pointer" />
            {['', '#', '일자', '시작', '종료', '주제·차시명', '강사', '초대', '', '', ''].map((label, i) => (
              <span key={i} className={i === 1 ? 'text-center' : undefined} aria-hidden={label ? undefined : true}>{label}</span>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            {items.map((c, idx) => (
              <CurriculumRow
                key={c.id}
                item={c}
                programId={programId}
                invitation={invitationMap.get(c.id) ?? null}
                onSave={(patch) => saveCurriculum(c.id, patch)}
                onDelete={() => removeCurriculum(c.id)}
                onRequestInstructor={() => openInvite(c.id, `${c.session_no}차시 — ${c.title}`)}
                canReorder={curriculumType === 'actual'}
                onMoveUp={() => void swapWith(idx, 'up')}
                onMoveDown={() => void swapWith(idx, 'down')}
                isFirst={idx === 0}
                isLast={idx === items.length - 1}
                onDragStart={() => setDragId(c.id)}
                onDragEnter={() => handleDragEnter(c.id)}
                onDragEnd={() => void handleDragEnd()}
                onDragOver={(e) => e.preventDefault()}
                isDragging={dragId === c.id}
                staffOptions={staffOptions}
                checked={selectedIds.has(c.id)}
                onCheckToggle={() => toggleOne(c.id)}
                onSwitchToInstructorTab={onSwitchToInstructorTab}
              />
            ))}
          </div>
        </>
      )}


      <SaveTemplateModal
        open={saveTplOpen}
        onClose={() => setSaveTplOpen(false)}
        onSaved={() => { /* refresh 불필요 (템플릿 풀 별도) */ }}
        sessions={items.map<CurriculumSessionMeta>((c) => ({
          session_no: c.session_no,
          title: c.title,
          content: c.content ?? null,
          duration: c.duration ?? null,
          start_time: trimTime(c.start_time) || null,
          end_time: trimTime(c.end_time) || null,
          venue: c.venue ?? null,
        }))}
      />

      <LoadTemplateModal
        open={loadTplOpen}
        onClose={() => setLoadTplOpen(false)}
        programId={programId}
        onLoaded={() => void refresh()}
      />

      <AiCurriculumModal
        open={aiCurriculumOpen}
        onClose={() => setAiCurriculumOpen(false)}
        programId={programId}
        nextSessionNo={items.reduce((m, c) => (c.session_no > m ? c.session_no : m), 0) + 1}
        onSaved={() => void refresh()}
      />

      {/* STEP-CURRICULUM-BULK-DELETE — 하단 fixed 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl">
          <span className="text-sm font-semibold tabular-nums">{selectedIds.size}개 선택됨</span>
          <button type="button" onClick={() => void handleBulkDelete()} disabled={bulkDeleting}
            className="inline-flex items-center gap-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors">
            {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} aria-hidden="true" />}
            선택 삭제
          </button>
          <button type="button" onClick={clearSelection} disabled={bulkDeleting}
            className="text-slate-300 hover:text-white text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            취소
          </button>
        </div>
      )}

      <InvitationManagePanel
        open={invitePanelOpen}
        programId={programId}
        programName={programName ?? '프로그램'}
        defaultCurriculumId={inviteCurriculumId}
        defaultSessionInfo={inviteSessionInfo}
        defaultMessage={inviteMessage}
        onApproved={() => void refresh()}
        onClose={() => {
          setInvitePanelOpen(false); setInviteCurriculumId(null); setInviteSessionInfo(''); setInviteMessage('');
          void refresh();
        }}
      />
    </div>
  );
}
