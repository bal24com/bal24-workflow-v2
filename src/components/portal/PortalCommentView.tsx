// bal24 v2 — STEP-PORTAL-MULTI-FIX PART G (박경수님 2026-05-26)
// 강사 포털용 댓글 읽기 전용 뷰 — 펼침 시 is_read 자동 갱신.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import type { CommentTargetType, PortalComment } from './PortalCommentSection';

interface Props {
  targetType: CommentTargetType;
  targetId: string;
  /** 펼침 시 is_read = true 로 업데이트할지 여부. 기본 true. */
  markReadOnMount?: boolean;
}

export default function PortalCommentView({ targetType, targetId, markReadOnMount = true }: Props) {
  const [comments, setComments] = useState<PortalComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('portal_comments')
      .select('*').eq('target_type', targetType).eq('target_id', targetId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      const m = (error.message ?? '').toLowerCase();
      if (!m.includes('does not exist') && !m.includes('pgrst205')) {
        console.warn('[PortalCommentView] 조회 경고:', error.message);
      }
      setComments([]);
      return;
    }
    const list = (data ?? []) as PortalComment[];
    setComments(list);
    // 읽음 처리 (is_read=false 인 행만)
    if (markReadOnMount) {
      const unreadIds = list.filter((c) => !c.is_read).map((c) => c.id);
      if (unreadIds.length > 0) {
        await supabase.from('portal_comments')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
    }
  }, [targetType, targetId, markReadOnMount]);

  useEffect(() => { void fetchComments(); }, [fetchComments]);

  if (loading) {
    return <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-violet-400" /></div>;
  }
  if (comments.length === 0) return null;

  return (
    <section className="mt-3 pt-3 border-t border-slate-100">
      <header className="flex items-center gap-1.5 mb-2">
        <MessageSquare size={13} className="text-violet-500" aria-hidden="true" />
        <h4 className="text-xs font-bold text-slate-700">PM 메모</h4>
        <span className="text-[11px] text-slate-400">({comments.length}건)</span>
      </header>
      <ul className="space-y-1.5">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md bg-violet-50/60 border border-violet-100 px-2.5 py-1.5">
            <p className="text-[11px] text-slate-500 mb-0.5">
              <strong className="text-slate-700">{c.author_name}</strong> · {formatDateKo(c.created_at)}
            </p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
