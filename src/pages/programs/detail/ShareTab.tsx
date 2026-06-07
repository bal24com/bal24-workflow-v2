// bal24 v2 — 프로그램 상세 · 외부공유 탭 (Stage 3-B-1 재작성)
// 4 단계 시작일 + 3 대상 탭(고객·학생·전문가) + 기타 토큰 모음 (접힘).

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Copy, ExternalLink, Loader2, Megaphone,
  ClipboardCheck, ListChecks, FileText, Share2,
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { RECRUIT_TYPE_LABEL } from '../../../types/application';
import type {
  ProgramShare, ShareAudience, ShareItem,
} from '../../../types/database';
import {
  fetchProgramRecruits, fetchProgramSessions, fetchProgramForms, formTypeLabel,
  type RecruitRow, type SessionRow, type FormRow,
} from './programDetailUtils';
import {
  fetchOrSeedProgramShare, saveStageDates, toggleItemVisibility,
  detectStage, describeCurrentStage, regenerateToken,
  type SaveDatesPayload,
} from './share/shareUtils';
import StageDateBar from './share/StageDateBar';
import AudienceTab from './share/AudienceTab';
import { SHARE_AUDIENCE_LABEL } from './share/visibilityCatalog';
import ExposureMatrixPanel from './share/ExposureMatrixPanel';
import ShareLinkCard from '../../../components/shares/ShareLinkCard';
import type { SharedLink } from '../../shares/sharesUtils';

// 박경수님 2026-06-02 — 4역할 (지원기관·수혜기관·참여팀(개인)·강사/멘토) 메인 탭
const AUDIENCE_TABS: ShareAudience[] = ['supporter', 'beneficiary', 'team', 'staff'];

/** audience 별 토큰 선택 헬퍼 — 신규 4종 우선, 없으면 기존 3종 fallback. */
function pickAudienceToken(share: ProgramShare, audience: ShareAudience): string {
  switch (audience) {
    case 'supporter':   return share.supporter_token   ?? share.client_token;
    case 'beneficiary': return share.beneficiary_token ?? share.client_token;
    case 'team':        return share.team_token        ?? share.student_token;
    case 'staff':       return share.staff_token       ?? share.expert_token;
    case 'client':      return share.client_token;
    case 'student':     return share.student_token;
    case 'expert':      return share.expert_token;
    default:            return share.client_token;
  }
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function buildBase(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export default function ShareTab({ programId }: { programId: string }) {
  const toast = useToast();
  const [share, setShare] = useState<ProgramShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [audienceTab, setAudienceTab] = useState<ShareAudience>('supporter');
  const [draftDates, setDraftDates] = useState<SaveDatesPayload>({
    pre_date: null, ready_date: null, progress_date: null, result_date: null,
    // 박경수님 + SkyClaw 2026-05-28 — 각 단계 종료일
    pre_end_date: null, ready_end_date: null, progress_end_date: null, result_end_date: null,
  });
  const [savingDates, setSavingDates] = useState(false);

  // 기타 토큰 모음 (접힘)
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [recruits, setRecruits] = useState<RecruitRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [legacyLoaded, setLegacyLoaded] = useState(false);

  const refreshShare = useCallback(async () => {
    const next = await fetchOrSeedProgramShare(programId);
    if (!next) {
      toast.error('외부공유 정보를 불러오지 못했어요. (테이블 미생성?)');
      return;
    }
    setShare(next);
    setDraftDates({
      pre_date: next.pre_date ?? null,
      ready_date: next.ready_date ?? null,
      progress_date: next.progress_date ?? null,
      result_date: next.result_date ?? null,
      // 박경수님 + SkyClaw 2026-05-28 — 각 단계 종료일
      pre_end_date: next.pre_end_date ?? null,
      ready_end_date: next.ready_end_date ?? null,
      progress_end_date: next.progress_end_date ?? null,
      result_end_date: next.result_end_date ?? null,
    });
  }, [programId, toast]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refreshShare();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, refreshShare]);

  useEffect(() => {
    if (!legacyOpen || legacyLoaded) return;
    let cancelled = false;
    void (async () => {
      const [r, s, f] = await Promise.all([
        fetchProgramRecruits(programId),
        fetchProgramSessions(programId),
        fetchProgramForms(programId),
      ]);
      if (cancelled) return;
      setRecruits(r);
      setSessions(s);
      setForms(f);
      setLegacyLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [legacyOpen, legacyLoaded, programId]);

  const now = todayIso();
  const currentStage = useMemo(
    () => share ? detectStage(now, share) : 'before',
    [share, now],
  );
  const stageDescription = useMemo(
    () => share ? describeCurrentStage(currentStage, share, now) : '',
    [share, currentStage, now],
  );

  const datesDirty = useMemo(() => {
    if (!share) return false;
    return (
      draftDates.pre_date !== (share.pre_date ?? null) ||
      draftDates.ready_date !== (share.ready_date ?? null) ||
      draftDates.progress_date !== (share.progress_date ?? null) ||
      draftDates.result_date !== (share.result_date ?? null)
    );
  }, [draftDates, share]);

  function patchDraftDate<K extends keyof SaveDatesPayload>(key: K, value: SaveDatesPayload[K]) {
    setDraftDates((d) => ({ ...d, [key]: value }));
  }

  async function handleSaveDates() {
    setSavingDates(true);
    try {
      const res = await saveStageDates(programId, draftDates);
      if (!res.ok) {
        // STEP-PHASE-DATE-FIX — 진단을 위해 raw 에러 메시지 노출
        toast.error(`단계 날짜 저장 실패: ${res.error ?? '알 수 없는 오류'}`);
        return;
      }
      toast.success('단계 날짜를 저장했어요.');
      void refreshShare();
    } finally {
      setSavingDates(false);
    }
  }

  async function handleToggleItem(audience: ShareAudience, item: ShareItem, next: boolean) {
    if (!share) return;
    const updated = await toggleItemVisibility(programId, share.visibility, audience, item, next);
    if (!updated) {
      toast.error('노출 항목 저장에 실패했습니다.');
      return;
    }
    setShare({ ...share, visibility: updated });
    toast.success('노출 항목이 저장되었습니다.');
  }

  async function handleRegenerate(audience: ShareAudience) {
    const ok = await regenerateToken(programId, audience);
    if (!ok) {
      toast.error('토큰 재발급에 실패했어요.');
      return;
    }
    void refreshShare();
  }

  if (loading || !share) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StageDateBar
        draft={draftDates}
        onChange={patchDraftDate}
        currentStage={currentStage}
        stageDescription={stageDescription}
        dirty={datesDirty}
        saving={savingDates}
        onSave={handleSaveDates}
      />

      {/* 박경수님 2026-06-02 SHARE-UX-2 — 통합 노출 관리 (4역할 한 표) */}
      <ExposureMatrixPanel
        programId={programId}
        visibility={share.visibility}
        onChange={(next) => setShare({ ...share, visibility: next })}
      />

      {/* 대상별 탭 */}
      <div
        role="tablist"
        aria-label="외부공유 대상"
        className="inline-flex items-center bg-violet-50 rounded-full p-0.5 border border-violet-100 self-start"
      >
        {AUDIENCE_TABS.map((aud) => {
          const active = audienceTab === aud;
          return (
            <button
              key={aud}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setAudienceTab(aud)}
              className={`h-8 px-4 text-xs font-bold rounded-full transition-colors ${
                active ? 'bg-violet-600 text-white' : 'text-violet-600 hover:bg-violet-100'
              }`}
            >
              {SHARE_AUDIENCE_LABEL[aud]}
            </button>
          );
        })}
      </div>

      <AudienceTab
        audience={audienceTab}
        token={pickAudienceToken(share, audienceTab)}
        visibility={share.visibility}
        currentStage={currentStage}
        onToggleItem={(item, next) => handleToggleItem(audienceTab, item, next)}
        onRegenerateToken={() => handleRegenerate(audienceTab)}
      />

      {/* 기타 토큰 모음 (접힘) */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <button
          type="button"
          onClick={() => setLegacyOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2">
            <Share2 size={14} className="text-slate-400" aria-hidden="true" />
            <span className="text-sm font-bold text-[#1E1B4B]">기타 외부 링크</span>
            <span className="text-[11px] text-slate-500">신청·모집·출석·폼 토큰 모음</span>
          </div>
          {legacyOpen
            ? <ChevronDown size={14} className="text-slate-400" aria-hidden="true" />
            : <ChevronRight size={14} className="text-slate-400" aria-hidden="true" />}
        </button>

        {legacyOpen && !legacyLoaded && (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
          </div>
        )}

        {legacyOpen && legacyLoaded && (
          <LegacyLinks
            programId={programId}
            recruits={recruits}
            sessions={sessions}
            forms={forms}
            toastSuccess={(m) => toast.success(m)}
            toastError={(m) => toast.error(m)}
          />
        )}
      </section>
    </div>
  );
}

interface LegacyProps {
  programId: string;
  recruits: RecruitRow[];
  sessions: SessionRow[];
  forms: FormRow[];
  toastSuccess: (m: string) => void;
  toastError: (m: string) => void;
}

function LegacyLinks({ programId, recruits, sessions, forms, toastSuccess, toastError }: LegacyProps) {
  const links: SharedLink[] = useMemo(() => {
    const list: SharedLink[] = [];

    // 1. 교육생 신청 폼
    list.push({
      id: `apply-${programId}`,
      category: 'program_share',
      label: '교육생 신청 폼',
      subLabel: '신청',
      path: '/apply',
      token: programId,
      status: '활성',
      createdAt: new Date().toISOString(),
    });

    // 2. 모집 공고
    recruits.filter(r => r.is_active).forEach(r => {
      list.push({
        id: `recruit-${r.id}`,
        category: 'form',
        label: r.title,
        subLabel: RECRUIT_TYPE_LABEL[r.recruit_type],
        path: '/recruit',
        token: r.form_token,
        status: '활성',
        createdAt: r.created_at || new Date().toISOString(),
      });
    });

    // 3. 출석 세션
    sessions.filter(s => s.check_in_open).forEach(s => {
      list.push({
        id: `attend-${s.id}`,
        category: 'attendance',
        label: s.title,
        subLabel: '출석',
        path: '/attend',
        token: s.session_token,
        status: '열림',
        createdAt: s.created_at || new Date().toISOString(),
      });
    });

    // 4. 외부 폼
    forms.filter(f => f.is_active).forEach(f => {
      list.push({
        id: `form-${f.id}`,
        category: 'form',
        label: f.title,
        subLabel: formTypeLabel(f.form_type),
        path: '/form',
        token: f.form_token,
        status: '활성',
        createdAt: f.created_at || new Date().toISOString(),
      });
    });

    return list;
  }, [programId, recruits, sessions, forms]);

  if (links.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-slate-400">진행 중인 외부 링크가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {links.map((link) => (
          <ShareLinkCard key={link.id} link={link} />
        ))}
      </div>
      <p className="text-[11px] text-slate-400 italic flex items-center gap-1.5 mt-2">
        <ListChecks size={11} aria-hidden="true" />
        일지 외부 작성 토큰은 향후 일지별로 발행 예정.
      </p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-[11px] text-slate-400 italic text-center py-1">{msg}</p>;
}

Copy: (href: string, label: string) => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2">
      {icon}
      {badge && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 shrink-0">
          {badge}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">{label}</span>
      <button
        type="button"
        onClick={() => void onCopy(href, label)}
        title="링크 복사"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
      >
        <Copy size={12} aria-hidden="true" />
      </button>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title="새 탭 열기"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
      >
        <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-[11px] text-slate-400 italic text-center py-1">{msg}</p>;
}
