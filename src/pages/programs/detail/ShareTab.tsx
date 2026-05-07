// bal24 v2 — 프로그램 상세 · 외부 공유 탭
// 토큰 기반 외부 라우트 모음 (신청 / 모집 / 출석 / 일지 / 폼).

import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Loader2, Share2, Megaphone, ClipboardCheck, ListChecks, FileText } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { RECRUIT_TYPE_LABEL } from '../../../types/application';
import {
  fetchProgramRecruits,
  fetchProgramSessions,
  fetchProgramForms,
  formTypeLabel,
  type RecruitRow,
  type SessionRow,
  type FormRow,
} from './programDetailUtils';

interface LinkRow {
  id: string;
  label: string;
  href: string;
  badge?: string;
  icon: React.ReactNode;
}

function buildBase(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export default function ShareTab({ programId }: { programId: string }) {
  const toast = useToast();
  const [recruits, setRecruits] = useState<RecruitRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [r, s, f] = await Promise.all([
          fetchProgramRecruits(programId),
          fetchProgramSessions(programId),
          fetchProgramForms(programId),
        ]);
        if (cancelled) return;
        setRecruits(r);
        setSessions(s);
        setForms(f);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[program-detail] 외부 공유 로드 실패:', raw);
        toast.error('외부 공유 정보를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, toast]);

  const base = buildBase();

  const handleCopy = async (href: string, label: string) => {
    const ok = await copyToClipboard(href);
    if (ok) toast.success(`${label} 링크 복사 완료`);
    else toast.error('링크 복사에 실패했어요.');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  const applyLink: LinkRow = {
    id: 'apply',
    label: '교육생 신청 폼',
    href: `${base}/apply/${programId}`,
    badge: '신청',
    icon: <Share2 size={14} className="text-violet-500" aria-hidden="true" />,
  };

  const recruitLinks: LinkRow[] = recruits
    .filter((r) => r.is_active)
    .map((r) => ({
      id: `recruit-${r.id}`,
      label: r.title,
      href: `${base}/recruit/${r.form_token}`,
      badge: RECRUIT_TYPE_LABEL[r.recruit_type],
      icon: <Megaphone size={14} className="text-orange-500" aria-hidden="true" />,
    }));

  const attendLinks: LinkRow[] = sessions
    .filter((s) => s.check_in_open)
    .map((s) => ({
      id: `attend-${s.id}`,
      label: s.title,
      href: `${base}/attend/${s.session_token}`,
      badge: '출석',
      icon: <ClipboardCheck size={14} className="text-emerald-500" aria-hidden="true" />,
    }));

  const formLinks: LinkRow[] = forms
    .filter((f) => f.is_active)
    .map((f) => ({
      id: `form-${f.id}`,
      label: f.title,
      href: `${base}/form/${f.form_token}`,
      badge: formTypeLabel(f.form_type),
      icon: <FileText size={14} className="text-cyan-500" aria-hidden="true" />,
    }));

  return (
    <div className="flex flex-col gap-4">
      <Section title="신청 · 모집" icon={<Megaphone size={16} className="text-orange-500" aria-hidden="true" />}>
        <LinkItem row={applyLink} onCopy={handleCopy} />
        {recruitLinks.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic text-center py-2">진행중 모집 공고가 없어요.</p>
        ) : (
          recruitLinks.map((row) => <LinkItem key={row.id} row={row} onCopy={handleCopy} />)
        )}
      </Section>

      <Section title="출석 외부" icon={<ClipboardCheck size={16} className="text-emerald-500" aria-hidden="true" />}>
        {attendLinks.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic text-center py-2">진행중 출석 세션이 없어요.</p>
        ) : (
          attendLinks.map((row) => <LinkItem key={row.id} row={row} onCopy={handleCopy} />)
        )}
      </Section>

      <Section title="설문·피드백 폼" icon={<FileText size={16} className="text-cyan-500" aria-hidden="true" />}>
        {formLinks.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic text-center py-2">진행중 외부 폼이 없어요.</p>
        ) : (
          formLinks.map((row) => <LinkItem key={row.id} row={row} onCopy={handleCopy} />)
        )}
      </Section>

      <p className="text-[11px] text-slate-400 italic flex items-center gap-1.5">
        <ListChecks size={11} aria-hidden="true" />
        일지 외부 작성 링크는 향후 일지별로 발행 예정 (1단계 미포함).
      </p>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-2">
      <header className="flex items-center gap-1.5">
        {icon}
        <h3 className="text-sm font-bold text-[#1E1B4B]">{title}</h3>
      </header>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

function LinkItem({ row, onCopy }: { row: LinkRow; onCopy: (href: string, label: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2">
      {row.icon}
      {row.badge && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 shrink-0">
          {row.badge}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
        {row.label}
      </span>
      <button
        type="button"
        onClick={() => onCopy(row.href, row.label)}
        title="링크 복사"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
      >
        <Copy size={13} aria-hidden="true" />
      </button>
      <a
        href={row.href}
        target="_blank"
        rel="noreferrer"
        title="새 탭 열기"
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
      >
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    </div>
  );
}
