// bal24 v2 — 프로그램 상세 · 커리큘럼 탭 (V7 NewEducationV9 ⑥ 차용)
// 테이블형 차시 + DateTimePicker + 매칭 모달 + 드래그 정렬.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, Upload, Save, Download, UserPlus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import StaffMatchModal from './curriculum/StaffMatchModal';
import CurriculumRow from './curriculum/CurriculumRow';
import SaveTemplateModal from './curriculum/SaveTemplateModal';
import LoadTemplateModal from './curriculum/LoadTemplateModal';
import AiCurriculumModal from './curriculum/AiCurriculumModal';
import CurriculumAiDropZone from './curriculum/CurriculumAiDropZone';
import CurriculumStaffSection from './curriculum/CurriculumStaffSection';
import InvitationManagePanel from '../InvitationManagePanel';
import { fetchCurriculumBundle, trimTime, type CurriculumWithStaff } from './curriculum/curriculumTabUtils';
import type {
  CurriculumStaffRole, ProgramCurriculum, InvitationStatus,
} from '../../../types/database';

interface InvitationSummary { id: string; name: string; status: InvitationStatus; }
import type { CurriculumSessionMeta } from './curriculum/curriculumTemplateUtils';

interface Props {
  programId: string;
  programName?: string;
}

export default function CurriculumTab({ programId, programName }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<CurriculumWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchTarget, setMatchTarget] = useState<{ curriculumId: string; defaultRole: CurriculumStaffRole } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [loadTplOpen, setLoadTplOpen] = useState(false);
  const [aiCurriculumOpen, setAiCurriculumOpen] = useState(false);
  // STEP-INSTRUCTOR-INVITE-A — 강사 초대 패널
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [inviteCurriculumId, setInviteCurriculumId] = useState<string | null>(null);
  const [inviteSessionInfo, setInviteSessionInfo] = useState<string>('');
  const [inviteMessage, setInviteMessage] = useState<string>('');
  // STEP-CURRICULUM-INSTRUCTOR-FIX — 차시별 강사 초대 매핑
  const [invitationMap, setInvitationMap] = useState<Map<string, InvitationSummary>>(new Map());
  // STEP-CURRICULUM-INSTRUCTOR-VIEW — 강사 배정 현황 새로고침 키
  const [staffSectionKey, setStaffSectionKey] = useState(0);

  function openInvite(curriculumId: string | null, sessionInfo: string) {
    setInviteCurriculumId(curriculumId);
    setInviteSessionInfo(sessionInfo);
    setInviteMessage(sessionInfo ? `${sessionInfo} 담당 강의를 부탁드립니다.` : '');
    setInvitePanelOpen(true);
  }

  const refresh = useCallback(async () => {
    const next = await fetchCurriculumBundle(programId);
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
    setStaffSectionKey((k) => k + 1);
  }, [programId]);

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
    const { data, error } = await supabase
      .from('program_curriculum')
      .insert({
        program_id: programId,
        session_no: nextNo,
        title: `${nextNo}차시`,
      })
      .select('*')
      .maybeSingle();
    if (error || !data) {
      console.error('[curriculum-tab] 차시 추가 실패:', error?.message);
      toast.error('차시 추가에 실패했어요.');
      return;
    }
    setItems((prev) => [...prev, { ...(data as ProgramCurriculum), staff: [] }]);
    toast.success('차시를 추가했어요.');
  }

  async function saveCurriculum(id: string, patch: Partial<ProgramCurriculum>) {
    const { error } = await supabase.from('program_curriculum').update(patch).eq('id', id);
    if (error) {
      console.error('[curriculum-tab] 차시 저장 실패:', error.message);
      toast.error('차시 저장에 실패했어요.');
      return;
    }
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    toast.success('차시를 저장했어요.');
  }

  async function removeCurriculum(id: string) {
    if (!window.confirm('이 차시와 매칭된 인력 정보를 모두 삭제할까요?')) return;
    const { error } = await supabase.from('program_curriculum').delete().eq('id', id);
    if (error) {
      console.error('[curriculum-tab] 차시 삭제 실패:', error.message);
      toast.error('차시 삭제에 실패했어요.');
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== id));
    toast.success('차시를 삭제했어요.');
  }

  async function removeStaff(staffId: string) {
    if (!window.confirm('이 매칭 인력을 삭제할까요?')) return;
    const { error } = await supabase.from('curriculum_staff').delete().eq('id', staffId);
    if (error) {
      console.error('[curriculum-tab] 매칭 인력 삭제 실패:', error.message);
      toast.error('인력 삭제에 실패했어요.');
      return;
    }
    void refresh();
    toast.success('매칭 인력을 삭제했어요.');
  }

  async function persistOrder(reordered: CurriculumWithStaff[]) {
    setItems(reordered.map((c, i) => ({ ...c, session_no: i + 1 })));
    for (let i = 0; i < reordered.length; i += 1) {
      const c = reordered[i];
      if (c.session_no === i + 1) continue;
      const { error } = await supabase
        .from('program_curriculum')
        .update({ session_no: i + 1 })
        .eq('id', c.id);
      if (error) {
        console.error('[curriculum-tab] 순서 저장 실패:', error.message);
        toast.error('순서 저장에 실패했어요.');
        void refresh();
        return;
      }
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
          <button
            type="button"
            onClick={() => setLoadTplOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 transition-colors"
          >
            <Download size={12} aria-hidden="true" />
            템플릿 가져오기
          </button>
          <button
            type="button"
            onClick={() => setSaveTplOpen(true)}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={12} aria-hidden="true" />
            템플릿으로 저장
          </button>
          <button
            type="button"
            onClick={() => setAiCurriculumOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 transition-colors"
          >
            <Upload size={12} aria-hidden="true" />
            새 파일
          </button>
          <button
            type="button"
            onClick={() => setAiCurriculumOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-violet-50/40 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
          >
            <Sparkles size={12} aria-hidden="true" />
            AI 생성
          </button>
          <button
            type="button"
            onClick={() => openInvite(null, '')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-200 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 transition-colors"
          >
            <UserPlus size={12} aria-hidden="true" />
            강사 현황
          </button>
          <button
            type="button"
            onClick={() => void addCurriculum()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors"
          >
            <Plus size={12} aria-hidden="true" />
            차시 추가
          </button>
        </div>
      </header>

      {/* STEP-UX-FIXES — AI 드롭존 최상단 (PDF·이미지·DOCX·XLSX 등) */}
      <CurriculumAiDropZone
        programId={programId}
        lastSessionNo={items.reduce((m, c) => (c.session_no > m ? c.session_no : m), 0)}
        onSessionsInserted={() => void refresh()}
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">
          등록된 차시가 없어요. 위 드롭존에서 AI 추출을 시작하거나 "차시 추가" 버튼을 눌러 주세요.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[28px_48px_80px_minmax(110px,130px)_minmax(110px,130px)_minmax(0,1fr)_minmax(140px,180px)_28px_28px] items-center gap-2 px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span aria-hidden="true" />
            <span className="text-center">#</span>
            <span>일자</span>
            <span>시작</span>
            <span>종료</span>
            <span>주제·차시명</span>
            <span>강사</span>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1.5">
            {items.map((c) => (
              <CurriculumRow
                key={c.id}
                item={c}
                invitation={invitationMap.get(c.id) ?? null}
                onSave={(patch) => saveCurriculum(c.id, patch)}
                onDelete={() => removeCurriculum(c.id)}
                onOpenMatch={(role) => setMatchTarget({ curriculumId: c.id, defaultRole: role })}
                onDeleteStaff={removeStaff}
                onRequestInstructor={() => openInvite(c.id, `${c.session_no}차시 — ${c.title}`)}
                onDragStart={() => setDragId(c.id)}
                onDragEnter={() => handleDragEnter(c.id)}
                onDragEnd={() => void handleDragEnd()}
                onDragOver={(e) => e.preventDefault()}
                isDragging={dragId === c.id}
              />
            ))}
          </div>
        </>
      )}

      {/* STEP-CURRICULUM-INSTRUCTOR-VIEW — 차시별 강사·멘토 배정 현황 + 강사 요청 */}
      <div className="border-t border-slate-100 my-2" />
      <CurriculumStaffSection
        programId={programId}
        refreshKey={staffSectionKey}
        onRequestInstructor={(cid, info) => openInvite(cid, info)}
      />

      <StaffMatchModal
        open={matchTarget !== null}
        onClose={() => setMatchTarget(null)}
        curriculumId={matchTarget?.curriculumId ?? ''}
        defaultRole={matchTarget?.defaultRole}
        onAdded={() => void refresh()}
      />

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

      <InvitationManagePanel
        open={invitePanelOpen}
        programId={programId}
        programName={programName ?? '프로그램'}
        defaultCurriculumId={inviteCurriculumId}
        defaultSessionInfo={inviteSessionInfo}
        defaultMessage={inviteMessage}
        onApproved={() => setStaffSectionKey((k) => k + 1)}
        onClose={() => {
          setInvitePanelOpen(false); setInviteCurriculumId(null); setInviteSessionInfo(''); setInviteMessage('');
          void refresh();
        }}
      />
    </div>
  );
}
