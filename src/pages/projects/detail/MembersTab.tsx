// bal24 v2 — 프로젝트 상세 · 참여인력 탭
// project_members ⨯ profiles 조인

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

    supabase
      .from('project_members')
      .select(SELECT_COLUMNS)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[members] 조회 실패:', error.message);
          setErrorMsg('참여인력 목록을 불러오지 못했어요.');
        } else {
          setMembers((data ?? []) as unknown as MemberRow[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
