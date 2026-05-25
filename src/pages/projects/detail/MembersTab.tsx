// bal24 v2 — 프로젝트 상세 · 참여인력 탭
// project_members ⨯ profiles 조인 + projects.pm_id 자동 통합 (담당자가 비어 있으면 [PM] 배지로 노출)

import { useEffect, useState } from 'react';
import { Loader2, UserCircle2 } from 'lucide-react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';

type MemberRow = {
  id: string;
  role?: string | null;
  created_at: string;
  profile: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
    role: string;
  } | null;
};

// projects.pm_id 가 있는데 project_members 에 없을 때 동기화 row (가상)
function synthesizePm(pm: { id: string; name: string; email: string; department: string | null; role: string }): MemberRow {
  return {
    id: `pm:${pm.id}`,
    role: 'PM (담당자)',
    created_at: '',
    profile: pm,
  };
}

type Props = {
  projectId: string;
};

const SELECT_COLUMNS =
  'id, role, created_at, profile:profiles!inner(id, name, email, department, role)';

export default function MembersTab({ projectId }: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    void (async () => {
      const [mRes, pRes] = await Promise.all([
        supabase.from('project_members').select(SELECT_COLUMNS).eq('project_id', projectId).order('created_at', { ascending: true }),
        supabase.from('projects').select('pm_id, pm:profiles!projects_pm_id_fkey(id, name, email, department, role)').eq('id', projectId).maybeSingle(),
      ]);
      if (cancelled) return;
      if (mRes.error) {
        console.error('[members] 조회 실패:', mRes.error.message);
        setErrorMsg('참여인력 목록을 불러오지 못했어요.');
        setLoading(false);
        return;
      }
      const base = (mRes.data ?? []) as unknown as MemberRow[];
      // projects.pm_id 가 있고 project_members 에 같은 profile 이 없으면 자동 합치기 (가상 row)
      const pmRaw = (pRes.data as { pm: { id: string; name: string; email: string; department: string | null; role: string } | { id: string; name: string; email: string; department: string | null; role: string }[] | null } | null)?.pm;
      const pm = Array.isArray(pmRaw) ? pmRaw[0] : pmRaw;
      const merged = pm && !base.some((m) => m.profile?.id === pm.id) ? [synthesizePm(pm), ...base] : base;
      setMembers(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted">
        <Loader2 size={16} className="animate-spin mr-2" />
        불러오는 중…
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
        {errorMsg}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <UserCircle2 size={32} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-muted">아직 참여 인력이 없어요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>참여인력 ({members.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-100 -mx-1">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-3 px-1">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary">
                <UserCircle2 size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text truncate">
                    {m.profile?.name ?? '이름 미지정'}
                  </span>
                  {m.profile?.role && (
                    <Badge variant="primary">{m.profile.role}</Badge>
                  )}
                  {m.role && <Badge variant="default">{m.role}</Badge>}
                </div>
                <div className="text-xs text-muted truncate">
                  {m.profile?.email}
                  {m.profile?.department ? ` · ${m.profile.department}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
