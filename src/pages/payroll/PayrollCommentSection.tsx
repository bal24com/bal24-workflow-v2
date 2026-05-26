// 외주/급여 항목 댓글·대댓글 UI — 박경수님 + SkyClaw STEP-PAYROLL-DETAIL-COMMENT (2026-05-28)
// PM ↔ 재무담당자 소통용. 루트 댓글 + 1depth 대댓글.

import { useState, type KeyboardEvent } from 'react';
import { MessageSquare, Loader2 } from 'lucide-react';
import { usePayrollComments, type PayrollCommentItem } from '../../hooks/usePayrollComments';

interface Props { payrollId: string }

export default function PayrollCommentSection({ payrollId }: Props) {
  const { comments, loading, currentUserId, addComment, deleteComment } = usePayrollComments(payrollId);
  const [newText, setNewText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitRoot() {
    if (!newText.trim() || submitting) return;
    setSubmitting(true);
    const err = await addComment(newText, null);
    setSubmitting(false);
    if (!err) setNewText('');
  }
  async function handleSubmitReply(parentId: string) {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    const err = await addComment(replyText, parentId);
    setSubmitting(false);
    if (!err) { setReplyTo(null); setReplyText(''); }
  }
  function onKeyEnter(e: KeyboardEvent, fn: () => void) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fn(); }
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
        <MessageSquare size={14} aria-hidden="true" />
        메모 · 댓글
        <span className="text-[10px] text-slate-400 font-normal">(PM ↔ 재무담당자 소통용)</span>
      </h4>

      {loading && (
        <div className="flex items-center gap-1.5 py-2 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" /> 불러오는 중…
        </div>
      )}

      <div className="space-y-3 mb-3 max-h-60 overflow-y-auto pr-1">
        {!loading && comments.length === 0 && (
          <p className="text-xs text-slate-400 py-2 text-center">아직 메모가 없어요. 첫 메모를 남겨보세요.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="space-y-2">
            <Bubble c={c} isMine={c.author_id === currentUserId}
              onReply={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(''); }}
              onDelete={() => void deleteComment(c.id)} />
            {c.replies.map((r) => (
              <div key={r.id} className="ml-6 pl-3 border-l-2 border-violet-100">
                <Bubble c={r} isMine={r.author_id === currentUserId}
                  onReply={() => { setReplyTo(c.id); setReplyText(''); }}
                  onDelete={() => void deleteComment(r.id)} isReply />
              </div>
            ))}
            {replyTo === c.id && (
              <div className="ml-6 pl-3 border-l-2 border-violet-200">
                <div className="flex gap-1.5">
                  <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => onKeyEnter(e, () => void handleSubmitReply(c.id))}
                    placeholder="답글 입력… (Enter 전송)" autoFocus
                    className="flex-1 text-xs px-2.5 py-1.5 border border-violet-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-400" />
                  <button type="button" onClick={() => void handleSubmitReply(c.id)} disabled={submitting}
                    className="px-2.5 py-1 bg-violet-600 text-white text-[11px] rounded-lg hover:bg-violet-700 disabled:opacity-50">답글</button>
                  <button type="button" onClick={() => setReplyTo(null)}
                    className="px-2 py-1 text-slate-400 hover:text-slate-600 text-[11px]">취소</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea value={newText} onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => onKeyEnter(e, () => void handleSubmitRoot())}
          placeholder="메모 입력… (Enter 전송, Shift+Enter 줄바꿈)" rows={2}
          className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg resize-none outline-none focus:ring-1 focus:ring-violet-400" />
        <button type="button" onClick={() => void handleSubmitRoot()} disabled={!newText.trim() || submitting}
          className="px-3 py-2 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40">
          등록
        </button>
      </div>
    </div>
  );
}

function Bubble({ c, isMine, onReply, onDelete, isReply }: {
  c: PayrollCommentItem; isMine: boolean; onReply: () => void; onDelete: () => void; isReply?: boolean;
}) {
  return (
    <div className="group flex gap-2">
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5 ${isReply ? 'bg-violet-400' : 'bg-violet-600'}`}>
        {(c.author_name ?? '?')[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-bold text-slate-700">{c.author_name}</span>
          <span className="text-[10px] text-slate-400">
            {new Date(c.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs text-slate-800 whitespace-pre-wrap break-words">{c.content}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
        {!isReply && (
          <button type="button" onClick={onReply} className="text-[10px] text-violet-600 hover:text-violet-700 px-1.5 py-0.5 rounded hover:bg-violet-50">답글</button>
        )}
        {isMine && (
          <button type="button" onClick={onDelete} className="text-[10px] text-rose-500 hover:text-rose-700 px-1.5 py-0.5 rounded hover:bg-rose-50">삭제</button>
        )}
      </div>
    </div>
  );
}
