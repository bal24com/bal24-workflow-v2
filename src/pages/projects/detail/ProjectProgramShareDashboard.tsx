// 박경수님 2026-06-02 STEP-C — 프로젝트 외부공유 탭 = 소속 프로그램의 4역할 외부공유 링크 모음.
// 박경수님 의도 "프로젝트가 프로그램을 그대로 연결" 구현.

import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  BookOpen, Copy, ExternalLink, Loader2, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { Badge } from '../../../components/ui';

interface ProgramRow {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface ShareRow {
  program_id: string;
  supporter_token: string | null;
  beneficiary_token: string | null;
  team_token: string | null;
  staff_token: string | null;
}

interface Props {
  projectId: string;
}

const ROLE_LINKS = [
  { key: 'supporter',   label: '지원기관',   path: '/share/supporter',   color: 'bg-violet-50  text-violet-700  border-violet-200' },
  { key: 'beneficiary', label: '수혜기관',   path: '/share/beneficiary', color: 'bg-amber-50   text-amber-700   border-amber-200' },
  { key: 'team',        label: '참여팀(개인)', path: '/share/team',        color: 'bg-sky-50     text-sky-700     border-sky-200' },
  { key: 'staff',       label: '강사/멘토',  path: '/share/staff',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
] as const;

function pickToken(share: ShareRow | undefined, key: typeof ROLE_LINKS[number]['key']): string | null {
  if (!share) return null;
  switch (key) {
    case 'supporter':   return share.supporter_token;
    case 'beneficiary': return share.beneficiary_token;
    case 'team':        return share.team_token;
    case 'staff':       return share.staff_token;
  }
}

export default function ProjectProgramShareDashboard({ projectId }: Props) {
  const toast = useToast();
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [shares, setShares] = useState<Map<string, ShareRow>>(new Map());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const pRes = await supabase
      .from('programs')
      .select('id, name, type, status, start_date, end_date')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });
    if (pRes.error) {
      console.error('[ProjectProgramShareDashboard] 프로그램 조회 실패:', pRes.error.message);
      toast.error('소속 프로그램을 불러오지 못했어요.');
      setLoading(false);
      return;
    }
    const progs = (pRes.data ?? []) as ProgramRow[];
    setPrograms(progs);
    if (progs.length === 0) { setShares(new Map()); setLoading(false); return; }

    const sRes = await supabase
      .from('program_share')
      .select('program_id, supporter_token, beneficiary_token, team_token, staff_token')
      .in('program_id', progs.map((p) => p.id));
    if (sRes.error) {
      console.error('[ProjectProgramShareDashboard] program_share 조회 실패:', sRes.error.message);
      // 부분 실패는 무시 — 토큰이 없는 프로그램은 안내문 표시
    }
    const map = new Map<string, ShareRow>();
    (sRes.data ?? []).forEach((r) => map.set((r as ShareRow).program_id, r as ShareRow));
    setShares(map);
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  async function copyLink(token: string, roleLabel: string, programName: string) {
    const url = `${window.location.origin}${ROLE_LINKS.find((r) => r.label === roleLabel)?.path}/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${programName} · ${roleLabel} 링크를 복사했어요.`);
    else toast.error('링크 복사에 실패했어요.');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted">
        <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" />
        프로그램 외부공유 링크 불러오는 중…
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-8 text-center">
        <BookOpen size={28} className="mx-auto text-violet-300 mb-2" aria-hidden="true" />
        <p className="text-sm text-slate-500 mb-1">이 프로젝트에 등록된 프로그램이 없어요.</p>
        <p className="text-xs text-slate-400">[프로그램] 탭에서 프로그램을 먼저 등록해 주세요.</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-violet-500" aria-hidden="true" />
          프로그램별 외부 공유 ({programs.length})
        </h3>
        <p className="text-[11px] text-slate-500">각 프로그램의 4역할 링크예요. 노출 항목은 프로그램 상세에서 설정해요.</p>
      </header>

      <div className="space-y-3">
        {programs.map((p) => {
          const share = shares.get(p.id);
          return (
            <article key={p.id} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-[#1E1B4B] truncate">{p.name}</h4>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {p.type && <Badge variant="primary">{p.type}</Badge>}
                    {p.status && <Badge variant="default">{p.status}</Badge>}
                    {(p.start_date || p.end_date) && (
                      <span className="text-[11px] text-slate-500">
                        {p.start_date ?? '?'} ~ {p.end_date ?? '?'}
                      </span>
                    )}
                  </div>
                </div>
                <RouterLink
                  to={`/programs/${p.id}#external-share`}
                  className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-violet-200 text-violet-700 text-xs font-bold hover:bg-violet-50"
                  title="프로그램 외부공유 설정으로 이동"
                >
                  외부공유 설정 <ArrowRight size={11} aria-hidden="true" />
                </RouterLink>
              </div>

              {!share ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  외부공유 데이터가 아직 생성되지 않았어요. 프로그램 [외부 공유] 탭에 한 번 진입하면 자동 생성돼요.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {ROLE_LINKS.map((r) => {
                    const token = pickToken(share, r.key);
                    if (!token) return null;
                    const url = `${window.location.origin}${r.path}/${token}`;
                    return (
                      <div key={r.key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${r.color}`}>
                        <span className="text-[11px] font-bold w-20 shrink-0">{r.label}</span>
                        <code className="flex-1 min-w-0 truncate text-[10px] font-mono">{token}</code>
                        <button type="button" onClick={() => void copyLink(token, r.label, p.name)}
                          className="p-1 rounded hover:bg-white/50" title="링크 복사">
                          <Copy size={11} aria-hidden="true" />
                        </button>
                        <a href={url} target="_blank" rel="noreferrer" title="새 탭 열기"
                          className="p-1 rounded hover:bg-white/50">
                          <ExternalLink size={11} aria-hidden="true" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
