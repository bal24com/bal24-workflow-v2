// bal24 v2 — AI 어시스턴트 메인 페이지 (STEP 21)
// 좌측 대화 목록 (240px) + 우측 채팅 (flex-1)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { dateGroupLabel, type AiConversationRow } from './aiUtils';
import AiChatWindow from './AiChatWindow';

export default function AiPage() {
  const { user } = useAuth();
  const toast = useToast();
  const userId = user?.id ?? null;

  const [conversations, setConversations] = useState<AiConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const reloadList = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('[ai] 대화 목록 조회 실패:', error.message);
    }
    setConversations((data as AiConversationRow[] | null) ?? []);
    setLoadingList(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoadingList(true);
    void (async () => {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('[ai] 대화 목록 조회 실패:', error.message);
      }
      setConversations((data as AiConversationRow[] | null) ?? []);
      setLoadingList(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const startNewChat = () => {
    setActiveId(null);
  };

  const selectConversation = (id: string) => {
    setActiveId(id);
  };

  const handleConversationCreated = useCallback(
    (id: string) => {
      setActiveId(id);
      void reloadList();
    },
    [reloadList],
  );

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`"${title}" 대화를 삭제할까요? 이 작업은 되돌릴 수 없어요.`)) return;
    const { error } = await supabase.from('ai_conversations').delete().eq('id', id);
    if (error) {
      console.error('[ai] 대화 삭제 실패:', error.message);
      toast.error('삭제 중 오류가 발생했어요.');
      return;
    }
    if (activeId === id) setActiveId(null);
    toast.success('대화를 삭제했어요.');
    void reloadList();
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, AiConversationRow[]>();
    for (const c of conversations) {
      const key = dateGroupLabel(c.updated_at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }
    return Array.from(groups.entries());
  }, [conversations]);

  if (!userId) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-white p-12 text-center text-sm text-slate-500">
        로그인 정보를 불러오는 중이에요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <span aria-hidden="true">🤖</span>
          AI 어시스턴트
        </h1>
      </header>

      <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)] overflow-hidden grid grid-cols-1 md:grid-cols-[240px_1fr]" style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}>
        {/* 좌측 대화 목록 */}
        <aside className="border-r border-slate-100 flex flex-col bg-violet-50/30">
          <div className="p-3 border-b border-slate-100">
            <Button variant="primary" onClick={startNewChat} className="!w-full">
              <Plus size={16} className="mr-1.5" aria-hidden="true" />
              새 대화
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-3" aria-label="대화 목록">
            {loadingList ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-6">
                대화가 없어요.
                <br />
                새 대화를 시작해 보세요.
              </div>
            ) : (
              grouped.map(([label, list]) => (
                <div key={label}>
                  <div className="px-2 mb-1 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    {label}
                  </div>
                  <ul className="space-y-1">
                    {list.map((c) => {
                      const active = c.id === activeId;
                      return (
                        <li key={c.id} className="group">
                          <div
                            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm cursor-pointer transition-colors ${
                              active
                                ? 'bg-violet-100 border-l-2 border-violet-600 text-violet-900 font-semibold'
                                : 'border-l-2 border-transparent text-slate-700 hover:bg-violet-50'
                            }`}
                            onClick={() => selectConversation(c.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                selectConversation(c.id);
                              }
                            }}
                          >
                            <MessageSquare size={14} className="shrink-0 text-violet-400" aria-hidden="true" />
                            <span className="flex-1 truncate">{c.title}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(c.id, c.title);
                              }}
                              aria-label="대화 삭제"
                              className="shrink-0 opacity-0 group-hover:opacity-100 rounded-md p-0.5 text-rose-500 hover:bg-rose-50 transition-opacity"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </nav>
        </aside>

        {/* 우측 채팅 */}
        <section className="flex flex-col min-w-0">
          <AiChatWindow
            conversationId={activeId}
            userId={userId}
            onConversationCreated={handleConversationCreated}
          />
        </section>
      </div>
    </div>
  );
}
