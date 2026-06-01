// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE — 5단계 역할 통합 외부 진입 페이지.
// 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE — 2단계 토큰 매칭 확장.
//   1차: project_portals 4종 토큰 (operator·supporter·beneficiary·participant)
//   2차: portal_beneficiary_orgs.token (수혜기관별 개별 토큰)

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { resolvePortalRole, type PortalWithRole, type PortalRole } from './portalUtils';
import { isPinAuthed, getAuthedTeam, verifyBeneficiaryPin, type TeamInfo } from './portalAuth';
import { isProjectExpired } from '../../lib/portalExpiry';
import PortalPinGate from './PortalPinGate';
import PortalTeamGate from './PortalTeamGate';
import PortalChecklistView from './PortalChecklistView';
import PortalOperatorView from './PortalOperatorView';
import PortalBeneficiaryView from './PortalBeneficiaryView';

type Screen = 'loading' | 'notfound' | 'expired' | 'pin' | 'team' | 'beneficiary-pin' | 'ready';

interface SurveyConfig { schedule_options?: string[]; fields?: string[] }
interface PortalRowFull {
  id: string; project_id: string; title: string; description: string | null;
  is_active: boolean;
  operator_token: string | null; supporter_token: string | null;
  beneficiary_token: string | null; participant_token: string | null;
  beneficiary_pin: string | null;
  intro_title: string | null; intro_content: string | null;
  survey_config: SurveyConfig | null;
}
interface BeneficiaryOrgRow {
  id: string; portal_id: string;
  org_name: string; contact_name: string | null; contact_phone: string | null;
  pin: string; token: string; status: string;
}

export default function PortalPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<Screen>('loading');
  const [pwr, setPwr] = useState<PortalWithRole | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  // 수혜기관 토큰 진입 시
  const [bOrg, setBOrg] = useState<BeneficiaryOrgRow | null>(null);
  const [bPortal, setBPortal] = useState<PortalRowFull | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) { setScreen('notfound'); return; }

      // 1차 매칭 — project_portals 4종 토큰
      const result = await resolvePortalRole(token);
      if (cancelled) return;
      if (result) {
        // 프로젝트 종료 자동 만료
        if (await isProjectExpired(result.portal.project_id)) {
          if (cancelled) return;
          setScreen('expired'); return;
        }
        // operator 의 경우 안내·설문 정보도 필요 — 별도 SELECT
        const { data: full } = await supabase.from('project_portals')
          .select('intro_title, intro_content, survey_config')
          .eq('id', result.portal.id)
          .maybeSingle();
        if (cancelled) return;
        const enriched = { ...result.portal, ...(full ?? {}) };
        setPwr({ portal: enriched as PortalWithRole['portal'], role: result.role });
        // 역할별 게이트 분기
        if (result.role === 'beneficiary_org') {
          if (isPinAuthed(result.portal.id)) setScreen('ready');
          else setScreen('pin');
        } else if (result.role === 'participant') {
          const authed = getAuthedTeam(result.portal.id);
          if (authed) { setTeam(authed); setScreen('ready'); }
          else setScreen('team');
        } else {
          setScreen('ready');
        }
        return;
      }

      // 2차 매칭 — portal_beneficiary_orgs.token
      const { data: org, error: oErr } = await supabase
        .from('portal_beneficiary_orgs')
        .select('*, project_portals(*)')
        .eq('token', token)
        .maybeSingle();
      if (cancelled) return;
      if (oErr) console.warn('[PortalPublicPage] 2차 매칭 조회 실패:', oErr.message);
      if (!org) { setScreen('notfound'); return; }
      type Joined = BeneficiaryOrgRow & { project_portals: PortalRowFull | PortalRowFull[] | null };
      const j = org as Joined;
      const portalRow = Array.isArray(j.project_portals) ? j.project_portals[0] : j.project_portals;
      if (!portalRow) { setScreen('notfound'); return; }
      if (!portalRow.is_active) { setScreen('expired'); return; }
      if (await isProjectExpired(portalRow.project_id)) {
        if (cancelled) return;
        setScreen('expired'); return;
      }
      setBOrg(j);
      setBPortal(portalRow);
      // 수혜기관 토큰 PIN 인증 상태 — sessionStorage 키 portal_org_auth_{org.id}
      if (sessionStorage.getItem(`portal_org_auth_${j.id}`) === '1') {
        setScreen('ready');
      } else {
        setScreen('beneficiary-pin');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  function handleBeneficiaryPinSuccess() {
    if (bOrg) sessionStorage.setItem(`portal_org_auth_${bOrg.id}`, '1');
    setScreen('ready');
  }

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

  // 1차 매칭 흐름
  if (pwr) {
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
    // 주관기관 — 신규 PortalOperatorView 분기
    if (pwr.role === 'operator') {
      return <PortalOperatorView portal={pwr.portal} />;
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

  // 2차 매칭 흐름 — 수혜기관 토큰
  if (bOrg && bPortal) {
    if (screen === 'beneficiary-pin') {
      return (
        <BeneficiaryOrgPinGate
          orgName={bOrg.org_name}
          orgId={bOrg.id}
          storedPin={bOrg.pin}
          onSuccess={handleBeneficiaryPinSuccess} />
      );
    }
    return (
      <PortalBeneficiaryView
        portal={bPortal}
        org={bOrg}
        onStatusChange={(st) => setBOrg({ ...bOrg, status: st })} />
    );
  }

  return <ErrorScreen emoji="⚠️" title="포털 정보를 불러올 수 없어요" body="잠시 후 다시 시도해 주세요." />;
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

/** 박경수님 2026-05-30 — 수혜기관 토큰 진입 시 PIN 게이트.
 *  portal_beneficiary_orgs.pin 검증. PortalPinGate 와 동일 잠금 정책. */
function BeneficiaryOrgPinGate({
  orgName, orgId, storedPin, onSuccess,
}: { orgName: string; orgId: string; storedPin: string; onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handle() {
    setError(null);
    try {
      verifyBeneficiaryPin(orgId, storedPin, pin);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN 확인 중 오류가 발생했어요.');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-violet-100 shadow-card p-8 space-y-5">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-bold text-[#1E1B4B]">수혜기관 인증</h1>
          <p className="text-sm text-slate-500">{orgName}</p>
          <p className="text-xs text-slate-400">관리자로부터 받은 PIN 을 입력해 주세요.</p>
        </div>
        <input type="password" inputMode="numeric" maxLength={6}
          value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') handle(); }}
          placeholder="4~6자리 숫자"
          className="w-full h-12 rounded-xl border border-slate-200 px-4 text-center text-xl tracking-widest tabular-nums outline-none focus:border-violet-500" />
        {error && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
        )}
        <button type="button" onClick={handle} disabled={pin.length < 4}
          className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50">
          확인
        </button>
        <p className="text-[10px] text-slate-400 text-center">3회 실패 시 60초 잠금이에요.</p>
      </div>
    </div>
  );
}
