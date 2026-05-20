// bal24 v2 — 교육생 명단 요약 카드 (개요 탭)
// PART4: 이름 / 연락처 / 상태 배지 표시 + 펼치기/접기 토글 (최대 50명)

import { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Sparkles, Upload, Pencil, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { callAi, callAiWithFile } from '../../../../lib/aiClient';
import { fileToText, classifyFile } from '../../../../lib/fileToText';
import type { ProgramParticipant } from '../../../../types/database';
import {
  BADGE_BASE,
  PARTICIPANT_STATUS_LABEL,
  PARTICIPANT_STATUS_KO_STYLE,
} from '../../../../utils/statusStyles';

interface Props {
  programId: string;
}

interface ExtractedPerson {
  name: string;
  email?: string | null;
  phone?: string | null;
  org?: string | null;
}

const SYSTEM_PROMPT = `교육생·참여자 명단 문서에서 사람 목록을 JSON 배열로만 반환합니다.
각 항목. name(이름 필수), email, phone, org(소속).
없는 항목=null. JSON 배열만 반환. 최대 200명.`;

const PREVIEW_COUNT = 5;  // 접혀 있을 때 표시할 기본 인원
const MAX_COUNT = 50;     // 펼쳤을 때 최대 표시 인원

function safeParse(raw: string): ExtractedPerson[] {
  const c = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const r = JSON.parse(c);
    return Array.isArray(r) ? (r as ExtractedPerson[]) : [];
  } catch {
    const i = c.indexOf('[');
    return i >= 0 ? safeParse(c.slice(i)) : [];
  }
}

export default function ProgramParticipantSummaryCard({ programId }: Props) {
  const toast = useToast();
  const [list, setList] = useState<ProgramParticipant[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [manual, setManual] = useState('');
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('program_participants')
      .select('*')
      .eq('program_id', programId)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });
    if (error) console.error('[overview-participant] 조회 실패:', error.message);
    setList((data ?? []) as ProgramParticipant[]);
  }, [programId]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [reload]);

  async function handleAiExtract() {
    if (!file) return;
    setExtracting(true);
    try {
      const kind = classifyFile(file);
      let raw = '';
      if (kind !== 'unknown') {
        const doc = await fileToText(file);
        if (doc?.text) {
          const r = await callAi({
            preset: 'curriculum-extract',
            systemOverride: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: doc.text.slice(0, 5000) }],
            maxTokens: 4096,
          });
          raw = r.ok ? (r.text ?? '') : '';
        }
      } else {
        const r = await callAiWithFile(file, '명단을 JSON 배열로 반환해 주세요.', 'curriculum-extract', {
          systemOverride: SYSTEM_PROMPT,
          maxTokens: 4096,
        });
        raw = r.ok ? (r.text ?? '') : '';
      }
      const persons = safeParse(raw);
      if (persons.length === 0) { toast.error('명단을 추출하지 못했어요.'); return; }
      const rows = persons.filter((p) => p.name?.trim()).map((p) => ({
        program_id: programId,
        name: p.name.trim(),
        role: 'participant' as const,
        email: p.email ?? null,
        phone: p.phone ?? null,
        memo: p.org ?? null,
      }));
      const { error } = await supabase.from('program_participants').insert(rows);
      if (error) throw error;
      setFile(null);
      await reload();
      toast.success(`${rows.length}명이 등록됐어요.`);
    } catch (err) {
      const r = err instanceof Error ? err.message : '';
      console.error('[overview-participant] AI 추출 실패:', r);
      toast.error('AI 추출 중 오류가 발생했어요.');
    } finally {
      setExtracting(false);
    }
  }

  async function handleManualAdd() {
    const lines = manual.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setAdding(true);
    try {
      const rows = lines.map((line) => {
        const [name, org, phone, email] = line.split(',').map((s) => s.trim());
        return {
          program_id: programId,
          name: name || '미지정',
          role: 'participant' as const,
          email: email || null,
          phone: phone || null,
          memo: org || null,
        };
      });
      const { error } = await supabase.from('program_participants').insert(rows);
      if (error) throw error;
      setManual('');
      await reload();
      toast.success(`${rows.length}명이 등록됐어요.`);
    } catch (err) {
      console.error('[overview-participant] 직접 등록 실패:', err);
      toast.error('등록 중 오류가 발생했어요.');
    } finally {
      setAdding(false);
    }
  }

  const hasParticipants = list.length > 0;
  const displayList = expanded ? list.slice(0, MAX_COUNT) : list.slice(0, PREVIEW_COUNT);
  const canToggle = list.length > PREVIEW_COUNT;

  return (
    <Card className="bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold text-[#1E1B4B]">
          <Users size={15} className="text-violet-500" aria-hidden="true" />
          참여자 명단
          <span className="ml-auto text-[11px] font-normal text-slate-400">
            총 {list.length}명
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {hasParticipants ? (
          <>
            {/* 명단 리스트 */}
            <div className="space-y-0">
              {displayList.map((p) => {
                const labelKo = PARTICIPANT_STATUS_LABEL[p.status] ?? p.status;
                const badgeCls = PARTICIPANT_STATUS_KO_STYLE[labelKo] ?? '';
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-2
                               border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm font-medium text-[#1E1B4B] w-20 truncate shrink-0">
                      {p.name}
                    </span>
                    <span className="text-sm text-slate-500 flex-1 px-2 truncate">
                      {p.phone || '—'}
                    </span>
                    <span
                      className={`${BADGE_BASE} ${badgeCls} shrink-0`}
                    >
                      {labelKo}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 펼치기/접기 토글 */}
            {canToggle && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-center gap-1
                           text-[11px] text-violet-600 font-semibold pt-1
                           hover:text-violet-800 transition-colors"
              >
                {expanded ? (
                  <>
                    <ChevronUp size={12} aria-hidden="true" />
                    접기
                  </>
                ) : (
                  <>
                    <ChevronDown size={12} aria-hidden="true" />
                    +{list.length - PREVIEW_COUNT}명 더 보기 → [교육생] 탭에서 전체 확인·추가
                  </>
                )}
              </button>
            )}

            {list.length > MAX_COUNT && expanded && (
              <p className="text-center text-[10px] text-slate-400 pb-1">
                최대 {MAX_COUNT}명까지 표시돼요. 전체 명단은 [교육생] 탭에서 확인하세요.
              </p>
            )}
          </>
        ) : (
          /* 빈 상태: AI 추출 + 직접 입력 UI */
          <>
            {/* AI 추출 */}
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={12} className="text-violet-500" aria-hidden="true" />
                <span className="text-xs font-bold text-violet-700">AI 자동 명단 추출</span>
              </div>
              <p className="text-[11px] text-violet-700/80">
                엑셀·CSV·PDF·이미지에서 명단 자동 인식.
              </p>
              <input
                ref={inputRef}
                type="file"
                hidden
                accept=".xlsx,.csv,.pdf,.png,.jpg,.jpeg,.docx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={extracting}
                className="w-full border-2 border-dashed border-violet-200 rounded-lg p-3
                           text-center hover:bg-violet-100/50 transition-colors disabled:opacity-50"
              >
                <Upload size={14} className="mx-auto mb-1 text-violet-400" aria-hidden="true" />
                <p className="text-[11px] text-slate-600">
                  {file ? file.name : '클릭해서 파일 선택'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => void handleAiExtract()}
                disabled={!file || extracting}
                className="w-full py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold
                           hover:bg-violet-700 disabled:opacity-40
                           inline-flex items-center justify-center gap-1"
              >
                {extracting
                  ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                  : <Sparkles size={12} aria-hidden="true" />}
                {extracting ? '추출 중…' : 'AI로 명단 자동 추출'}
              </button>
            </div>

            {/* 직접 입력 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Pencil size={11} className="text-slate-400" aria-hidden="true" />
                <span className="text-[11px] text-slate-500">
                  직접 입력 (한 줄에 한 명. 이름,소속,전화,이메일)
                </span>
              </div>
              <textarea
                rows={3}
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                disabled={adding}
                placeholder="홍길동, 밸런스닷, 010-1234-5678, hong@test.com"
                className="w-full text-xs rounded-lg border border-slate-200 bg-white
                           px-2 py-1.5 focus:outline-none focus:border-violet-400 resize-none"
              />
              <button
                type="button"
                onClick={() => void handleManualAdd()}
                disabled={!manual.trim() || adding}
                className="px-3 py-1 rounded-lg bg-blue-600 text-white text-[11px]
                           font-bold hover:bg-blue-700 disabled:opacity-40"
              >
                + 직접 등록
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
