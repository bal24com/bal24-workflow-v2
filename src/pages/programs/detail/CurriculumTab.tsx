// bal24 v2 — 프로그램 상세 · 커리큘럼 탭 (V7 NewEducationV9 ⑥ 차용)
// 테이블형 차시 + DateTimePicker + 매칭 모달 + 드래그 정렬.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, Upload, Save, Download, UserPlus, Copy } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import SubToggle from './SubToggle';
import CurriculumRow from './curriculum/CurriculumRow';
import SaveTemplateModal from './curriculum/SaveTemplateModal';
import LoadTemplateModal from './curriculum/LoadTemplateModal';
import AiCurriculumModal from './curriculum/AiCurriculumModal';
import CurriculumAiDropZone from './curriculum/CurriculumAiDropZone';
import CurriculumStaffSection from './curriculum/CurriculumStaffSection';
import InvitationManagePanel from '../InvitationManagePanel';
import { fetchCurriculumBundle, trimTime, type CurriculumWithStaff } from './curriculum/curriculumTabUtils';
import type { StaffOption } from './curriculum/CurriculumRowStaffSection';
import type {
  CurriculumType, ProgramCurriculum, InvitationStatus,
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
  // STEP-CURRICULUM-INSTRUCTOR-VIEW — 강사 배정 현황 새로고침 키
  const [staffSectionKey, setStaffSectionKey] = useState(0);
  // STEP-PROGRAM-ENHANCE-FULL — staff_pool 옵션 (N번 fetch 방지 — CurriculumTab 마운트 시 1회)
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    void supabase.from('staff_pool').select('id, name, organization').is('deleted_at', null).order('name')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error('[curriculum-tab] staff_pool 조회 실패:', error.message); return; }
        setStaffOptions((data ?? []) as StaffOption[]);
      });
    return () => { cancelled = true; };
  }, []);

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
    setStaffSectionKey((k) => k + 1);
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
    // STEP-CURRICULUM-ATTEND-SURVEY-FULL — 차시 등록 안정화
    //   1) session_no = 현재 탭 max + 1 (gap 무시 — 단순·안전)
    //   2) title 기본값 '' (사용자가 직접 입력) — 기존 "{N}차시" 자동값 제거
    //   3) curriculum_type 명시 포함 (NOT NULL default 'planned' 안전망 + 명시)
    //   4) 실패 시 toast.error 한글 + 컬럼/권한 분기 메시지
    const nextNo = items.reduce((m, c) => (c.session_no > m ? c.session_no : m), 0) + 1;
    const { data, error } = await supabase
      .from('program_curriculum')
      .insert({
        program_id: programId,
        session_no: nextNo,
        curriculum_type: curriculumType,
        title: '',
        content: '',
      })
      .select('*')
      .maybeSingle();
    if (error || !data) {
      const raw = (error?.message ?? '').toLowerCase();
      console.error('[curriculum-tab] 차시 추가 실패:', error?.message);
      const msg = raw.includes('column') && raw.includes('does not exist')
        ? '커리큘럼 테이블 컬럼이 적용되지 않았어요. Supabase 마이그레이션 실행 필요.'
        : raw.includes('row-level security') || raw.includes('permission denied')
          ? '차시 추가 권한이 없어요. 관리자에게 문의해 주세요.'
          : '차시 추가에 실패했어요. 다시 시도해 주세요.';
      toast.error(msg);
      return;
    }
    setItems((prev) => [...prev, { ...(data as ProgramCurriculum), staff: [] }]);
    void refresh();
    toast.success('차시를 추가했어요.');
  }

  // STEP-CURRICULUM-FULL — 제안 → 실제 운영 복사 (curriculum_staff 제외)
  async function copyPlannedToActual() {
    setCopying(true);
    try {
      const planned = await supabase.from('program_curriculum').select('*')
        .eq('program_id', programId).eq('curriculum_type', 'planned').order('session_no');
      if (planned.error || !planned.data) { console.error('[curriculum-tab] planned 조회 실패:', planned.error?.message); toast.error('제안 커리큘럼 조회에 실패했어요.'); return; }
      const rows = planned.data as ProgramCurriculum[];
      if (rows.length === 0) { toast.error('복사할 제안 차시가 없어요.'); return; }
      const insertRows = rows.map((r) => ({
        program_id: programId, session_no: r.session_no, title: r.title,
        content: r.content ?? null, day_label: r.day_label ?? null,
        start_time: r.start_time ?? null, end_time: r.end_time ?? null,
        instructor_name_raw: r.instructor_name_raw ?? null, curriculum_type: 'actual',
      }));
      const ins = await supabase.from('program_curriculum').insert(insertRows);
      if (ins.error) { console.error('[curriculum-tab] actual 복사 실패:', ins.error.message); toast.error('실제 운영으로 복사에 실패했어요.'); return; }
      toast.success(`${rows.length}개 차시를 실제 운영으로 복사했습니다.`);
      void refresh();
    } finally { setCopying(false); }
  }

  // STEP-CURRICULUM-FULL — actual 탭 ↑↓ swap (임시 unique 충돌 회피 — 3단계 update)
  async function swapWith(idx: number, dir: 'up' | 'down') {
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    const tmp = -Math.abs(a.session_no) - 100000;
    const upd = (id: string, no: number) => supabase.from('program_curriculum').update({ session_no: no }).eq('id', id);
    for (const [id, no] of [[a.id, tmp], [b.id, a.session_no], [a.id, b.session_no]] as Array<[string, number]>) {
      const r = await upd(id, no);
      if (r.error) { console.error('[curriculum-tab] swap 실패:', r.error.message); toast.error('순서 변경 실패'); return; }
    }
    void refresh();
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
        <CurriculumAiDropZone
          programId={programId}
          lastSessionNo={items.reduce((m, c) => (c.session_no > m ? c.session_no : m), 0)}
          onSessionsInserted={() => void refresh()}
        />
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
          <div className="grid grid-cols-[28px_48px_80px_minmax(110px,130px)_minmax(110px,130px)_minmax(0,1fr)_minmax(110px,140px)_auto_28px_28px] items-center gap-2 px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span aria-hidden="true" />
            <span className="text-center">#</span>
            <span>일자</span>
            <span>시작</span>
            <span>종료</span>
            <span>주제·차시명</span>
            <span>초대</span>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
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
                onStaffChanged={() => setStaffSectionKey((k) => k + 1)}
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
