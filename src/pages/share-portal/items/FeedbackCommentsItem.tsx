// bal24 v2 — 외부공유 항목 · 의견회신 댓글 (program_share_comments)
// 답글 1단계 (parent_id) — 결과 단계.

import { useEffect, useState } from 'react';
import { MessagesSquare, Send, Reply, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ProgramShareComment } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

interface CommentWithReplies extends ProgramShareComment {
  replies: ProgramShareComment[];
}

const inputClass =
  'w-full rounded-xl border border-violet-100 bg-white px-3 py-2 text-sm text-[#1E1B4B] placeholder-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toISOString().slice(0, 10);
}

export default function FeedbackCommentsItem({ programId }: Props) {
  const [list, setList] = useState<CommentWithReplies[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  async function refresh() {
    const { data, error } = await supabase
      .from('program_share_comments')
      .select('*')
      .eq('program_id', programId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[share-portal/client] 댓글 조회 실패:', error.message);
      return;
    }
    const rows = (data as ProgramShareComment[] | null) ?? [];
    const tops = rows.filter((c) => !c.parent_id);
    const map: Record<string, ProgramShareComment[]> = {};
    rows.filter((c) => c.parent_id).forEach((c) => {
      const pid = c.parent_id ?? '';
      (map[pid] ||= []).push(c);
    });
    setList(tops.map((t) => ({ ...t, replies: map[t.id] ?? [] })));
  }

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  async function postComment(parent: string | null, body: string) {
    if (!name.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('program_share_comments').insert({
        program_id: programId,
        parent_id: parent,
        author_role: 'client',
        author_name: name.trim(),
        content: body.trim(),
      });
      if (error) {
        console.error('[share-portal/client] 댓글 INSERT 실패:', error.message);
        return;
      }
      if (parent) {
        setReplyContent('');
        setReplyTo(null);
      } else {
        setContent('');
      }
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ItemCard
      icon={<MessagesSquare size={18} aria-hidden="true" />}
      title="의견회신"
      hint="담당자와 자유롭게 의견을 주고받아요"
    >
      {/* 작성 폼 */}
      <div className="flex flex-col gap-2 mb-3 p-3 rounded-xl bg-violet-50/30 border border-violet-100">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className={inputClass}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="의견·질문을 남겨주세요"
          className={`${inputClass} min-h-[80px] resize-y leading-relaxed`}
        />
        <button
          type="button"
          onClick={() => void postComment(null, content)}
          disabled={submitting || !name.trim() || !content.trim()}
          className="self-end inline-flex items-center gap-1 h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          <Send size={13} aria-hidden="true" />
          댓글 작성
        </button>
      </div>

      {/* 댓글 목록 */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-2">
          아직 댓글이 없어요. 첫 의견을 남겨주세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5">
              <div className="rounded-xl border border-violet-100 bg-white px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    c.author_role === 'staff'
                      ? 'bg-violet-100 text-violet-700'
                      : 'bg-cyan-100 text-cyan-700'
                  }`}>
                    {c.author_role === 'staff' ? '담당자' : '고객'}
                  </span>
                  <span className="text-xs font-bold text-[#1E1B4B]">{c.author_name}</span>
                  <span className="ml-auto text-[10px] text-slate-400">{formatRelative(c.created_at)}</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                <button
                  type="button"
                  onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline"
                >
                  <Reply size={11} aria-hidden="true" />
                  {replyTo === c.id ? '답글 취소' : '답글'}
                </button>
              </div>

              {/* 답글 목록 */}
              {c.replies.length > 0 && (
                <ul className="ml-4 flex flex-col gap-1.5 border-l-2 border-violet-100 pl-3">
                  {c.replies.map((r) => (
                    <li key={r.id} className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.author_role === 'staff'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-cyan-100 text-cyan-700'
                        }`}>
                          {r.author_role === 'staff' ? '담당자' : '고객'}
                        </span>
                        <span className="text-xs font-bold text-[#1E1B4B]">{r.author_name}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{formatRelative(r.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                    </li>
                  ))}
                </ul>
              )}

              {/* 답글 작성 폼 */}
              {replyTo === c.id && (
                <div className="ml-4 pl-3 border-l-2 border-violet-100 flex flex-col gap-2 p-2 rounded-xl bg-violet-50/30">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`${name || '이름'}님으로 답글 작성`}
                    className={`${inputClass} min-h-[60px] resize-y leading-relaxed`}
                  />
                  <button
                    type="button"
                    onClick={() => void postComment(c.id, replyContent)}
                    disabled={submitting || !name.trim() || !replyContent.trim()}
                    className="self-end inline-flex items-center gap-1 h-9 px-3 rounded-md bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors"
                  >
                    <Send size={11} aria-hidden="true" />
                    답글 작성
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </ItemCard>
  );
}
