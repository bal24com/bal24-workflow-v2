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

const AUDIENCE_TABS: ShareAudience[] = ['client', 'student', 'expert'];

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
  const [audienceTab, setAudienceTab] = useState<ShareAudience>('client');
  const [draftDates, setDraftDates] = useState<SaveDatesPayload>({
    pre_date: null, ready_date: null, progress_date: null, result_date: null,
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
      toast.error('항목 표시 변경에 실패했어요.');
      return;
    }
    setShare({ ...share, visibility: updated });
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
        token={
          audienceTab === 'client' ? share.client_token :
          audienceTab === 'student' ? share.student_token :
          share.expert_token
        }
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
  const base = buildBase();
  async function copy(href: string, label: string) {
    const ok = await copyToClipboard(href);
    if (ok) toastSuccess(`${label} 링크 복사 완료`);
    else toastError('링크 복사에 실패했어요.');
  }
  const apply = `${base}/apply/${programId}`;
  const recruitLinks = recruits.filter((r) => r.is_active);
  const attendLinks = sessions.filter((s) => s.check_in_open);
  const formLinks = forms.filter((f) => f.is_active);

  return (
    <div className="flex flex-col gap-2 mt-3">
      <Row label="교육생 신청 폼" badge="신청" href={apply} icon={<Share2 size={13} className="text-violet-500" aria-hidden="true" />} onCopy={copy} />
      {recruitLinks.length === 0 ? (
        <Empty msg="진행중 모집 공고가 없어요." />
      ) : recruitLinks.map((r) => (
        <Row
          key={`r-${r.id}`}
          label={r.title}
          badge={RECRUIT_TYPE_LABEL[r.recruit_type]}
          href={`${base}/recruit/${r.form_token}`}
          icon={<Megaphone size={13} className="text-orange-500" aria-hidden="true" />}
          onCopy={copy}
        />
      ))}
      {attendLinks.length === 0 ? (
        <Empty msg="진행중 출석 세션이 없어요." />
      ) : attendLinks.map((s) => (
        <Row
          key={`s-${s.id}`}
          label={s.title}
          badge="출석"
          href={`${base}/attend/${s.session_token}`}
          icon={<ClipboardCheck size={13} className="text-emerald-500" aria-hidden="true" />}
          onCopy={copy}
        />
      ))}
      {formLinks.length === 0 ? (
        <Empty msg="진행중 외부 폼이 없어요." />
      ) : formLinks.map((f) => (
        <Row
          key={`f-${f.id}`}
          label={f.title}
          badge={formTypeLabel(f.form_type)}
          href={`${base}/form/${f.form_token}`}
          icon={<FileText size={13} className="text-cyan-500" aria-hidden="true" />}
          onCopy={copy}
        />
      ))}
      <p className="text-[11px] text-slate-400 italic flex items-center gap-1.5 mt-1">
        <ListChecks size={11} aria-hidden="true" />
        일지 외부 작성 토큰은 향후 일지별로 발행 예정.
      </p>
    </div>
  );
}

function Row({
  label, badge, href, icon, onCopy,
}: {
  label: string; badge?: string; href: string;
  icon: React.ReactNode;
  onCopy: (href: string, label: string) => Promise<void>;
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
