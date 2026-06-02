// 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE — 수혜기관 등록·토큰·PIN 발급 섹션.
// portal_beneficiary_orgs 행별 token + 4자리 PIN. 5단계 토큰과 별개 레벨.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Copy, Trash2, RefreshCw, Upload } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import PortalBeneficiaryBulkModal from './PortalBeneficiaryBulkModal';

interface OrgRow {
  id: string;
  org_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  pin: string;
  token: string;
  status: string;
  created_at: string;
}

interface Props {
  portalId: string;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '대기',     cls: 'bg-slate-100 text-slate-600' },
  submitted: { label: '제출완료', cls: 'bg-emerald-100 text-emerald-700' },
  confirmed: { label: '확정',     cls: 'bg-violet-100 text-violet-700' },
};

function genPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export default function PortalBeneficiarySection({ portalId }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrg, setNewOrg] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPin, setNewPin] = useState(genPin());
  const [bulkOpen, setBulkOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('portal_beneficiary_orgs')
      .select('*')
      .eq('portal_id', portalId)
      .order('created_at');
    if (error) console.error('[PortalBeneficiarySection] fetch:', error.message);
    setRows((data ?? []) as OrgRow[]);
    setLoading(false);
  }, [portalId]);

  useEffect(() => { void reload(); }, [reload]);

  async function addOrg() {
    const org = newOrg.trim();
    const pin = newPin.trim();
    if (!org) { toast.error('기관명을 입력해 주세요.'); return; }
    if (!/^\d{4,6}$/.test(pin)) { toast.error('PIN 은 4~6자리 숫자만 가능해요.'); return; }
    const { error } = await supabase.from('portal_beneficiary_orgs').insert({
      portal_id: portalId, org_name: org,
      contact_name: newName.trim() || null,
      contact_phone: newPhone.trim() || null,
      pin,
    });
    if (error) {
      console.error('[PortalBeneficiarySection] 추가 실패:', error.message);
      toast.error('등록 실패');
      return;
    }
    toast.success('수혜기관을 등록했어요.');
    setNewOrg(''); setNewName(''); setNewPhone(''); setNewPin(genPin());
    void reload();
  }

  async function removeOrg(id: string, name: string) {
    if (!window.confirm(`"${name}" 수혜기관을 삭제할까요? 해당 토큰·PIN·신청 응답이 모두 사라져요.`)) return;
    const { error } = await supabase.from('portal_beneficiary_orgs').delete().eq('id', id);
    if (error) { toast.error('삭제 실패'); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  async function regenToken(id: string) {
    if (!window.confirm('기존 링크가 사용 불가능해져요. 정말 재발급할까요?')) return;
    const { error } = await supabase
      .from('portal_beneficiary_orgs')
      .update({ token: crypto.randomUUID() })
      .eq('id', id);
    if (error) { toast.error('재발급 실패'); return; }
    toast.success('새 토큰을 발급했어요.');
    void reload();
  }

  async function copyOrgUrl(token: string, name: string) {
    const url = `${window.location.origin}/portal/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${name} 수혜기관 링크 복사 완료`);
    else toast.error('복사 실패');
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[#1E1B4B]">🏢 수혜기관 등록 ({rows.length})</h3>
        <button type="button" onClick={() => setBulkOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-violet-200 text-violet-700 text-xs font-bold hover:bg-violet-50">
          <Upload size={12} aria-hidden="true" /> 일괄 등록
        </button>
      </div>

      {/* 등록 폼 */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2">
        <p className="text-[11px] font-bold text-violet-700">+ 새 수혜기관 추가</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="text" value={newOrg} onChange={(e) => setNewOrg(e.target.value)}
            placeholder="기관명 *"
            className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-violet-500" />
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="담당자명"
            className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-violet-500" />
          <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
            placeholder="연락처"
            className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-violet-500" />
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" maxLength={6} value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="PIN 4~6자리"
              className="flex-1 h-9 rounded-lg border border-slate-200 px-2.5 text-sm tabular-nums outline-none focus:border-violet-500" />
            <button type="button" onClick={() => setNewPin(genPin())}
              title="자동 생성" className="px-2 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs">
              자동
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={() => void addOrg()}
            className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
            <Plus size={12} aria-hidden="true" /> 추가
          </button>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={18} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">아직 등록된 수혜기관이 없어요.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending;
            return (
              <div key={r.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#1E1B4B] truncate">{r.org_name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.label}</span>
                    <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">PIN {r.pin}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {r.contact_name || '담당자 미지정'}{r.contact_phone ? ` · ${r.contact_phone}` : ''}
                  </div>
                </div>
                <button type="button" onClick={() => void copyOrgUrl(r.token, r.org_name)}
                  title="링크 복사" className="p-1.5 rounded hover:bg-white text-violet-700">
                  <Copy size={13} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => void regenToken(r.id)}
                  title="토큰 재발급" className="p-1.5 rounded hover:bg-white text-amber-600">
                  <RefreshCw size={13} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => void removeOrg(r.id, r.org_name)}
                  title="삭제" className="p-1.5 rounded hover:bg-rose-50 text-rose-500">
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PortalBeneficiaryBulkModal
        portalId={portalId}
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => { void reload(); }}
      />
    </section>
  );
}
