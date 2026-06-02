// 박경수님 2026-05-30 STEP-PORTAL-BULK-REGISTER — 수혜자 팀 등록 섹션.
// PortalAdminPanel 내 inline 섹션을 분리. 단건 추가 + 일괄 등록 모달.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import PortalTeamBulkModal from './PortalTeamBulkModal';

interface TeamRow { id: string; team_code: string; team_name: string }

interface Props {
  portalId: string;
}

export default function PortalTeamSection({ portalId }: Props) {
  const toast = useToast();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('portal_teams')
      .select('id, team_code, team_name')
      .eq('portal_id', portalId)
      .order('team_code');
    if (error) console.error('[PortalTeamSection] fetch:', error.message);
    setTeams((data ?? []) as TeamRow[]);
    setLoading(false);
  }, [portalId]);

  useEffect(() => { void reload(); }, [reload]);

  async function addTeam() {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    if (!code || !name) { toast.error('팀코드와 팀명을 모두 입력해 주세요.'); return; }
    const { error } = await supabase.from('portal_teams')
      .insert({ portal_id: portalId, team_code: code, team_name: name });
    if (error) {
      console.error('[PortalTeamSection] 추가:', error.message);
      toast.error(error.message.includes('duplicate') ? '같은 팀코드가 이미 있어요.' : '팀 추가 실패');
      return;
    }
    toast.success('팀을 추가했어요.');
    setNewCode(''); setNewName('');
    void reload();
  }

  async function removeTeam(id: string, name: string) {
    if (!window.confirm(`"${name}" 팀을 삭제할까요?`)) return;
    const { error } = await supabase.from('portal_teams').delete().eq('id', id);
    if (error) { toast.error('삭제 실패'); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[#1E1B4B]">👥 수혜자 팀 등록 ({teams.length})</h3>
        <button type="button" onClick={() => setBulkOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-violet-200 text-violet-700 text-xs font-bold hover:bg-violet-50">
          <Upload size={12} aria-hidden="true" /> 일괄 등록
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : (
        <div className="space-y-1">
          {teams.map((t) => (
            <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50">
              <span className="text-xs font-mono font-bold text-slate-700 w-20">{t.team_code}</span>
              <span className="flex-1 text-sm text-slate-700">{t.team_name}</span>
              <button type="button" onClick={() => void removeTeam(t.id, t.team_name)}
                className="p-1 rounded hover:bg-rose-50 text-rose-500" aria-label="삭제">
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <input type="text" value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="팀코드"
              className="w-24 h-9 rounded-lg border border-slate-200 px-2 text-sm font-mono outline-none focus:border-violet-500" />
            <input type="text" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="팀명"
              className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
            <button type="button" onClick={() => void addTeam()}
              className="px-3 h-9 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold hover:bg-violet-200 inline-flex items-center gap-1">
              <Plus size={12} aria-hidden="true" /> 추가
            </button>
          </div>
        </div>
      )}

      <PortalTeamBulkModal
        portalId={portalId}
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => { void reload(); }}
      />
    </section>
  );
}
