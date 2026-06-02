// 박경수님 2026-05-30 STEP-PORTAL-BULK-REGISTER — 수혜기관 일괄 등록 모달.
// 엑셀 붙여넣기 (탭/쉼표 구분) → 파싱 → 미리보기 → 일괄 INSERT.

import { useMemo, useRef, useState } from 'react';
import { Loader2, X, Upload } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { generatePin, generateToken } from '../../../lib/portalTokens';

interface ParsedOrg {
  org_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  token: string;
  pin: string;
  valid: boolean;
  error?: string;
}

interface Props {
  portalId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** 엑셀 행 파싱 — 4열 (기관명·담당자명·이메일·연락처) 지원, 탭/쉼표 구분. */
function parseRows(raw: string): ParsedOrg[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const cols = line.split(/[\t,]/).map((c) => c.trim());
      const org = cols[0] ?? '';
      const valid = org.length > 0;
      return {
        org_name: org,
        contact_name: cols[1] ?? '',
        contact_email: cols[2] ?? '',
        contact_phone: cols[3] ?? '',
        token: generateToken(),
        pin: generatePin(),
        valid,
        error: valid ? undefined : '기관명 필수',
      };
    });
}

export default function PortalBeneficiaryBulkModal({ portalId, isOpen, onClose, onSuccess }: Props) {
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mouseDownOnBackdropRef = useRef(false);

  const parsed = useMemo(() => raw.trim() ? parseRows(raw) : [], [raw]);
  const validCount = parsed.filter((p) => p.valid).length;
  const invalidCount = parsed.length - validCount;

  async function handleSubmit() {
    const validRows = parsed.filter((p) => p.valid);
    if (validRows.length === 0) { toast.error('유효한 행이 없어요.'); return; }
    setSubmitting(true);
    const payload = validRows.map((r) => ({
      portal_id: portalId,
      org_name: r.org_name,
      contact_name: r.contact_name || null,
      contact_email: r.contact_email || null,
      contact_phone: r.contact_phone || null,
      pin: r.pin,
      token: r.token,
      status: 'pending',
    }));
    const { error } = await supabase.from('portal_beneficiary_orgs').insert(payload);
    setSubmitting(false);
    if (error) {
      console.error('[PortalBeneficiaryBulkModal] 일괄 INSERT 실패:', error.message);
      toast.error('등록 중 오류가 발생했어요.');
      return;
    }
    toast.success(`${validRows.length}개 기관을 등록했어요.`);
    setRaw('');
    onSuccess();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => { mouseDownOnBackdropRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
            <Upload size={16} aria-hidden="true" /> 수혜기관 일괄 등록
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="p-1 rounded hover:bg-slate-100"><X size={16} aria-hidden="true" /></button>
        </header>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
            엑셀에서 <strong>기관명·담당자명·이메일·연락처</strong> 열을 선택해 복사 (Ctrl+C) 한 뒤 아래에 붙여넣기 (Ctrl+V) 하세요.
            각 열은 탭 또는 쉼표로 구분돼요. 한 줄에 1개 기관.
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 font-mono text-[11px] text-violet-800 leading-snug whitespace-pre">
{`기관명         담당자명   이메일               연락처
한국대학교      김철수    kim@uni.ac.kr        010-1234-5678
미래연구소      이영희    lee@future.kr        010-9876-5432`}
          </div>

          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={8}
            placeholder="여기에 붙여넣기 (Ctrl+V)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />

          {parsed.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 w-8">#</th>
                    <th className="text-left px-2 py-1.5">기관명</th>
                    <th className="text-left px-2 py-1.5">담당자</th>
                    <th className="text-left px-2 py-1.5">이메일</th>
                    <th className="text-left px-2 py-1.5">연락처</th>
                    <th className="text-left px-2 py-1.5">PIN</th>
                    <th className="text-center px-2 py-1.5">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.map((p, i) => (
                    <tr key={i} className={p.valid ? '' : 'bg-rose-50'}>
                      <td className="px-2 py-1 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1 font-semibold text-slate-700">{p.org_name || '-'}</td>
                      <td className="px-2 py-1 text-slate-600">{p.contact_name || '-'}</td>
                      <td className="px-2 py-1 text-slate-600 truncate max-w-[140px]">{p.contact_email || '-'}</td>
                      <td className="px-2 py-1 text-slate-600">{p.contact_phone || '-'}</td>
                      <td className="px-2 py-1 font-mono tabular-nums text-amber-700">{p.pin}</td>
                      <td className="px-2 py-1 text-center">
                        {p.valid ? (
                          <span className="text-[10px] font-bold text-emerald-700">유효</span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-600" title={p.error}>오류</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parsed.length > 0 && (
            <p className="text-xs text-slate-500 text-right">
              총 <strong>{parsed.length}</strong>행 — 유효 <strong className="text-violet-700">{validCount}</strong>건
              {invalidCount > 0 && <> · 오류 <strong className="text-rose-600">{invalidCount}</strong>건 (등록 제외)</>}
            </p>
          )}
        </div>

        <footer className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-4 h-10 rounded-lg text-sm text-slate-600 hover:bg-slate-100">취소</button>
          <button type="button" onClick={() => void handleSubmit()}
            disabled={submitting || validCount === 0}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {submitting ? (
              <><Loader2 size={14} className="animate-spin" /> 등록 중…</>
            ) : (
              <>{validCount}건 일괄 등록</>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
