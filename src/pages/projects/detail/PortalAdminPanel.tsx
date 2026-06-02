// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE 2차 — 관리자 통합 관리 패널.
// 4종 토큰 URL / PIN 설정 / 팀 등록 / 체크리스트 항목 한 화면.
// 박경수님 2026-05-30 STEP-PORTAL-DETAIL-INLINE — slideover 제거, 외부공유 탭 우측 인라인 패널.

import { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw, Plus, Trash2, Loader2, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { ROLE_LABEL, ITEM_TYPE_LABEL, buildPortalUrl, type PortalRole } from '../../portal/portalUtils';
import PortalItemFormModal from '../../portal/PortalItemFormModal';
// 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE — 외부 공유 시스템 3섹션
import PortalIntroSection from './PortalIntroSection';
import PortalBeneficiarySection from './PortalBeneficiarySection';
import PortalSurveyConfigSection, { type SurveyConfig } from './PortalSurveyConfigSection';
// 박경수님 2026-05-30 STEP-PORTAL-BULK-REGISTER — 수혜자 팀 섹션 분리
import PortalTeamSection from './PortalTeamSection';

interface PortalRow {
  id: string;
  title: string;
  operator_token: string | null;
  supporter_token: string | null;
  beneficiary_token: string | null;
  participant_token: string | null;
  beneficiary_pin: string | null;
  // 박경수님 2026-05-30 — 외부 공유 안내·설문
  intro_title: string | null;
  intro_content: string | null;
  survey_config: SurveyConfig | null;
}

interface ItemRow {
  id: string; item_type: string;
  label: string | null; title: string | null;
  description: string | null;
  file_url: string | null;
  visible_roles: string[] | null;
  actionable_roles: string[] | null;
  required: boolean | null;
  sort_order: number | null;
}

interface Props {
  portalId: string;
}

const TOKEN_ROWS: Array<{ key: keyof PortalRow; role: Exclude<PortalRole, 'admin'> }> = [
  { key: 'operator_token',    role: 'operator' },
  { key: 'supporter_token',   role: 'supporter' },
  { key: 'beneficiary_token', role: 'beneficiary_org' },
  { key: 'participant_token', role: 'participant' },
];

export default function PortalAdminPanel({ portalId }: Props) {
  const toast = useToast();
  const [portal, setPortal] = useState<PortalRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinDraft, setPinDraft] = useState('');
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [pRes, iRes] = await Promise.all([
      supabase.from('project_portals')
        .select('id, title, operator_token, supporter_token, beneficiary_token, participant_token, beneficiary_pin, intro_title, intro_content, survey_config')
        .eq('id', portalId).maybeSingle(),
      supabase.from('portal_items').select('id, item_type, label, title, description, file_url, visible_roles, actionable_roles, required, sort_order')
        .eq('portal_id', portalId).order('sort_order'),
    ]);
    if (pRes.error) console.error('[PortalAdmin] portal fetch:', pRes.error.message);
    if (iRes.error) console.error('[PortalAdmin] items fetch:', iRes.error.message);
    setPortal(pRes.data as PortalRow | null);
    setItems((iRes.data ?? []) as ItemRow[]);
    setPinDraft((pRes.data?.beneficiary_pin as string | null) ?? '');
    setLoading(false);
  }, [portalId]);

  useEffect(() => { void reload(); }, [reload]);

  async function copyTokenUrl(token: string | null, label: string) {
    if (!token) { toast.error('토큰이 아직 발급되지 않았어요.'); return; }
    const ok = await copyToClipboard(buildPortalUrl(token));
    if (ok) toast.success(`${label} 링크 복사 완료`);
    else toast.error('복사 실패. 직접 선택해 복사해 주세요.');
  }

  async function regenerateToken(field: keyof PortalRow) {
    if (!window.confirm('기존 링크가 사용 불가능해져요. 정말 재발급할까요?')) return;
    const { error } = await supabase
      .from('project_portals')
      .update({ [field]: crypto.randomUUID() })
      .eq('id', portalId);
    if (error) { console.error('[PortalAdmin] 토큰 재발급:', error.message); toast.error('재발급 실패'); return; }
    toast.success('새 토큰을 발급했어요.');
    void reload();
  }

  async function savePin() {
    const pin = pinDraft.trim();
    if (pin && (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin))) {
      toast.error('PIN 은 4~6자리 숫자만 가능해요.'); return;
    }
    const { error } = await supabase
      .from('project_portals')
      .update({ beneficiary_pin: pin || null })
      .eq('id', portalId);
    if (error) { console.error('[PortalAdmin] PIN 저장:', error.message); toast.error('PIN 저장 실패'); return; }
    toast.success(pin ? 'PIN 을 저장했어요.' : 'PIN 을 비활성화했어요.');
    void reload();
  }

  async function removeItem(id: string, label: string) {
    if (!window.confirm(`"${label}" 항목을 삭제할까요?`)) return;
    const { error } = await supabase.from('portal_items').delete().eq('id', id);
    if (error) { toast.error('삭제 실패'); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  if (loading || !portal) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-white shadow-card">
      <header className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-center justify-between rounded-t-2xl z-10">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#1E1B4B] truncate">{portal.title}</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">포털 자세히</p>
        </div>
      </header>

      <div className="p-5 space-y-6">
          {/* 1) 4종 토큰 */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-[#1E1B4B]">🔗 역할별 외부 링크</h3>
            <div className="space-y-2">
              {TOKEN_ROWS.map(({ key, role }) => {
                const token = portal[key] as string | null;
                return (
                  <div key={key} className="flex items-center gap-2 p-3 rounded-lg border border-violet-100 bg-violet-50/30">
                    <span className="text-xs font-bold text-violet-700 w-28 shrink-0">{ROLE_LABEL[role]}</span>
                    <code className="flex-1 text-[11px] text-slate-500 truncate font-mono">{token ?? '미발급'}</code>
                    <button type="button" onClick={() => void copyTokenUrl(token, ROLE_LABEL[role])}
                      className="p-1.5 rounded hover:bg-white text-violet-700" title="URL 복사">
                      <Copy size={13} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => void regenerateToken(key)}
                      className="p-1.5 rounded hover:bg-white text-amber-600" title="재발급">
                      <RefreshCw size={13} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2) PIN */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-[#1E1B4B]">🔐 수혜기관 PIN</h3>
            <div className="flex items-center gap-2">
              <input type="text" inputMode="numeric" maxLength={6}
                value={pinDraft} onChange={(e) => setPinDraft(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="4~6자리 숫자 (비우면 PIN 미사용)"
                className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
              <button type="button" onClick={() => void savePin()}
                className="px-4 h-10 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
                저장
              </button>
            </div>
            <p className="text-[11px] text-slate-400">수혜기관 링크 접속 시 PIN 입력 요구. 비우면 토큰만으로 통과.</p>
          </section>

          {/* 3) 팀 — PortalTeamSection 으로 분리 (일괄 등록 포함) */}
          <PortalTeamSection portalId={portalId} />

          {/* 4) 체크리스트 항목 */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1E1B4B]">📋 체크리스트 항목 ({items.length})</h3>
              <button type="button" onClick={() => { setEditingItem(null); setItemModalOpen(true); }}
                className="px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 inline-flex items-center gap-1">
                <Plus size={12} aria-hidden="true" /> 항목 추가
              </button>
            </div>
            <div className="space-y-1">
              {items.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-4">아직 항목이 없어요.</p>
              ) : items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50">
                  <FileText size={12} className="text-slate-400" aria-hidden="true" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                    {ITEM_TYPE_LABEL[it.item_type] ?? it.item_type}
                  </span>
                  <button type="button" onClick={() => { setEditingItem(it); setItemModalOpen(true); }}
                    className="flex-1 text-left text-sm text-slate-700 hover:text-violet-700 truncate">
                    {it.title ?? it.label ?? '(제목 없음)'}
                  </button>
                  <button type="button" onClick={() => void removeItem(it.id, it.title ?? it.label ?? '항목')}
                    className="p-1 rounded hover:bg-rose-50 text-rose-500" aria-label="삭제">
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE — 외부 공유 시스템 3섹션 */}
          <div className="border-t border-slate-100 pt-6 mt-2 space-y-6">
            <div className="text-[10px] font-bold tracking-widest uppercase text-slate-400">
              외부 공유 시스템 (수혜기관 신청 흐름)
            </div>
            <PortalIntroSection
              portalId={portalId}
              introTitle={portal.intro_title ?? ''}
              introContent={portal.intro_content ?? ''}
              onSaved={reload}
            />
            <PortalBeneficiarySection portalId={portalId} />
            <PortalSurveyConfigSection
              portalId={portalId}
              surveyConfig={portal.survey_config ?? {}}
              onSaved={reload}
            />
          </div>
        </div>

      {itemModalOpen && (
        <PortalItemFormModal
          portalId={portalId}
          item={editingItem}
          onClose={() => { setItemModalOpen(false); setEditingItem(null); }}
          onSaved={() => { setItemModalOpen(false); setEditingItem(null); void reload(); }}
        />
      )}
    </div>
  );
}
