// bal24 v2 — 컨소시엄 탭7: 포털 권한 (참여사별 섹션 권한 매트릭스)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import EmptyState from '../../../components/EmptyState';
import ConPortalPermissionModal from './ConPortalPermissionModal';
import {
  PERM_LEVEL,
  PERM_LEVEL_LABEL,
  MEMBER_TYPE_LABEL,
  MEMBER_TYPE_STYLE,
  type ConsortiumMember,
  type ConsortiumStatus,
  type MemberType,
  type PermLevel,
} from '../consortiumTypes';

interface Props {
  consortiumId: string;
  status: ConsortiumStatus;
  members: ConsortiumMember[];
}

interface PermRow {
  id: string;
  consortium_id: string;
  member_id: string;
  perm_overview: PermLevel;
  perm_programs: PermLevel;
  perm_tasks: PermLevel;
  perm_finance: PermLevel;
  perm_staff: PermLevel;
  perm_links: PermLevel;
  is_active: boolean;
}

type PermField = 'perm_overview' | 'perm_programs' | 'perm_tasks' | 'perm_finance' | 'perm_staff' | 'perm_links';

const PERM_COLUMNS: Array<{ key: PermField; label: string; sensitive?: boolean }> = [
  { key: 'perm_overview', label: '개요' },
  { key: 'perm_programs', label: '프로그램' },
  { key: 'perm_tasks', label: '태스크' },
  { key: 'perm_finance', label: '재무', sensitive: true },
  { key: 'perm_staff', label: '인력', sensitive: true },
  { key: 'perm_links', label: '링크' },
];

export default function ConPortalTab({ consortiumId, status, members }: Props) {
  const toast = useToast();
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [permModalTarget, setPermModalTarget] = useState<ConsortiumMember | null>(null);
  const debounceRef = useRef<Map<string, number>>(new Map());

  const dissolved = status === '해산';

  const fetchPerms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consortium_portal_permissions')
        .select('*')
        .eq('consortium_id', consortiumId);
      if (error) throw error;
      setPerms((data as PermRow[] | null) ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[con-portal] 권한 조회 실패:', raw);
      toast.error('포털 권한을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [consortiumId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchPerms();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchPerms]);

  // 권한 없는 참여사
  const missingMembers = useMemo(() => {
    const have = new Set(perms.map((p) => p.member_id));
    return members.filter((m) => !have.has(m.id));
  }, [members, perms]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const handlePermChange = (permId: string, field: PermField, value: PermLevel) => {
    if (dissolved) return;
    // 즉시 UI 반영
    setPerms((prev) => prev.map((p) => (p.id === permId ? { ...p, [field]: value } : p)));
    // 디바운스 500ms
    const key = `${permId}:${field}`;
    const existing = debounceRef.current.get(key);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(async () => {
      const { error } = await supabase
        .from('consortium_portal_permissions')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', permId);
      debounceRef.current.delete(key);
      if (error) {
        console.error('[con-portal] 권한 변경 실패:', error.message);
        toast.error('권한 변경 중 오류가 발생했어요.');
        void fetchPerms();
      }
    }, 500);
    debounceRef.current.set(key, timer);
  };

  const handleToggleActive = async (perm: PermRow) => {
    if (dissolved) return;
    const next = !perm.is_active;
    const { error } = await supabase
      .from('consortium_portal_permissions')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', perm.id);
    if (error) {
      console.error('[con-portal] 활성 토글 실패:', error.message);
      toast.error('활성 상태 변경 중 오류가 발생했어요.');
      return;
    }
    // member.portal_enabled 도 동기화
    await supabase.from('consortium_members').update({ portal_enabled: next }).eq('id', perm.member_id);
    toast.success(next ? '포털 접근을 허용했어요.' : '포털 접근을 차단했어요.');
    void fetchPerms();
  };

  const openPermModal = (member: ConsortiumMember) => {
    if (dissolved) return;
    setPermModalTarget(member);
  };

  return (
    <div className="space-y-4">
      {dissolved && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-2">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-rose-800">
            <p className="font-bold mb-0.5">컨소시엄이 해산되어 참여사 포털 권한이 자동 해제되었어요.</p>
            <p className="text-xs text-rose-700">권한 설정은 비활성 상태이며 수정할 수 없어요.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-violet-500" aria-hidden="true" />
          참여사별 섹션 권한 (none·read·write·manage)
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
        </div>
      ) : perms.length === 0 ? (
        <EmptyState
          emoji="🔐"
          title="아직 권한 설정이 없어요."
          description={dissolved ? '컨소시엄이 해산되어 신규 권한 설정 불가.' : '참여사별로 포털 접근 권한을 설정해 주세요.'}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-violet-100 overflow-x-auto shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <table className="w-full text-sm">
            <thead className="bg-violet-50/40 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-violet-50/80">참여사</th>
                {PERM_COLUMNS.map((col) => (
                  <th key={col.key} className={`text-left px-3 py-2 font-semibold ${col.sensitive ? 'text-rose-600' : ''}`}>
                    {col.label}{col.sensitive && ' ⚠'}
                  </th>
                ))}
                <th className="text-center px-3 py-2 font-semibold">포털 활성</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perms.map((perm) => {
                const member = memberMap.get(perm.member_id);
                const memberType = (member?.member_type ?? 'observer') as MemberType;
                return (
                  <tr key={perm.id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-2 sticky left-0 bg-white">
                      <div className="flex items-center gap-1.5 min-w-[150px]">
                        <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${MEMBER_TYPE_STYLE[memberType]}`}>
                          {MEMBER_TYPE_LABEL[memberType]}
                        </span>
                        <span className="font-semibold text-[#1E1B4B] truncate">
                          {member?.clients?.name ?? '미지정'}
                        </span>
                      </div>
                    </td>
                    {PERM_COLUMNS.map((col) => (
                      <td key={col.key} className="px-3 py-2">
                        <select
                          value={perm[col.key]}
                          onChange={(e) => handlePermChange(perm.id, col.key, e.target.value as PermLevel)}
                          disabled={dissolved}
                          className={`rounded-md border px-2 py-1 text-xs outline-none focus:border-violet-500 ${
                            col.sensitive && perm[col.key] !== 'none'
                              ? 'border-rose-300 bg-rose-50 text-rose-700'
                              : 'border-slate-200 bg-white'
                          } disabled:opacity-50`}
                        >
                          {PERM_LEVEL.map((lv) => (
                            <option key={lv} value={lv}>{PERM_LEVEL_LABEL[lv]}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={perm.is_active}
                          onChange={() => void handleToggleActive(perm)}
                          disabled={dissolved}
                          className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/30"
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!dissolved && missingMembers.length > 0 && (
        <section className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4">
          <h3 className="text-sm font-bold text-[#1E1B4B] mb-2">권한 설정 안 된 참여사 ({missingMembers.length}곳)</h3>
          <ul className="space-y-1.5">
            {missingMembers.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${MEMBER_TYPE_STYLE[m.member_type as MemberType]}`}>
                    {MEMBER_TYPE_LABEL[m.member_type as MemberType]}
                  </span>
                  <span className="font-semibold text-[#1E1B4B] truncate">{m.clients?.name ?? '미지정'}</span>
                </div>
                <Button variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={() => openPermModal(m)}>
                  권한 설정 추가
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-400 italic">
        💡 변경은 자동 저장됩니다 (500ms 디바운스). ⚠ 표시는 민감 정보 (재무·인력) — 신중히 권한 부여.
      </p>

      <ConPortalPermissionModal
        open={permModalTarget !== null}
        onClose={() => setPermModalTarget(null)}
        onSaved={() => {
          setPermModalTarget(null);
          void fetchPerms();
        }}
        consortiumId={consortiumId}
        member={permModalTarget}
      />
    </div>
  );
}
