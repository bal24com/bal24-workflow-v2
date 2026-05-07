// bal24 v2 — AI 채팅 영역 + 입력창 (STEP 21)
// 메시지 목록 fetch + 새 메시지 자동 스크롤 + Enter 전송 / Shift+Enter 줄바꿈

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  sendToAi,
  generateTitle,
  type AiMessage,
  type AiMessageRow,
} from './aiUtils';
import AiMessageBubble from './AiMessageBubble';
import AiPromptTemplates from './AiPromptTemplates';

interface DisplayMessage extends AiMessage {
  id: string;
  createdAt?: string;
  isMock?: boolean;
}

interface Props {
  conversationId: string | null;
  userId: string;
  onConversationCreated: (id: string) => void;
}

export default function AiChatWindow({ conversationId, userId, onConversationCreated }: Props) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  // 대화 변경 시 메시지 로드
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setErrorMsg(null);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    void (async () => {
      const { data, error } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[ai] 메시지 조회 실패:', error.message);
        setErrorMsg('대화를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      const rows = (data as AiMessageRow[] | null) ?? [];
      setMessages(
        rows.map((r) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          createdAt: r.created_at,
        })),
      );
      setLoadingMessages(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // 새 메시지 도착 시 스크롤
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setErrorMsg(null);

    try {
      // 1) 대화 없으면 신규 생성
      let convId = conversationId;
      if (!convId) {
        const { data: conv, error: convErr } = await supabase
          .from('ai_conversations')
          .insert({ user_id: userId, title: generateTitle(text) })
          .select('id')
          .single();
        if (convErr || !conv) throw convErr ?? new Error('대화 생성 실패');
        convId = conv.id as string;
        onConversationCreated(convId);
      }

      // 2) user 메시지 저장 + UI 즉시 반영
      const userMsg: DisplayMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');

      const { data: savedUser, error: userErr } = await supabase
        .from('ai_messages')
        .insert({ conversation_id: convId, role: 'user', content: text })
        .select('*')
        .single();
      if (userErr) console.error('[ai] user 메시지 저장 실패:', userErr.message);
      if (savedUser) {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsg.id ? { ...m, id: savedUser.id as string } : m)),
        );
      }

      // 3) AI 응답 요청 (Edge Function 또는 Mock fallback)
      const history: AiMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: text },
      ];
      const { content: reply, mock } = await sendToAi(history);

      // 4) assistant 메시지 저장
      const { data: savedAssistant, error: assistantErr } = await supabase
        .from('ai_messages')
        .insert({ conversation_id: convId, role: 'assistant', content: reply })
        .select('*')
        .single();
      if (assistantErr) console.error('[ai] assistant 메시지 저장 실패:', assistantErr.message);

      setMessages((prev) => [
        ...prev,
        {
          id: (savedAssistant?.id as string | undefined) ?? `temp-assistant-${Date.now()}`,
          role: 'assistant',
          content: reply,
          createdAt: (savedAssistant?.created_at as string | undefined) ?? new Date().toISOString(),
          isMock: mock,
        },
      ]);

      // 5) 대화 updated_at 갱신
      await supabase
        .from('ai_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', convId);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[ai] 메시지 전송 실패:', raw);
      setErrorMsg('AI 응답을 가져오지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSending(false);
    }
  }, [input, sending, conversationId, userId, onConversationCreated, messages]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const showWelcome = !conversationId && messages.length === 0 && !sending;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {loadingMessages ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
          </div>
        ) : showWelcome ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-violet-100 text-violet-600">
              <Sparkles size={26} aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#1E1B4B]">무엇을 도와드릴까요?</h2>
              <p className="text-sm text-slate-500">
                보고서·메일·예산 계획 등 업무에 관한 질문을 자유롭게 물어보세요.
              </p>
            </div>
            <div className="w-full max-w-lg pt-2">
              <AiPromptTemplates onSelect={(t) => setInput(t)} />
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <AiMessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                createdAt={m.createdAt}
                isMock={m.isMock}
              />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] flex flex-col gap-1 items-start">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 px-1">
                    <Bot size={12} aria-hidden="true" />
                    AI 어시스턴트
                  </div>
                  <div className="bg-white border border-violet-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                      <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollEndRef} />
          </>
        )}
      </div>

      <div className="border-t border-slate-100 bg-white p-3 space-y-2">
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        {!showWelcome && messages.length > 0 && (
          <AiPromptTemplates onSelect={(t) => setInput(t)} disabled={sending} />
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            rows={2}
            placeholder="무엇이든 물어보세요... (Enter 전송 · Shift+Enter 줄바꿈)"
            className="flex-1 resize-none rounded-xl border border-violet-100 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
          <Button
            variant="primary"
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            loading={sending}
            className="!px-4"
          >
            <Send size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
