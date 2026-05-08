// bal24 v2 — 커리큘럼 AI 추출 모달 (Stage AI-②)
// 파일(xlsx/csv/txt/docx) → fileToText → curriculum-extract preset → JSON 미리보기 → 일괄 INSERT.

import { useRef, useState } from 'react';
import { Loader2, Upload, X, Sparkles, Check } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { fileToText } from '../../../../lib/fileToText';
import { extractJson } from '../../../../lib/aiUtils';
import { useToast } from '../../../../contexts/ToastContext';

interface ExtractedSession {
  session_no: number;
  title: string;
  content?: string | null;
  duration?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  programId: string;
  nextSessionNo: number;
  onSaved: () => void;
}

const SYSTEM_PROMPT = `당신은 교육 커리큘럼 데이터 추출 전문가입니다.
문서에서 차시별 정보를 추출해 반드시 JSON 배열로만 반환하세요.
각 항목 형식: { "session_no": 숫자, "title": "제목", "content": "내용 또는 null", "duration": 분수_숫자_또는_null, "start_time": "HH:MM 또는 null", "end_time": "HH:MM 또는 null", "venue": "장소 또는 null" }
반드시 \`\`\`json ... \`\`\` 블록으로 감싸서 반환하세요. 다른 설명 없이 JSON만 반환하세요.`;

export default function AiCurriculumModal({
  open, onClose, programId, nextSessionNo, onSaved,
}: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<ExtractedSession[]>([]);

  if (!open) return null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSessions([]);
    setExtracting(true);
    try {
      const doc = await fileToText(file);
      if (!doc || !doc.text) {
        toast.error('파일에서 텍스트를 추출하지 못했어요. 형식을 확인해 주세요.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          preset: 'curriculum-extract',
          systemOverride: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `아래 문서에서 커리큘럼 차시 정보를 추출해 주세요.\n\n---\n${doc.text.slice(0, 8000)}`,
            },
          ],
          maxTokens: 4096,
        },
      });
      if (error) throw new Error(error.message);
      const body = data as { ok?: boolean; text?: string; error?: string } | null;
      if (!body?.ok) throw new Error(body?.error ?? 'AI 오류');

      const parsed = extractJson<ExtractedSession[]>(body.text ?? '');
      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
        toast.error('AI 응답에서 차시 정보를 찾지 못했어요. 다시 시도해 주세요.');
        return;
      }
      setSessions(parsed.map((s, i) => ({ ...s, session_no: nextSessionNo + i })));
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[ai-curriculum] 추출 실패:', raw);
      toast.error('AI 커리큘럼 추출에 실패했어요. 파일 형식을 확인하거나 다시 시도해 주세요.');
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave() {
    if (sessions.length === 0) return;
    setSaving(true);
    try {
      const rows = sessions.map((s) => ({
        program_id: programId,
        session_no: s.session_no,
        title: s.title,
        content: s.content ?? null,
        duration: s.duration ?? null,
        start_time: s.start_time ?? null,
        end_time: s.end_time ?? null,
        venue: s.venue ?? null,
      }));
      const { error } = await supabase.from('program_curriculum').insert(rows);
      if (error) {
        console.error('[ai-curriculum] 저장 실패:', error.message);
        toast.error('차시 저장에 실패했어요.');
        return;
      }
      toast.success(`${sessions.length}개 차시가 저장됐어요.`);
      onSaved();
      handleClose();
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setFileName(null);
    setSessions([]);
    setExtracting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-[20px] bg-white shadow-[0_8px_40px_rgba(124,58,237,0.18)] flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-500" aria-hidden="true" />
            <span className="text-sm font-bold text-slate-800">AI 커리큘럼 추출</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="닫기"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div
            className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/30 p-6 text-center cursor-pointer hover:bg-violet-50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt,.md,.docx"
              className="hidden"
              onChange={(e) => void handleFileChange(e)}
            />
            <Upload size={24} className="text-violet-400 mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm font-semibold text-violet-700">파일을 클릭하여 업로드</p>
            <p className="text-xs text-slate-400 mt-1">xlsx · csv · txt · docx 지원</p>
            {fileName && (
              <p className="mt-2 text-xs font-medium text-violet-600 bg-violet-100 px-2 py-1 rounded-lg inline-block">
                {fileName}
              </p>
            )}
          </div>

          {extracting && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-violet-600">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              AI가 커리큘럼을 추출하는 중...
            </div>
          )}

          {sessions.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {sessions.length}개 차시 추출됨
              </p>
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                {sessions.map((s) => (
                  <div
                    key={s.session_no}
                    className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold mt-0.5">
                      {s.session_no}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">{s.title}</p>
                      {(s.start_time || s.duration || s.venue) && (
                        <p className="text-[10px] text-slate-400">
                          {s.start_time ? `${s.start_time}~${s.end_time ?? ''}` : (s.duration ? `${s.duration}분` : '')}
                          {s.venue ? ` · ${s.venue}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={sessions.length === 0 || saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {saving ? '저장 중...' : `${sessions.length}개 차시 저장`}
          </button>
        </div>
      </div>
    </div>
  );
}
