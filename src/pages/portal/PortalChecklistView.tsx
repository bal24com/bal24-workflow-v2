// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE — 역할별 체크리스트 외부 뷰.
// 6종 항목 타입 (file_download / file_upload / text_info / feedback / approval / auto_data) 렌더.

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileText, MessageSquare, ShieldCheck, Sparkles, Upload, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { filterByRole, canAct, ITEM_TYPE_LABEL, ROLE_LABEL, type PortalRole } from './portalUtils';
import type { TeamInfo } from './portalAuth';

interface PortalItemRow {
  id: string;
  portal_id: string;
  item_type: string;
  label: string | null;          // 기존 컬럼
  title: string | null;          // 명세 호환 — 둘 다 지원
  description: string | null;
  file_url: string | null;
  file_name: string | null;
  visible_roles: string[] | null;
  actionable_roles: string[] | null;
  required: boolean | null;
  sort_order: number | null;
}

interface PortalResponseRow {
  id: string;
  item_id: string;
  portal_role: string | null;
  respondent_id: string | null;
  content: string | null;
  file_url: string | null;
  is_approved: boolean | null;
  submitted_at: string;
}

interface Props {
  portalId: string;
  portalTitle: string;
  portalDescription: string | null;
  role: PortalRole;
  team?: TeamInfo | null;
}

export default function PortalChecklistView({ portalId, portalTitle, portalDescription, role, team }: Props) {
  const [items, setItems] = useState<PortalItemRow[]>([]);
  const [responses, setResponses] = useState<PortalResponseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data: iData } = await supabase
        .from('portal_items')
        .select('id, portal_id, item_type, label, title, description, file_url, file_name, visible_roles, actionable_roles, required, sort_order')
        .eq('portal_id', portalId)
        .order('sort_order', { ascending: true });
      const { data: rData } = await supabase
        .from('portal_responses')
        .select('id, item_id, portal_role, respondent_id, content, file_url, is_approved, submitted_at')
        .order('submitted_at', { ascending: false });
      if (cancelled) return;
      setItems((iData ?? []) as PortalItemRow[]);
      // participant 는 본인 팀 응답만, 그 외 역할은 전체 응답
      const respId = team?.id ?? null;
      const allResponses = (rData ?? []) as PortalResponseRow[];
      const filteredResponses = role === 'participant' && respId
        ? allResponses.filter((r) => r.respondent_id === respId)
        : allResponses;
      setResponses(filteredResponses);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [portalId, role, team?.id]);

  const visible = filterByRole(items, role);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-violet-100 shadow-card p-6 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-[#1E1B4B]">{portalTitle}</h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700 border border-violet-200">
              {ROLE_LABEL[role]} {team ? `· ${team.team_name}` : ''}
            </span>
          </div>
          {portalDescription && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{portalDescription}</p>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="bg-white rounded-2xl border border-violet-100 p-8 text-center text-sm text-slate-400">
            아직 등록된 체크리스트 항목이 없어요.
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((item) => (
              <ItemCard key={item.id} item={item} role={role} team={team}
                responses={responses.filter((r) => r.item_id === item.id)}
                onSaved={(newResp) => setResponses((prev) => [newResp, ...prev])} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ItemCard({
  item, role, team, responses, onSaved,
}: {
  item: PortalItemRow;
  role: PortalRole;
  team?: TeamInfo | null;
  responses: PortalResponseRow[];
  onSaved: (r: PortalResponseRow) => void;
}) {
  const title = item.title ?? item.label ?? '(제목 없음)';
  const completed = responses.length > 0;
  const actionable = canAct(item, role);

  return (
    <li className="bg-white rounded-2xl border border-violet-100 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
              {ITEM_TYPE_LABEL[item.item_type] ?? item.item_type}
            </span>
            {item.required && (
              <span className="text-[10px] font-bold text-rose-600">필수</span>
            )}
            {completed && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                <CheckCircle2 size={12} aria-hidden="true" /> 완료
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-[#1E1B4B] mt-1.5">{title}</h3>
          {item.description && (
            <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{item.description}</p>
          )}
        </div>
      </div>

      {/* 항목 타입별 액션 */}
      {actionable && (
        <ItemAction item={item} role={role} team={team} completed={completed} onSaved={onSaved} />
      )}
    </li>
  );
}

function ItemAction({
  item, role, team, completed, onSaved,
}: {
  item: PortalItemRow;
  role: PortalRole;
  team?: TeamInfo | null;
  completed: boolean;
  onSaved: (r: PortalResponseRow) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');

  async function submitResponse(payload: Partial<PortalResponseRow>): Promise<void> {
    setSubmitting(true);
    const respondentId = team?.id ?? `${role}-${Date.now()}`;
    const { data, error } = await supabase
      .from('portal_responses')
      .insert({
        item_id: item.id, portal_role: role, respondent_id: respondentId,
        response_type: payload.is_approved != null ? 'approval' : (payload.file_url ? 'file' : 'feedback'),
        ...payload,
      })
      .select('*')
      .single();
    setSubmitting(false);
    if (error) {
      console.error('[PortalChecklistView] submit 실패:', error.message);
      alert('제출 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    if (data) onSaved(data as PortalResponseRow);
    setText('');
  }

  if (item.item_type === 'file_download' && item.file_url) {
    return (
      <div className="flex items-center justify-between gap-2 bg-slate-50 rounded-lg p-3">
        <span className="text-xs text-slate-600 flex items-center gap-1.5">
          <FileText size={13} aria-hidden="true" />
          {item.file_name ?? '첨부 파일'}
        </span>
        <a href={item.file_url} target="_blank" rel="noopener noreferrer"
          onClick={() => !completed && void submitResponse({ content: '다운로드 완료' })}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline">
          <Download size={13} aria-hidden="true" />
          다운로드
        </a>
      </div>
    );
  }

  if (item.item_type === 'text_info') {
    return (
      <button type="button"
        onClick={() => void submitResponse({ content: '확인 완료' })}
        disabled={submitting || completed}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50">
        {submitting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} aria-hidden="true" />}
        {completed ? '확인 완료됨' : '확인했어요'}
      </button>
    );
  }

  if (item.item_type === 'approval') {
    return (
      <button type="button"
        onClick={() => void submitResponse({ content: '동의', is_approved: true })}
        disabled={submitting || completed}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50">
        {submitting ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} aria-hidden="true" />}
        {completed ? '동의 완료' : '동의합니다'}
      </button>
    );
  }

  if (item.item_type === 'feedback') {
    return (
      <div className="space-y-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          disabled={submitting || completed}
          placeholder="의견을 입력해 주세요."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50" />
        <button type="button"
          onClick={() => text.trim() && void submitResponse({ content: text.trim() })}
          disabled={submitting || completed || !text.trim()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-50">
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} aria-hidden="true" />}
          제출
        </button>
      </div>
    );
  }

  if (item.item_type === 'file_upload') {
    return (
      <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 cursor-pointer">
        <Upload size={12} aria-hidden="true" />
        파일 업로드 (현재 안내만 — Storage 연동은 다음 STEP)
        <input type="file" className="hidden" disabled />
      </label>
    );
  }

  return null;
}
