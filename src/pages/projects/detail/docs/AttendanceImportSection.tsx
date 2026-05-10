// bal24 v2 — 출석부 파일 → 파싱·매칭·attendance_records 일괄 등록

import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Loader2, Upload, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { fileToText, classifyFile } from '../../../../lib/fileToText';
import { callAi, callAiWithFile } from '../../../../lib/aiClient';
import type { Program, ProgramParticipant } from '../../../../types/database';

interface Props {
  projectId: string;
}

interface SessionOption { id: string; title: string; program_id: string; }

interface ParsedRow {
  name: string;
  date: string | null;
  status: 'present' | 'late' | 'absent';
  matchedId?: string | null;
}

const SYSTEM_PROMPT = `출석부 문서에서 참석자 명단을 JSON 배열로만 반환합니다.
각 항목. name(이름 필수), date(YYYY-MM-DD 또는 null), status('present'·'late'·'absent').
없는 항목=null. 추측 금지. JSON 배열만 반환. 최대 200명.`;

function safeParse(raw: string): Omit<ParsedRow, 'matchedId'>[] {
  const c = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try { const r = JSON.parse(c); return Array.isArray(r) ? r : []; }
  catch { const i = c.indexOf('['); return i >= 0 ? safeParse(c.slice(i)) : []; }
}

function normalizeStatus(v: unknown): 'present' | 'late' | 'absent' {
  const s = String(v ?? '').toLowerCase().trim();
  if (s === 'late' || s.includes('지각') || s === '△') return 'late';
  if (s === 'absent' || s.includes('결석') || s === 'x' || s === '×') return 'absent';
  return 'present';
}

function parseExcel(file: File): Promise<Omit<ParsedRow, 'matchedId'>[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    return rows.map((r) => {
      const name = String(r['이름'] ?? r['성명'] ?? r['name'] ?? '').trim();
      const dateRaw = r['날짜'] ?? r['date'] ?? null;
      const status = normalizeStatus(r['출석'] ?? r['status'] ?? r['상태']);
      const date = dateRaw ? String(dateRaw).slice(0, 10) : null;
      return { name, date, status };
    }).filter((r) => r.name);
  });
}

export default function AttendanceImportSection({ projectId }: Props) {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [participants, setParticipants] = useState<ProgramParticipant[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reloadRefs = useCallback(async () => {
    const [progRes, sessRes, partRes] = await Promise.all([
      supabase.from('programs').select('id').eq('project_id', projectId),
      supabase.from('attendance_sessions').select('id, title, program_id, programs!inner(project_id)').order('session_date', { ascending: false }),
      supabase.from('program_participants').select('*').order('name'),
    ]);
    if (progRes.error) console.error('[attendance-import] programs 조회 실패:', progRes.error.message);
    const programIds = new Set(((progRes.data ?? []) as Pick<Program, 'id'>[]).map((p) => p.id));
    if (sessRes.error) console.error('[attendance-import] sessions 조회 실패:', sessRes.error.message);
    const filtered = ((sessRes.data ?? []) as Array<{ id: string; title: string; program_id: string }>)
      .filter((s) => programIds.has(s.program_id));
    setSessions(filtered);
    if (partRes.error) console.error('[attendance-import] participants 조회 실패:', partRes.error.message);
    setParticipants((partRes.data ?? []) as ProgramParticipant[]);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => { await reloadRefs(); if (cancelled) return; })();
    return () => { cancelled = true; };
  }, [reloadRefs, projectId]);

  function matchRows(parsed: Omit<ParsedRow, 'matchedId'>[]): ParsedRow[] {
    const byName = new Map<string, string>();
    for (const p of participants) byName.set(p.name.trim(), p.id);
    return parsed.map((r) => ({ ...r, matchedId: byName.get(r.name.trim()) ?? null }));
  }

  async function handleParse() {
    if (!file) return;
    setParsing(true);
    try {
      const kind = classifyFile(file);
      let parsed: Omit<ParsedRow, 'matchedId'>[] = [];
      if (kind === 'xlsx' || kind === 'csv') {
        parsed = await parseExcel(file);
      } else if (kind === 'unknown') {
        const r = await callAiWithFile(file, '출석부 명단을 JSON 배열로 반환해 주세요.', 'curriculum-extract',
          { systemOverride: SYSTEM_PROMPT, maxTokens: 4096 });
        parsed = r.ok ? safeParse(r.text ?? '').map((x) => ({ name: x.name, date: x.date ?? null, status: normalizeStatus(x.status) })) : [];
      } else {
        const doc = await fileToText(file);
        if (doc?.text) {
          const r = await callAi({ preset: 'curriculum-extract', systemOverride: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: doc.text.slice(0, 5000) }], maxTokens: 4096 });
          parsed = r.ok ? safeParse(r.text ?? '').map((x) => ({ name: x.name, date: x.date ?? null, status: normalizeStatus(x.status) })) : [];
        }
      }
      const matched = matchRows(parsed.filter((r) => r.name?.trim()));
      if (matched.length === 0) { toast.error('명단을 추출하지 못했어요.'); setRows([]); return; }
      setRows(matched);
      toast.success(`${matched.length}명을 추출했어요. 매칭 확인 후 등록해 주세요.`);
    } catch (err) {
      const r = err instanceof Error ? err.message : '';
      console.error('[attendance-import] 파싱 실패:', r);
      toast.error('파싱 중 오류가 발생했어요.');
    } finally {
      setParsing(false);
    }
  }

  function patchRow(idx: number, patch: Partial<ParsedRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function handleSubmit() {
    if (!sessionId) { toast.error('출석 세션을 먼저 선택해 주세요.'); return; }
    const targets = rows.filter((r) => r.name.trim());
    if (targets.length === 0) return;
    setSubmitting(true);
    try {
      const payload = targets.map((r) => ({
        session_id: sessionId,
        attendee_role: 'student' as const,
        attendee_name: r.name.trim(),
        check_in_at: new Date().toISOString(),
        check_in_method: 'manual' as const,
        status: r.status === 'present' ? 'O' : r.status === 'late' ? '△' : 'X',
        form_application_id: r.matchedId ?? null,
      }));
      const { error } = await supabase.from('attendance_records').insert(payload);
      if (error) throw error;
      toast.success(`${payload.length}명 출석 등록 완료.`);
      setRows([]);
      setFile(null);
    } catch (err) {
      const r = err instanceof Error ? err.message : '';
      console.error('[attendance-import] 등록 실패:', r);
      toast.error('출석 등록 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-violet-50 border border-violet-200 p-4 space-y-2">
        <p className="text-sm font-bold text-violet-800">출석부 파일 업로드</p>
        <p className="text-[11px] text-violet-700/80">Excel(.xlsx/.csv)은 직접 파싱, PDF/이미지는 AI 추출.</p>
        <input ref={inputRef} type="file" hidden accept=".xlsx,.csv,.pdf,.png,.jpg,.jpeg,.docx,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<Upload size={12} />} onClick={() => inputRef.current?.click()} disabled={parsing}>
            파일 선택
          </Button>
          {file && <span className="text-[11px] text-violet-700 truncate max-w-[260px]" title={file.name}>{file.name}</span>}
          <Button variant="primary" size="sm" leftIcon={parsing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            onClick={() => void handleParse()} disabled={!file || parsing}>
            {parsing ? '파싱 중…' : '파싱하기'}
          </Button>
        </div>
      </section>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">출석 세션</label>
              <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-violet-400">
                <option value="">선택해 주세요</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <Button variant="primary" size="sm" loading={submitting} onClick={() => void handleSubmit()} disabled={!sessionId || rows.length === 0}>
              {rows.length}명 등록하기
            </Button>
          </div>

          <ul className="rounded-lg border border-slate-200 bg-white max-h-[400px] overflow-y-auto divide-y divide-slate-100">
            {rows.map((r, idx) => (
              <li key={idx} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_60px_minmax(80px,100px)] items-center gap-2 px-3 py-1.5 text-xs">
                <input type="text" value={r.name} onChange={(e) => patchRow(idx, { name: e.target.value })}
                  className="rounded border border-slate-200 px-2 py-1 font-semibold focus:outline-none focus:border-violet-400" />
                <input type="text" value={r.date ?? ''} onChange={(e) => patchRow(idx, { date: e.target.value || null })}
                  placeholder="YYYY-MM-DD"
                  className="rounded border border-slate-200 px-2 py-1 text-slate-500 focus:outline-none focus:border-violet-400" />
                <select value={r.status} onChange={(e) => patchRow(idx, { status: e.target.value as ParsedRow['status'] })}
                  className="rounded border border-slate-200 px-1 py-1 focus:outline-none focus:border-violet-400">
                  <option value="present">출석</option>
                  <option value="late">지각</option>
                  <option value="absent">결석</option>
                </select>
                <span className="text-[10px] text-right inline-flex items-center justify-end gap-1">
                  {r.matchedId
                    ? <span className="text-emerald-600 inline-flex items-center gap-0.5"><CheckCircle2 size={10} aria-hidden="true" /> 매칭됨</span>
                    : <span className="text-amber-600 inline-flex items-center gap-0.5"><AlertTriangle size={10} aria-hidden="true" /> 미매칭</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
