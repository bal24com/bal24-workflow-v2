// 박경수님 2026-06-02 STEP-C — 프로젝트 외부공유 탭
// 상단: 프로젝트 직접 역할별 링크 4종 (컨소시엄 포털과 동일 구조)
// 하단: 소속 프로그램별 4역할 링크 (프로그램 있을 때)

import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  BookOpen, Copy, ExternalLink, Loader2, ArrowRight, ShieldCheck, Plus, Check,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { Badge } from '../../../components/ui';

// ── 타입 ──────────────────────────────────────────────────────

interface PortalRow {
  id: string;
  supporter_token: string | null;
  beneficiary_token: string | null;
  participant_token: string | null;
  operator_token: string | null;
}

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

// ── 상수 ──────────────────────────────────────────────────────

const PROJECT_ROLE_LINKS = [
  { key: 'supporter_token',   label: '지원기관',    path: '/share/supporter',   color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { key: 'beneficiary_token', label: '수혜기관',    path: '/share/beneficiary', color: 'bg-cyan-50    text-cyan-700    border-cyan-200' },
  { key: 'participant_token', label: '수혜팀(개인)', path: '/share/team',        color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'operator_token',    label: '강사·멘토',  path: '/share/staff',       color: 'bg-orange-50  text-orange-700  border-orange-200' },
] as const;
type PortalTokenKey = typeof PROJECT_ROLE_LINKS[number]['key'];

const PROGRAM_ROLE_LINKS = [
  { key: 'supporter',   label: '지원기관',    path: '/share/supporter',   color: 'bg-violet-50  text-violet-700  border-violet-200' },
  { key: 'beneficiary', label: '수혜기관',    path: '/share/beneficiary', color: 'bg-amber-50   text-amber-700   border-amber-200' },
  { key: 'team',        label: '참여팀(개인)', path: '/share/team',        color: 'bg-sky-50     text-sky-700     border-sky-200' },
  { key: 'staff',       label: '강사/멘토',   path: '/share/staff',       color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
] as const;

function pickProgramToken(share: ShareRow | undefined, key: typeof PROGRAM_ROLE_LINKS[number]['key']): string | null {
  if (!share) return null;
  switch (key) {
    case 'supporter':   return share.supporter_token;
    case 'beneficiary': return share.beneficiary_token;
    case 'team':        return share.team_token;
    case 'staff':       return share.staff_token;
  }
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function ProjectProgramShareDashboard({ projectId }: Props) {
  const toast = useToast();
  const [portal, setPortal] = useState<PortalRow | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [shares, setShares] = useState<Map<string, ShareRow>>(new Map());
  const [programsLoading, setProgramsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // ── 프로젝트 포털 로드 ─────────────────────────────────────

  const loadPortal = useCallback(async () => {
    setPortalLoading(true);
    const { data, error } = await supabase
      .from('project_portals')
      .select('id, supporter_token, beneficiary_token, participant_token, operator_token')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      console.error('[ProjectShareDashboard] portal 조회 실패:', error.message);
    }
    setPortal((data as PortalRow | null) ?? null);
    setPortalLoading(false);
  }, [projectId]);

  // ── 프로그램 + program_share 로드 ─────────────────────────

  const loadPrograms = useCallback(async () => {
    setProgramsLoading(true);
    const pRes = await supabase
      .from('programs')
      .select('id, name, type, status, start_date, end_date')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });
    if (pRes.error) {
      console.error('[ProjectShareDashboard] 프로그램 조회 실패:', pRes.error.message);
      setProgramsLoading(false);
      return;
    }
    const progs = (pRes.data ?? []) as ProgramRow[];
    setPrograms(progs);
    if (progs.length > 0) {
      const sRes = await supabase
        .from('program_share')
        .select('program_id, supporter_token, beneficiary_token, team_token, staff_token')
        .in('program_id', progs.map((p) => p.id));
      const map = new Map<string, ShareRow>();
      (sRes.data ?? []).forEach((r) => map.set((r as ShareRow).program_id, r as ShareRow));
      setShares(map);
    }
    setProgramsLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadPortal();
    void loadPrograms();
  }, [loadPortal, loadPrograms]);

  // ── 포털 자동 생성 ─────────────────────────────────────────

  const handleCreatePortal = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('project_portals')
        .insert({ project_id: projectId, title: '외부 공유 포털', is_active: true })
        .select('id, supporter_token, beneficiary_token, participant_token, operator_token')
        .single();
      if (error) throw error;
      setPortal(data as PortalRow);
      toast.success('외부 공유 링크를 생성했어요.');
    } catch (err) {
      console.error('[ProjectShareDashboard] portal 생성 실패:', err instanceof Error ? err.message : '');
      toast.error('링크 생성 중 오류가 발생했어요.');
    } finally {
      setCreating(false);
    }
  };

  // ── 링크 복사 ─────────────────────────────────────────────

  const handleCopyPortal = async (tokenKey: PortalTokenKey, token: string) => {
    const role = PROJECT_ROLE_LINKS.find((r) => r.key === tokenKey);
    if (!role) return;
    const url = `${window.location.origin}${role.path}/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedKey(tokenKey);
      setTimeout(() => setCopiedKey((prev) => (prev === tokenKey ? null : prev)), 2000);
      toast.success(`${role.label} 링크를 복사했어요.`);
    } else {
      toast.error('링크 복사에 실패했어요.');
    }
  };

  const handleCopyProgram = async (token: string, roleLabel: string, programName: string) => {
    const role = PROGRAM_ROLE_LINKS.find((r) => r.label === roleLabel);
    if (!role) return;
    const url = `${window.location.origin}${role.path}/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${programName} · ${roleLabel} 링크를 복사했어요.`);
    else toast.error('링크 복사에 실패했어요.');
  };

  // ── 렌더 ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── 프로젝트 직접 역할별 포털 링크 ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-violet-500" aria-hidden="true" />
          <h3 className="text-sm font-bold text-[#1E1B4B]">역할별 외부 포털 링크</h3>
          <span className="text-xs text-slate-400">프로그램 없이도 바로 공유 가능</span>
        </div>

        {portalLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROJECT_ROLE_LINKS.map((role) => {
              const token = portal ? (portal[role.key] ?? null) : null;
              const url = token ? `${window.location.origin}${role.path}/${token}` : null;
              return (
                <div
                  key={role.key}
                  className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_2px_8px_rgba(124,58,237,0.05)] space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full border ${role.color}`}>
                      {role.label}
                    </span>
                  </div>

                  {portal && url ? (
                    <>
                      <p className="text-[11px] text-slate-400 font-mono truncate bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
                        {url}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleCopyPortal(role.key, token!)}
                          className="flex-1 h-8 rounded-xl bg-violet-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-violet-700 transition-colors"
                        >
                          {copiedKey === role.key ? <Check size={13} /> : <Copy size={13} />}
                          {copiedKey === role.key ? '복사됨' : 'URL 복사'}
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 w-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:text-violet-600 hover:border-violet-300 transition-colors"
                          aria-label="새 탭으로 열기"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleCreatePortal()}
                      disabled={creating}
                      className="w-full h-8 rounded-xl border border-dashed border-violet-300 text-violet-600 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-violet-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      링크 생성
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <hr className="border-slate-100" />

      {/* ── 프로그램별 외부공유 링크 ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
            <BookOpen size={14} className="text-violet-400" aria-hidden="true" />
            프로그램별 외부 공유
          </h3>
          <p className="text-[11px] text-slate-400">노출 항목은 프로그램 상세에서 설정해요.</p>
        </div>

        {programsLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" />
            불러오는 중…
          </div>
        ) : programs.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 text-center">
            <p className="text-sm text-slate-400 mb-1">등록된 프로그램이 없어요.</p>
            <p className="text-xs text-slate-300">[프로그램] 탭에서 프로그램을 등록하면 여기에 표시돼요.</p>
          </div>
        ) : (
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
                      {PROGRAM_ROLE_LINKS.map((r) => {
                        const token = pickProgramToken(share, r.key);
                        if (!token) return null;
                        const url = `${window.location.origin}${r.path}/${token}`;
                        return (
                          <div key={r.key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${r.color}`}>
                            <span className="text-[11px] font-bold w-20 shrink-0">{r.label}</span>
                            <code className="flex-1 min-w-0 truncate text-[10px] font-mono">{token}</code>
                            <button type="button" onClick={() => void handleCopyProgram(token, r.label, p.name)}
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
        )}
      </section>
    </div>
  );
}
