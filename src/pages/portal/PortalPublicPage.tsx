// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE — 5단계 역할 통합 외부 진입 페이지.
// 라우트: /portal/:token

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { resolvePortalRole, type PortalWithRole, type PortalRole } from './portalUtils';
import { isPinAuthed, getAuthedTeam, type TeamInfo } from './portalAuth';
import { isProjectExpired } from '../../lib/portalExpiry';
import PortalPinGate from './PortalPinGate';
import PortalTeamGate from './PortalTeamGate';
import PortalChecklistView from './PortalChecklistView';

type Screen = 'loading' | 'notfound' | 'expired' | 'pin' | 'team' | 'ready';

export default function PortalPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<Screen>('loading');
  const [pwr, setPwr] = useState<PortalWithRole | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) { setScreen('notfound'); return; }
      const result = await resolvePortalRole(token);
      if (cancelled) return;
      if (!result) { setScreen('notfound'); return; }
      // 프로젝트 종료 시 자동 만료
      if (await isProjectExpired(result.portal.project_id)) {
        if (cancelled) return;
        setScreen('expired'); return;
      }
      setPwr(result);
      // 역할별 게이트 분기
      if (result.role === 'beneficiary_org') {
        if (isPinAuthed(result.portal.id)) setScreen('ready');
        else setScreen('pin');
      } else if (result.role === 'participant') {
        const authed = getAuthedTeam(result.portal.id);
        if (authed) { setTeam(authed); setScreen('ready'); }
        else setScreen('team');
      } else {
        setScreen('ready');  // operator / supporter / admin 은 토큰만으로 통과
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }
  if (screen === 'notfound') {
    return <ErrorScreen emoji="🔍" title="유효하지 않은 링크예요" body="링크를 다시 확인해 주세요." />;
  }
  if (screen === 'expired') {
    return <ErrorScreen emoji="⏰" title="만료된 링크예요"
      body="프로젝트가 종료되어 이 링크는 더 이상 사용할 수 없어요. 관리자에게 문의해 주세요." />;
  }
  if (!pwr) {
    return <ErrorScreen emoji="⚠️" title="포털 정보를 불러올 수 없어요" body="잠시 후 다시 시도해 주세요." />;
  }

  if (screen === 'pin') {
    return (
      <PortalPinGate
        portalId={pwr.portal.id} portalTitle={pwr.portal.title}
        storedPin={pwr.portal.beneficiary_pin}
        onSuccess={() => setScreen('ready')} />
    );
  }
  if (screen === 'team') {
    return (
      <PortalTeamGate
        portalId={pwr.portal.id} portalTitle={pwr.portal.title}
        onSuccess={(t) => { setTeam(t); setScreen('ready'); }} />
    );
  }

  return (
    <PortalChecklistView
      portalId={pwr.portal.id}
      portalTitle={pwr.portal.title}
      portalDescription={pwr.portal.description}
      role={pwr.role as PortalRole}
      team={team} />
  );
}

function ErrorScreen({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-violet-100 shadow-card p-8 text-center space-y-2">
        <div className="text-3xl" aria-hidden="true">{emoji}</div>
        <h1 className="text-xl font-bold text-[#1E1B4B]">{title}</h1>
        <p className="text-sm text-slate-500">{body}</p>
      </div>
    </div>
  );
}
