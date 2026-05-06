// bal24 v2 — 컨소시엄 상세 페이지
// 탭: 개요(기본정보+참여사+지분율) / 파일

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, FileText, Info, Loader2, Briefcase, Building2, Users2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  consortiumStatusToBadgeVariant,
  roleToBadgeVariant,
} from './consortiumStatus';
import type { Consortium, ConsortiumMember } from '../../types/database';
import ConsortiumFilesTab from './ConsortiumFilesTab';

type DetailRow = Consortium & {
  lead_client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
};

type MemberRow = ConsortiumMember & {
  client?: { id: string; name: string } | null;
};

type TabKey = 'overview' | 'files';

const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: 'overview', label: '개요', Icon: Info },
  { key: 'files',    label: '파일', Icon: FileText },
];

const SELECT_COLUMNS =
  '*, lead_client:clients!consortiums_lead_client_id_fkey(id,name), project:projects!consortiums_project_id_fkey(id,name)';

const MEMBER_SELECT =
  '*, client:clients(id,name)';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-2">🔍</div>
      <p className="text-sm text-muted mb-3">컨소시엄을 찾을 수 없어요.</p>
      <Link to="/consortium" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft size={14} />
        컨소시엄 목록으로
      </Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm text-text font-medium">{children}</div>
    </div>
  );
}

function MembersList({ members, totalRatio }: { members: MemberRow[]; totalRatio: number }) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-6">아직 등록된 참여사가 없어요.</p>
    );
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 -mx-1">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-3 px-1">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
              <Building2 size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-text truncate">
                  {m.client?.name ?? m.org_name ?? '이름 미지정'}
                </span>
                {m.role && <Badge variant={roleToBadgeVariant(m.role)}>{m.role}</Badge>}
              </div>
              {m.responsibilities && (
                <div className="text-xs text-muted truncate">{m.responsibilities}</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-text">
                {m.budget_ratio != null ? `${m.budget_ratio}%` : '–'}
              </div>
              <div className="text-[10px] text-muted">지분율</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
        <span className="text-xs font-semibold text-slate-500">합계</span>
        <span className={['text-sm font-bold',
          totalRatio === 100 ? 'text-success' : totalRatio > 100 ? 'text-danger' : 'text-text'].join(' ')}>
          {totalRatio.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function OverviewTab({ c, members }: { c: DetailRow; members: MemberRow[] }) {
  const totalRatio = members.reduce((s, m) => s + (m.budget_ratio ?? 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="상태">
              <Badge variant={consortiumStatusToBadgeVariant(c.status)}>{c.status}</Badge>
            </Field>
            <Field label="주관사">{c.lead_client?.name ?? '미지정'}</Field>
            <Field label="연결 프로젝트">
              {c.project?.name ? (
                <Link to={`/projects/${c.project.id}`} className="text-primary hover:underline inline-flex items-center gap-1">
                  <Briefcase size={12} />
                  {c.project.name}
                </Link>
              ) : (
                '미연결'
              )}
            </Field>
            <Field label="등록일">
              {c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR') : '–'}
            </Field>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>설명</CardTitle>
        </CardHeader>
        <CardContent>
          {c.description ? (
            <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{c.description}</p>
          ) : (
            <p className="text-sm text-muted">아직 설명이 없어요.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>참여사 ({members.length})</CardTitle>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Users2 size={12} />
              지분율 합계 {totalRatio.toFixed(1)}%
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <MembersList members={members} totalRatio={totalRatio} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConsortiumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [item, setItem] = useState<DetailRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    Promise.all([
      supabase.from('consortiums').select(SELECT_COLUMNS).eq('id', id).maybeSingle(),
      supabase.from('consortium_members').select(MEMBER_SELECT).eq('consortium_id', id).order('created_at', { ascending: true }),
    ]).then(([cRes, mRes]) => {
      if (cancelled) return;
      if (cRes.error) {
        console.error('[consortium-detail] 조회 실패:', cRes.error.message);
        setErrorMsg('컨소시엄 정보를 불러오지 못했어요.');
      } else {
        setItem((cRes.data ?? null) as DetailRow | null);
      }
      if (mRes.error) {
        console.error('[consortium-members] 조회 실패:', mRes.error.message);
      } else {
        setMembers((mRes.data ?? []) as MemberRow[]);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [id]);

  const consortiumId = useMemo(() => id ?? '', [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted">
        <Loader2 size={18} className="animate-spin mr-2" />
        불러오는 중…
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="space-y-3">
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
        <Link to="/consortium" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft size={14} />
          컨소시엄 목록으로
        </Link>
      </div>
    );
  }

  if (!item) return <NotFound />;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="space-y-2">
        <Link to="/consortium" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary">
          <ArrowLeft size={12} />
          컨소시엄 목록
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text">{item.name}</h1>
          <Badge variant={consortiumStatusToBadgeVariant(item.status)}>{item.status}</Badge>
        </div>
        <div className="text-xs text-muted">
          {item.lead_client?.name ? `주관 ${item.lead_client.name}` : '주관사 미지정'}
          {item.project?.name && ` · 프로젝트 ${item.project.name}`}
          {` · 참여사 ${members.length}곳`}
        </div>
      </div>

      <nav role="tablist" aria-label="컨소시엄 상세 탭"
        className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} type="button" role="tab" aria-selected={active}
              onClick={() => setTab(key)}
              className={['inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'].join(' ')}>
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel">
        {tab === 'overview' && <OverviewTab c={item} members={members} />}
        {tab === 'files' && <ConsortiumFilesTab consortiumId={consortiumId} uploaderId={user?.id} />}
      </div>
    </div>
  );
}
