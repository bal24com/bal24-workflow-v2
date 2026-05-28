// 학교 담당자 포털 — 교육생·팀 탭. 팀 그룹핑 + 팀 링크 발급.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Link as LinkIcon, Copy, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { createTeamPortal, listTeamPortals } from '../../../hooks/portal/useSchoolPortal';
import type { ProgramPortal, SchoolPortalContext } from '../../../types/schoolPortal';

interface Props { context: SchoolPortalContext }

interface Participant {
  id: string;
  name: string;
  status: string | null;
  team_name: string | null;
  phone: string | null;
}

export default function SchoolParticipantsTab({ context }: Props) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teamPortals, setTeamPortals] = useState<ProgramPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [teamLabel, setTeamLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [pRes, tRes] = await Promise.all([
      supabase
        .from('program_participants')
        .select('id, name, status, team_name, phone')
        .eq('program_id', context.programId)
        .order('team_name', { ascending: true })
        .order('name', { ascending: true }),
      listTeamPortals(context.programId),
    ]);
    if (pRes.error) console.error('[SchoolParticipantsTab] 교육생 조회:', pRes.error.message);
    setParticipants((pRes.data ?? []) as Participant[]);
    setTeamPortals(tRes);
    setLoading(false);
  }, [context.programId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateTeam = async () => {
    if (!teamLabel.trim()) return alert('팀명을 입력해 주세요.');
    if (selectedIds.size === 0) return alert('팀원을 1명 이상 선택해 주세요.');
    setCreating(true);
    const res = await createTeamPortal({
      programId: context.programId,
      clientId: context.schoolClientId,
      teamLabel: teamLabel.trim(),
      participantIds: Array.from(selectedIds),
    });
    setCreating(false);
    if (res.error || !res.portalToken) {
      alert(res.error ?? '팀 링크 발급 실패');
      return;
    }
    const url = `${window.location.origin}/program-portal/${res.portalToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(res.portalToken);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[SchoolParticipantsTab] 클립보드 복사 실패:', raw);
    }
    setTeamLabel('');
    setSelectedIds(new Set());
    void fetchAll();
  };

  const copyExistingLink = async (token: string) => {
    const url = `${window.location.origin}/program-portal/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[SchoolParticipantsTab] 복사 실패:', raw);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-500" size={24} /></div>;
  }

  // 팀별 그룹핑
  const grouped = new Map<string, Participant[]>();
  for (const p of participants) {
    const key = p.team_name ?? '미배정';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

  return (
    <div className="space-y-5">
      {/* 팀 링크 발급 카드 */}
      <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
          <Plus size={16} className="text-violet-500" aria-hidden="true" /> 팀 링크 발급
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={teamLabel} onChange={(e) => setTeamLabel(e.target.value)}
            placeholder="팀명 (예: 해양탐험팀, 1팀)"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <button type="button" onClick={() => void handleCreateTeam()} disabled={creating}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 inline-flex items-center gap-1.5">
            {creating ? <Loader2 className="animate-spin" size={14} /> : <LinkIcon size={14} />}
            팀 링크 발급
          </button>
        </div>
        <p className="text-xs text-slate-500">아래 교육생을 선택한 후 팀명 입력 → 발급. URL 자동 복사됩니다.</p>
      </section>

      {/* 교육생 목록 — 팀별 */}
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-3">교육생 ({participants.length}명)</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">등록된 교육생이 없어요.</p>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([team, members]) => (
              <div key={team} className="border border-slate-200 rounded-xl p-3">
                <div className="text-xs font-bold text-slate-600 mb-2">{team} ({members.length}명)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {members.map((p) => (
                    <label key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition ${
                      selectedIds.has(p.id) ? 'bg-violet-50 text-violet-700' : 'hover:bg-slate-50'
                    }`}>
                      <input type="checkbox" checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelect(p.id)} className="accent-violet-600" />
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.phone && <span className="text-[11px] text-slate-400">{p.phone}</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 기존 팀 링크 목록 */}
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-700 mb-3">기존 팀 링크 ({teamPortals.length})</h2>
        {teamPortals.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">발급된 팀 링크가 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {teamPortals.map((tp) => (
              <li key={tp.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{tp.team_label ?? '팀'}</span>
                  <span className="ml-2 text-xs text-slate-400">팀원 {tp.participant_ids.length}명</span>
                  <span className="ml-2 text-xs text-slate-400">· {tp.created_at.slice(0, 10)}</span>
                </div>
                <button type="button" onClick={() => void copyExistingLink(tp.portal_token)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700">
                  {copiedToken === tp.portal_token ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 링크 복사</>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
