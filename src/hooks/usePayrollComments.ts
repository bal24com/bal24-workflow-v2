// 외주/급여 항목 댓글/대댓글 훅 — 박경수님 + SkyClaw STEP-PAYROLL-DETAIL-COMMENT (2026-05-28)
// payroll_comments 테이블 CRUD. 트리 구조 (root + replies) 변환.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface PayrollCommentItem {
  id: string;
  payroll_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  author_name: string;
  replies: PayrollCommentItem[];
}

interface CommentRow {
  id: string;
  payroll_id: string;
  parent_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  author: { name: string | null } | null;
}

export function usePayrollComments(payrollId: string | null) {
  const [comments, setComments] = useState<PayrollCommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const fetchComments = useCallback(async () => {
    if (!payrollId) { setComments([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_comments')
      .select('id, payroll_id, parent_id, author_id, content, created_at, author:profiles!payroll_comments_author_id_fkey(name)')
      .eq('payroll_id', payrollId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) { console.error('[usePayrollComments] 조회 실패:', error.message); setComments([]); return; }
    const rows = (data ?? []) as unknown as CommentRow[];
    const map = new Map<string, PayrollCommentItem>();
    rows.forEach((r) => map.set(r.id, {
      id: r.id, payroll_id: r.payroll_id, parent_id: r.parent_id, author_id: r.author_id,
      content: r.content, created_at: r.created_at,
      author_name: r.author?.name ?? '알 수 없음', replies: [],
    }));
    const roots: PayrollCommentItem[] = [];
    map.forEach((item) => {
      if (item.parent_id && map.has(item.parent_id)) map.get(item.parent_id)!.replies.push(item);
      else roots.push(item);
    });
    setComments(roots);
  }, [payrollId]);

  useEffect(() => { void fetchComments(); }, [fetchComments]);

  async function addComment(content: string, parentId: string | null) {
    if (!payrollId || !currentUserId || !content.trim()) return '입력값 누락';
    const { error } = await supabase.from('payroll_comments')
      .insert({ payroll_id: payrollId, parent_id: parentId, author_id: currentUserId, content: content.trim() });
    if (error) { console.error('[usePayrollComments] 등록 실패:', error.message); return error.message; }
    await fetchComments();
    return null;
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from('payroll_comments')
      .update({ deleted_at: new Date().toISOString() }).eq('id', commentId);
    if (error) { console.error('[usePayrollComments] 삭제 실패:', error.message); return error.message; }
    await fetchComments();
    return null;
  }

  return { comments, loading, currentUserId, addComment, deleteComment, refetch: fetchComments };
}
