// 박경수님 2026-06-02 CLUB-2 — 동아리 엑셀 일괄 등록 모달.
// 박경수님 2026-06-08 — 두 가지 붙여넣기 형식 자동 감지
//   [A형] 기존 13열: 학교명·지도교사·휴대전화·일반전화·멘토명·멘토연락처·동아리명·학생수·유형·운영비·재료비·기타·운영방법
//   [B형] 스프레드시트: 연번·학교급·학교명·분야·팀명·참여인원·지도교사·연락처·(기타)

import { useMemo, useRef, useState } from 'react';
import { Loader2, X, Upload } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';

interface ParsedClub {
  school_name: string;
  teacher_name: string;
  teacher_phone: string;
  school_phone: string;
  mentor_name: string;
  mentor_phone: string;
  club_name: string;
  student_count: number | null;
  club_type: string;
  operating_budget: number | null;
  material_budget: number | null;
  etc_budget: number | null;
  operating_method: string;
  valid: boolean;
  error?: string;
}

interface Props {
  programId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

/** 첫 번째 셀이 숫자(연번)이면 B형 (박경수님 스프레드시트 형식) */
function detectFormat(firstCell: string): 'A' | 'B' {
  const trimmed = firstCell.trim();
  return /^\d+$/.test(trimmed) ? 'B' : 'A';
}

/**
 * [B형] 연번·학교급·학교명·분야·팀명·참여인원·지도교사·연락처·(초기아이디어)·(구호)
 * 학교명 = 학교급(c[1]) + 학교명(c[2]) 합치기
 */
function parseRowB(c: string[]): ParsedClub {
  // 학교급(중학교/고등학교)과 학교명(나주상고) 합치기
  const schoolLevel = (c[1] ?? '').trim();
  const schoolName  = (c[2] ?? '').trim();
  // 이미 합쳐진 경우(학교명에 "교" 포함) 중복 방지
  const school = schoolName
    ? schoolName.endsWith('교') || !schoolLevel
      ? schoolName
      : `${schoolName}`   // 짧은 학교명만 사용 (나주상고, 금성중 등)
    : schoolLevel;

  const club = (c[4] ?? '').trim();
  const valid = school.length > 0 && club.length > 0;
  return {
    school_name: school,
    teacher_name: (c[6] ?? '').trim(),
    teacher_phone: (c[7] ?? '').trim(),
    school_phone: '',
    mentor_name: '',
    mentor_phone: '',
    club_name: club,
    student_count: num(c[5]),
    club_type: (c[3] ?? '').trim(),
    operating_budget: null,
    material_budget: null,
    etc_budget: null,
    operating_method: (c[8] ?? '').trim(),  // 초기아이디어 → 운영방법으로 활용
    valid,
    error: valid ? undefined : '학교명·팀명 필수',
  };
}

/**
 * [A형] 학교명·지도교사·휴대전화·일반전화·멘토명·멘토연락처·동아리명·학생수·유형·운영비·재료비·기타·운영방법
 */
function parseRowA(c: string[]): ParsedClub {
  const school = (c[0] ?? '').trim();
  const club   = (c[6] ?? '').trim();
  const valid  = school.length > 0 && club.length > 0;
  return {
    school_name: school,
    teacher_name: (c[1] ?? '').trim(),
    teacher_phone: (c[2] ?? '').trim(),
    school_phone: (c[3] ?? '').trim(),
    mentor_name: (c[4] ?? '').trim(),
    mentor_phone: (c[5] ?? '').trim(),
    club_name: club,
    student_count: num(c[7]),
    club_type: (c[8] ?? '').trim(),
    operating_budget: num(c[9]),
    material_budget: num(c[10]),
    etc_budget: num(c[11]),
    operating_method: (c[12] ?? '').trim(),
    valid,
    error: valid ? undefined : '학교명·동아리명 필수',
  };
}

function parseRows(raw: string): ParsedClub[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const firstCols = lines[0].split(/\t/).map((x) => x.trim());
  const fmt = detectFormat(firstCols[0] ?? '');

  return lines.map((line) => {
    const c = line.split(/\t/).map((x) => x.trim());
    return fmt === 'B' ? parseRowB(c) : parseRowA(c);
  });
}

export default function ClubBulkModal({ programId, isOpen, onClose, onSuccess }: Props) {
  const toast = useToast();
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mouseDownRef = useRef(false);

  const parsed = useMemo(() => raw.trim() ? parseRows(raw) : [], [raw]);
  const validCount   = parsed.filter((p) => p.valid).length;
  const invalidCount = parsed.length - validCount;

  // 자동 감지된 형식
  const detectedFmt = useMemo(() => {
    if (!raw.trim()) return null;
    const firstLine = raw.trim().split(/\r?\n/)[0] ?? '';
    const firstCell = firstLine.split(/\t/)[0] ?? '';
    return detectFormat(firstCell);
  }, [raw]);

  async function handleSubmit() {
    const rows = parsed.filter((p) => p.valid);
    if (rows.length === 0) { toast.error('유효한 행이 없어요.'); return; }
    setSubmitting(true);
    const payload = rows.map((r) => ({
      program_id: programId,
      school_name: r.school_name,
      club_name: r.club_name,
      teacher_name: r.teacher_name || null,
      teacher_phone: r.teacher_phone || null,
      school_phone: r.school_phone || null,
      mentor_name: r.mentor_name || null,
      mentor_phone: r.mentor_phone || null,
      student_count: r.student_count,
      club_type: r.club_type || null,
      operating_budget: r.operating_budget,
      material_budget: r.material_budget,
      etc_budget: r.etc_budget,
      operating_method: r.operating_method || null,
    }));
    const { error } = await supabase.from('program_clubs').insert(payload);
    setSubmitting(false);
    if (error) {
      console.error('[ClubBulkModal] 일괄 INSERT:', error.message);
      toast.error('등록 중 오류가 발생했어요.');
      return;
    }
    toast.success(`${rows.length}개 동아리를 등록했어요.`);
    setRaw('');
    onSuccess();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => { mouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownRef.current && e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl max-h-[90vh] flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
            <Upload size={16} aria-hidden="true" /> 동아리 일괄 등록
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded hover:bg-slate-100"><X size={16} /></button>
        </header>

        <div className="p-5 space-y-3 overflow-y-auto">
          {/* 안내 */}
          <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 text-xs text-slate-600 leading-relaxed">
            <p><strong className="text-violet-700">[형식 A]</strong> 학교명·지도교사·휴대전화·일반전화·멘토명·멘토연락처·<strong>동아리명</strong>·학생수·유형·운영비·재료비·기타·운영방법</p>
            <p><strong className="text-violet-700">[형식 B]</strong> <strong>연번</strong>·학교급·학교명·분야·<strong>팀명</strong>·참여인원·지도교사·연락처·(기타…) — <em>첫 열이 숫자면 자동 감지</em></p>
            <p className="text-slate-400">엑셀에서 해당 열을 선택 후 복사(Ctrl+C) → 아래에 붙여넣기(Ctrl+V). 한 줄에 1개 동아리.</p>
          </div>

          {/* 형식 감지 뱃지 */}
          {detectedFmt && (
            <p className="text-[11px] font-bold">
              자동 감지: <span className={`px-1.5 py-0.5 rounded ${detectedFmt === 'B' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}`}>
                {detectedFmt === 'B' ? '형식 B (연번·학교급·학교명·팀명…)' : '형식 A (학교명·동아리명 13열)'}
              </span>
            </p>
          )}

          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6}
            placeholder="여기에 붙여넣기 (Ctrl+V)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />

          {parsed.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">연번</th>
                    <th className="px-2 py-1.5 text-left">학교</th>
                    <th className="px-2 py-1.5 text-left">동아리</th>
                    <th className="px-2 py-1.5 text-left">지도교사</th>
                    <th className="px-2 py-1.5 text-left">멘토</th>
                    <th className="px-2 py-1.5 text-center">학생</th>
                    <th className="px-2 py-1.5 text-center">유형</th>
                    <th className="px-2 py-1.5 text-right">운영비</th>
                    <th className="px-2 py-1.5 text-center">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.map((p, i) => (
                    <tr key={i} className={p.valid ? '' : 'bg-rose-50'}>
                      <td className="px-2 py-1 text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-2 py-1 font-semibold text-slate-700">{p.school_name || '-'}</td>
                      <td className="px-2 py-1 text-slate-700">{p.club_name || '-'}</td>
                      <td className="px-2 py-1 text-slate-600">{p.teacher_name || '-'}</td>
                      <td className="px-2 py-1 text-slate-600">{p.mentor_name || '-'}</td>
                      <td className="px-2 py-1 text-center tabular-nums">{p.student_count ?? '-'}</td>
                      <td className="px-2 py-1 text-center">{p.club_type || '-'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{p.operating_budget ?? '-'}</td>
                      <td className="px-2 py-1 text-center">
                        {p.valid
                          ? <span className="text-[10px] font-bold text-emerald-700">유효</span>
                          : <span className="text-[10px] font-bold text-rose-600" title={p.error}>오류</span>}
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
              {invalidCount > 0 && <> · 오류 <strong className="text-rose-600">{invalidCount}</strong>건 (제외)</>}
            </p>
          )}
        </div>

        <footer className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 h-10 rounded-lg text-sm text-slate-600 hover:bg-slate-100">취소</button>
          <button type="button" onClick={() => void handleSubmit()} disabled={submitting || validCount === 0}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {submitting ? <><Loader2 size={14} className="animate-spin" /> 등록 중…</> : <>{validCount}건 일괄 등록</>}
          </button>
        </footer>
      </div>
    </div>
  );
}
