// 박경수님 2026-05-30 STEP-PORTAL-BULK-REGISTER — 수혜자 팀 일괄 등록 모달.
// 엑셀 붙여넣기 → 팀코드·팀명 파싱 → 배치 내 중복 검출 → 일괄 INSERT.

import { useMemo, useRef, useState } from 'react';
import { Loader2, X, Upload } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

interface ParsedTeam {
  team_code: string;
  team_name: string;
  valid: boolean;
  error?: string;
}

interface Props {
  portalId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/** 엑셀 행 파싱 — 2열 (팀코드·팀명) 탭/쉼표 구분. 배치 내 팀코드 중복 검출. */
function parseRows(raw: string): ParsedTeam[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const seen = new Set<string>();
  return lines.map((line) => {
    const cols = line.split(/[\t,]/).map((c) => c.trim());
    const code = (cols[0] ?? '').toUpperCase();
    const name = cols[1] ?? '';
    if (!code) return { team_code: code, team_name: name, valid: false, error: '팀코드 필수' };
    if (!name) return { team_code: code, team_name: name, valid: false, error: '팀명 필수' };
    if (seen.has(code)) return { team_code: code, team_name: name, valid: false, error: '중복 팀코드' };
    seen.add(code);
    return { team_code: code, team_name: name, valid: true };
  });
}

export default function PortalTeamBulkModal({ portalId, isOpen, onClose, onSuccess }: Props) {
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
      team_code: r.team_code,
      team_name: r.team_name,
    }));
    const { error } = await supabase.from('portal_teams').insert(payload);
    setSubmitting(false);
    if (error) {
      console.error('[PortalTeamBulkModal] 일괄 INSERT:', error.message);
      toast.error(error.message.includes('duplicate') ? '이미 등록된 팀코드가 포함돼 있어요.' : '등록 중 오류가 발생했어요.');
      return;
    }
    toast.success(`${validRows.length}개 팀을 등록했어요.`);
    setRaw('');
    onSuccess();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => { mouseDownOnBackdropRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
            <Upload size={16} aria-hidden="true" /> 수혜자 팀 일괄 등록
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="p-1 rounded hover:bg-slate-100"><X size={16} aria-hidden="true" /></button>
        </header>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
            엑셀에서 <strong>팀코드·팀명</strong> 2개 열을 선택해 복사 (Ctrl+C) 한 뒤 아래에 붙여넣기 (Ctrl+V) 하세요.
            팀코드는 자동으로 대문자 변환돼요. 배치 내 같은 팀코드가 있으면 오류로 표시돼요.
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 font-mono text-[11px] text-violet-800 leading-snug whitespace-pre">
{`팀코드    팀명
A         1조
B         2조
C         3조`}
          </div>

          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6}
            placeholder="여기에 붙여넣기 (Ctrl+V)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />

          {parsed.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 w-8">#</th>
                    <th className="text-left px-2 py-1.5">팀코드</th>
                    <th className="text-left px-2 py-1.5">팀명</th>
                    <th className="text-center px-2 py-1.5 w-24">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.map((p, i) => (
                    <tr key={i} className={p.valid ? '' : 'bg-rose-50'}>
                      <td className="px-2 py-1 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1 font-mono font-bold text-slate-700">{p.team_code || '-'}</td>
                      <td className="px-2 py-1 text-slate-700">{p.team_name || '-'}</td>
                      <td className="px-2 py-1 text-center">
                        {p.valid ? (
                          <span className="text-[10px] font-bold text-emerald-700">유효</span>
                        ) : (
                          <span className="text-[10px] font-bold text-rose-600" title={p.error}>{p.error}</span>
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
