// bal24 v2 — 외부공유 대상별 탭 (Stage 3-B-1)
// 단일 audience 영역 — 링크 + QR + 노출 항목 체크박스 + 토큰 재발급.

import { useEffect, useState } from 'react';
import {
  Copy, ExternalLink, QrCode, RefreshCw, ShieldCheck, Loader2, School, Plus,
} from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import { supabase } from '../../../../lib/supabase';
import type {
  ShareAudience, ShareItem, ShareStage, ShareVisibility,
} from '../../../../types/database';
import {
  ITEMS_BY_AUDIENCE, SHARE_AUDIENCE_LABEL, SHARE_ITEM_LABEL,
  SHARE_STAGE_LABEL, STAGE_ITEMS,
} from './visibilityCatalog';
import { buildShareUrl } from './shareUtils';
import QrPreviewModal from './QrPreviewModal';

interface Props {
  audience: ShareAudience;
  token: string;
  programId: string;
  visibility: ShareVisibility;
  currentStage: ShareStage;
  onToggleItem: (item: ShareItem, next: boolean) => Promise<void>;
  onRegenerateToken: () => Promise<void>;
}

const STAGE_GROUPS: ShareStage[] = ['pre', 'ready', 'progress', 'result'];

export default function AudienceTab({
  audience, token, programId, visibility, currentStage, onToggleItem, onRegenerateToken,
}: Props) {
  const toast = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState<ShareItem | null>(null);
  const [regen, setRegen] = useState(false);

  const url = buildShareUrl(audience, token);
  const audienceLabel = SHARE_AUDIENCE_LABEL[audience];
  const allItems = ITEMS_BY_AUDIENCE[audience];

  async function handleCopy() {
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${audienceLabel} 링크 복사 완료`);
    else toast.error('링크 복사에 실패했어요.');
  }

  async function handleToggle(item: ShareItem, next: boolean) {
    setBusy(item);
    try {
      await onToggleItem(item, next);
    } finally {
      setBusy(null);
    }
  }

  async function handleRegenerate() {
    if (!window.confirm('이 토큰을 새로 발급할까요? 기존 링크는 더 이상 동작하지 않아요.')) return;
    setRegen(true);
    try {
      await onRegenerateToken();
      toast.success('토큰을 새로 발급했어요. 새 링크를 다시 공유하세요.');
    } finally {
      setRegen(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 공유 링크 + 액션 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-violet-500" aria-hidden="true" />
          <h3 className="text-sm font-bold text-[#1E1B4B]">공유 링크</h3>
        </header>
        <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2">
          <span className="flex-1 min-w-0 truncate text-xs text-slate-700 tabular-nums">{url}</span>
          <button
            type="button"
            onClick={handleCopy}
            title="링크 복사"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
          >
            <Copy size={13} aria-hidden="true" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            title="새 탭 열기"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
          >
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            title="QR 코드 보기"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-violet-100 text-slate-500 hover:text-violet-700 transition-colors"
          >
            <QrCode size={13} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => void handleRegenerate()}
            disabled={regen}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
          >
            {regen
              ? <Loader2 size={11} className="animate-spin" aria-hidden="true" />
              : <RefreshCw size={11} aria-hidden="true" />}
            토큰 재발급
          </button>
        </div>
      </section>

      {/* 박경수님 2026-06-08 — 기관/학교별 개별 링크 (URL ?org= 방식) */}
      {(audience === 'beneficiary' || audience === 'supporter') && (
        <OrgLinkSection audience={audience} baseUrl={url} programId={programId} />
      )}

      {/* 노출 항목 체크박스 — 단계별 그룹 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#1E1B4B]">노출 항목 ({allItems.length})</h3>
          <p className="text-[11px] text-slate-500">체크 시 외부 페이지에 표시 — 단계별 자동 적용</p>
        </header>

        {allItems.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">
            이 대상은 설정할 항목이 없어요.
          </p>
        ) : (
          STAGE_GROUPS.map((stage) => {
            const stageItems = STAGE_ITEMS[audience][stage];
            if (stageItems.length === 0) return null;
            const isCurrentStage = stage === currentStage;
            return (
              <div key={stage} className="flex flex-col gap-1.5">
                <p className={`text-[11px] font-bold ${
                  isCurrentStage ? 'text-violet-700' : 'text-slate-500'
                }`}>
                  {SHARE_STAGE_LABEL[stage]}
                  {isCurrentStage && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-violet-500 align-middle" aria-hidden="true" />
                  )}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {stageItems.map((item) => {
                    const checked = visibility[audience]?.[item] !== false;
                    const disabled = busy === item;
                    return (
                      <li key={item}>
                        <label
                          className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                            checked
                              ? 'border-violet-200 bg-violet-50/40 hover:bg-violet-50'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          } ${disabled ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => void handleToggle(item, e.target.checked)}
                            className="w-4 h-4 rounded border-violet-200 text-violet-600 focus:ring-violet-300 cursor-pointer"
                          />
                          <span className={`flex-1 text-xs font-semibold ${checked ? 'text-[#1E1B4B]' : 'text-slate-400'}`}>
                            {SHARE_ITEM_LABEL[item]}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>

      <QrPreviewModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        audienceLabel={audienceLabel}
      />
    </div>
  );
}

// ── 기관/학교별 개별 링크 (URL ?org= 방식) ──────────────────────────────────────
// 수혜기관: 사전 등록 동아리의 학교 목록을 자동으로 불러와 학교별 링크 생성.
// 지원기관: 기관명을 직접 입력해 링크 생성.
function OrgLinkSection({ audience, baseUrl, programId }: {
  audience: ShareAudience; baseUrl: string; programId: string;
}) {
  const toast = useToast();
  const [schools, setSchools] = useState<string[]>([]);
  const [loading, setLoading] = useState(audience === 'beneficiary');
  const [customOrg, setCustomOrg] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (audience !== 'beneficiary') return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('program_clubs')
        .select('school_name')
        .eq('program_id', programId)
        .is('deleted_at', null);
      if (cancelled) return;
      if (error) console.error('[OrgLinkSection] 학교 조회 실패:', error.message);
      const unique = [...new Set(((data ?? []) as Array<{ school_name: string | null }>)
        .map((r) => r.school_name ?? '').filter(Boolean))].sort();
      setSchools(unique);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [audience, programId]);

  function linkFor(org: string) {
    return `${baseUrl}?org=${encodeURIComponent(org)}`;
  }

  async function copy(org: string) {
    const ok = await copyToClipboard(linkFor(org));
    if (ok) {
      setCopied(org);
      toast.success(`${org} 링크를 복사했어요.`);
      setTimeout(() => setCopied((p) => (p === org ? null : p)), 2500);
    } else {
      toast.error('복사에 실패했어요.');
    }
  }

  const isSchool = audience === 'beneficiary';

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <School size={16} className="text-cyan-600" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[#1E1B4B]">
          {isSchool ? '학교별 개별 링크' : '기관별 개별 링크'}
        </h3>
        <span className="text-[11px] text-slate-400">접속 시 상단에 이름이 표시돼요</span>
      </header>

      {/* 직접 입력 (기관명/학교명 추가) */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customOrg}
          onChange={(e) => setCustomOrg(e.target.value)}
          placeholder={isSchool ? '학교명 직접 입력' : '기관명 입력 (예: 여수교육지원청)'}
          className="flex-1 h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500"
        />
        <button type="button" onClick={() => customOrg.trim() && void copy(customOrg.trim())}
          disabled={!customOrg.trim()}
          className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
          <Plus size={12} aria-hidden="true" /> 링크 복사
        </button>
      </div>

      {/* 학교 자동 목록 (수혜기관) */}
      {isSchool && (
        loading ? (
          <div className="flex items-center gap-1 text-xs text-slate-400"><Loader2 size={12} className="animate-spin" /> 학교 목록 로딩 중…</div>
        ) : schools.length === 0 ? (
          <p className="text-xs text-slate-400">사전 등록된 동아리가 없어 학교 목록이 비어 있어요. 위에 직접 입력해 주세요.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
            {schools.map((s) => (
              <li key={s} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm font-semibold text-[#1E1B4B] truncate">{s}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => void copy(s)}
                    className={`inline-flex items-center gap-1 px-2 h-7 rounded-md text-[11px] font-bold transition-colors ${
                      copied === s ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                    }`}>
                    <Copy size={11} aria-hidden="true" /> {copied === s ? '복사됨' : '링크 복사'}
                  </button>
                  <a href={linkFor(s)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-violet-700 hover:bg-violet-50">
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
