// bal24 v2 — STEP-PORTAL-MULTI-FIX PART G (박경수님 2026-05-26)
// PM ↔ 강사 댓글 시스템 — PM 작성/조회/삭제. portal_comments 테이블.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateKo } from '../../lib/utils';

export type CommentTargetType = 'mentoring_log' | 'curriculum_log' | 'payroll_expense';

export interface PortalComment {
  id: string;
  target_type: CommentTargetType;
  target_id: string;
  content: string;
  author_id: string | null;
  author_name: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  targetType: CommentTargetType;
  targetId: string;
  /** 작성자 이름 (PM 이름 등). 없으면 auth user metadata 시도. */
  authorNameOverride?: string;
}

export default function PortalCommentSection({ targetType, targetId, authorNameOverride }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [comments, setComments] = useState<PortalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('portal_comments')
      .select('*').eq('target_type', targetType).eq('target_id', targetId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      const m = (error.message ?? '').toLowerCase();
      if (m.includes('does not exist') || m.includes('pgrst205')) {
        console.warn('[PortalCommentSection] portal_comments 테이블 미적용');
      } else {
        console.warn('[PortalCommentSection] 댓글 조회 경고:', error.message);
      }
      setComments([]);
      return;
    }
    setComments((data ?? []) as PortalComment[]);
  }, [targetType, targetId]);

  useEffect(() => { void fetchComments(); }, [fetchComments]);

  async function handleSubmit() {
    const content = input.trim();
    if (!content) return;
    setPosting(true);
    const authorName = authorNameOverride
      ?? (user?.user_metadata?.name as string | undefined)
      ?? user?.email
      ?? 'PM';
    const { error } = await supabase.from('portal_comments').insert({
      target_type: targetType, target_id: targetId,
      content, author_id: user?.id ?? null, author_name: authorName,
    });
    setPosting(false);
    if (error) {
      console.error('[PortalCommentSection] 등록 실패:', error.message);
      toast.error('댓글 등록에 실패했어요.');
      return;
    }
    setInput('');
    toast.success('댓글을 등록했어요.');
    void fetchComments();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 댓글을 삭제할까요?')) return;
    const { error } = await supabase.from('portal_comments').delete().eq('id', id);
    if (error) {
      console.error('[PortalCommentSection] 삭제 실패:', error.message);
      toast.error('삭제에 실패했어요.');
      return;
    }
    toast.success('댓글을 삭제했어요.');
    void fetchComments();
  }

  return (
    <section className="mt-3 pt-3 border-t border-slate-100">
      <header className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={13} className="text-violet-500" aria-hidden="true" />
        <h4 className="text-xs font-bold text-slate-700">PM 메모 / 댓글</h4>
        <span className="text-[11px] text-slate-400">({comments.length}건)</span>
      </header>

      {loading ? (
        <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-violet-400" /></div>
      ) : (
        <>
          {comments.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-md bg-violet-50/60 border border-violet-100 px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 mb-0.5">
                    <span><strong className="text-slate-700">{c.author_name}</strong> · {formatDateKo(c.created_at)}</span>
                    <button type="button" onClick={() => void handleDelete(c.id)}
                      className="inline-flex items-center gap-0.5 text-rose-500 hover:underline">
                      <Trash2 size={10} aria-hidden="true" /> 삭제
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.content}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-start gap-1.5">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="강사에게 전달할 메모 / 피드백을 입력하세요."
              rows={2}
              className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-y" />
            <button type="button" onClick={() => void handleSubmit()} disabled={posting || !input.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
              {posting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} aria-hidden="true" />}
              등록
            </button>
          </div>
        </>
      )}
    </section>
  );
}
