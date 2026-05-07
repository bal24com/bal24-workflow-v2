// bal24 v2 — AI 메시지 말풍선 (STEP 21)
// user: 우측 violet, assistant: 좌측 white + 🤖 라벨

import { Bot } from 'lucide-react';
import { formatMessageTime, type AiRole } from './aiUtils';

interface Props {
  role: AiRole;
  content: string;
  createdAt?: string;
  isMock?: boolean;
}

export default function AiMessageBubble({ role, content, createdAt, isMock }: Props) {
  const isUser = role === 'user';
  const time = createdAt ? formatMessageTime(createdAt) : '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 px-1">
            <Bot size={12} aria-hidden="true" />
            AI 어시스턴트
            {isMock && (
              <span className="rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px]">
                Mock
              </span>
            )}
          </div>
        )}
        <div
          className={
            isUser
              ? 'bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm'
              : 'bg-white border border-violet-100 text-[#1E1B4B] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm'
          }
        >
          {content}
        </div>
        {time && <span className="text-[10px] text-slate-400 px-1">{time}</span>}
      </div>
    </div>
  );
}
