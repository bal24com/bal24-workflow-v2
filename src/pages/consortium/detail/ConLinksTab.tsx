// bal24 v2 — 컨소시엄 탭6: 외부공유 (consortium_links 허브)

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Loader2, Plus, Copy, Power, ExternalLink,
  GraduationCap, UserPlus, CheckSquare, Award, ShieldCheck, FileBarChart, CreditCard,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { BADGE_BASE } from '../../../utils/statusStyles';
import EmptyState from '../../../components/EmptyState';
import {
  CONSORTIUM_LINK_TYPE,
  LINK_TYPE_LABEL,
  type ConsortiumLink,
  type ConsortiumLinkType,
} from '../consortiumTypes';
import { buildFullUrl, dDayLabel, formatConDate } from '../consortiumUtils';
import type { Program } from '../../../types/database';

interface Props {
  consortiumId: string;
}

const TYPE_ICON: Record<ConsortiumLinkType, LucideIcon> = {
  apply: GraduationCap,
  invite: UserPlus,
  attend: CheckSquare,
  certificate: Award,
  portal: ShieldCheck,
  report: FileBarChart,
  settlement: CreditCard,
};

const TYPE_COLOR: Record<ConsortiumLinkType, string> = {
  apply: 'bg-violet-100 text-violet-700 border-violet-200',
  invite: 'bg-orange-100 text-orange-700 border-orange-200',
  attend: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  certificate: 'bg-amber-100 text-amber-700 border-amber-200',
  portal: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  report: 'bg-rose-100 text-rose-700 border-rose-200',
  settlement: 'bg-slate-200 text-slate-700 border-slate-300',
};

function buildPath(type: ConsortiumLinkType, token: string, consortiumId: string): string {
  const map: Record<ConsortiumLinkType, string> = {
    apply: `/apply/${token}`,
    invite: `/invite/${token}`,
    attend: `/attend/${token}`,
    certificate: `/cert/${token}`,
    portal: `/portal/consortium/${consortiumId}`,
    report: `/report/${token}`,
    settlement: `/settlement/${token}`,
  };
  return map[type];
}

export default function ConLinksTab({ consortiumId }: Props) {
  const toast = useToast();
  const [links, setLinks] = useState<ConsortiumLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consortium_links')
        .select('*')
        .eq('consortium_id', consortiumId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLinks((data as ConsortiumLink[] | null) ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[con-links] 조회 실패:', raw);
      toast.error('링크 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [consortiumId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchLinks();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchLinks]);

  const handleCopy = async (link: ConsortiumLink) => {
    const url = buildFullUrl(link.url_path);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
      toast.success('링크가 복사되었어요.');
    } else {
      toast.error('복사에 실패했어요. 직접 선택해서 복사해 주세요.');
    }
  };

  const handleToggle = async (link: ConsortiumLink) => {
    const next = !link.is_active;
    const { error } = await supabase
      .from('consortium_links')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', link.id);
    if (error) {
      console.error('[con-links] 활성 토글 실패:', error.message);
      toast.error('상태 변경 중 오류가 발생했어요.');
      return;
    }
    toast.success(next ? '링크를 활성화했어요.' : '링크를 비활성화했어요.');
    void fetchLinks();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">총 {links.length}개 외부 공유 링크</p>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
          + 링크 생성
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          emoji="🔗"
          title="아직 생성된 링크가 없어요."
          description="신청·초대·출석·수료증·포털·보고서·정산 등 외부 공유 링크를 만들어 주세요."
          action={
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              + 링크 생성
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {links.map((link) => {
            const Icon = TYPE_ICON[link.link_type];
            const isCopied = copiedId === link.id;
            const fullUrl = buildFullUrl(link.url_path);
            return (
              <article
                key={link.id}
                className={`rounded-2xl border bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2 ${
                  link.is_active ? 'border-violet-100' : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${TYPE_COLOR[link.link_type]}`}>
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className={`${BADGE_BASE} ${TYPE_COLOR[link.link_type]}`}>
                        {LINK_TYPE_LABEL[link.link_type]}
                      </span>
                      {!link.is_active && (
                        <span className={`${BADGE_BASE} bg-slate-100 text-slate-500 border-slate-300`}>비활성</span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-[#1E1B4B] truncate">{link.label ?? '(라벨 없음)'}</div>
                  </div>
                </div>

                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[10px] text-violet-600 font-mono truncate hover:underline"
                  title={fullUrl}
                >
                  {fullUrl}
                </a>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>클릭 {link.click_count}</span>
                  <span>응답 {link.response_count}</span>
                  <span>· {dDayLabel(link.expires_at)}</span>
                  {link.expires_at && <span className="text-slate-400">({formatConDate(link.expires_at)})</span>}
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopy(link)}
                    className={isCopied ? '!border-emerald-200 !text-emerald-700' : ''}
                  >
                    <Copy size={12} className="mr-1" aria-hidden="true" />
                    {isCopied ? '복사됨' : '복사'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleToggle(link)}
                    className={link.is_active ? '' : '!border-emerald-200 !text-emerald-700'}>
                    <Power size={12} className="mr-1" aria-hidden="true" />
                    {link.is_active ? '비활성화' : '활성화'}
                  </Button>
                  <a href={fullUrl} target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-violet-600 hover:underline inline-flex items-center gap-1 text-xs">
                    <ExternalLink size={12} aria-hidden="true" />
                    열기
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 italic">
        💡 일괄 발송 (참여사별 담당자 이메일) — 향후 Edge Function 연동 예정
      </p>

      {createOpen && (
        <CreateLinkModal
          consortiumId={consortiumId}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            void fetchLinks();
          }}
        />
      )}
    </div>
  );
}

interface CreateModalProps {
  consortiumId: string;
  onClose: () => void;
  onSaved: () => void;
}

function CreateLinkModal({ consortiumId, onClose, onSaved }: CreateModalProps) {
  const toast = useToast();
  const [linkType, setLinkType] = useState<ConsortiumLinkType>('apply');
  const [programId, setProgramId] = useState('');
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [programs, setPrograms] = useState<Pick<Program, 'id' | 'name'>[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from('programs').select('id, name').eq('consortium_id', consortiumId);
      if (cancelled) return;
      if (error) console.error('[con-links-create] 프로그램 조회 실패:', error.message);
      setPrograms((data as Pick<Program, 'id' | 'name'>[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, [consortiumId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('링크 라벨을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      // token은 DB default (encode(gen_random_bytes(16),'hex'))로 자동 생성 → 1차 INSERT 후 토큰 받아 url_path UPDATE
      const { data: created, error: insErr } = await supabase
        .from('consortium_links')
        .insert({
          consortium_id: consortiumId,
          program_id: programId || null,
          link_type: linkType,
          url_path: '/__pending__',
          label: label.trim(),
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        })
        .select('id, token')
        .single();
      if (insErr || !created) throw insErr ?? new Error('링크 생성 실패');
      const path = buildPath(linkType, created.token as string, consortiumId);
      const { error: updErr } = await supabase
        .from('consortium_links')
        .update({ url_path: path })
        .eq('id', created.id);
      if (updErr) throw updErr;
      toast.success('링크를 생성했어요.');
      onSaved();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[con-links-create] 저장 실패:', raw);
      toast.error('링크 생성 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="링크 생성"
      description="유형을 선택하면 외부 토큰이 자동 발급되며 URL 경로가 정해져요."
      size="brand"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="con-link-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="con-link-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">유형</label>
          <select value={linkType} onChange={(e) => setLinkType(e.target.value as ConsortiumLinkType)} disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary">
            {CONSORTIUM_LINK_TYPE.map((t) => (<option key={t} value={t}>{LINK_TYPE_LABEL[t]}</option>))}
          </select>
        </div>
        <Input label="라벨" required value={label} onChange={(e) => setLabel(e.target.value)} disabled={submitting}
          placeholder="예) 2026년 봄 캠프 신청 링크" />
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">연결 프로그램 (선택)</label>
          <select value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary">
            <option value="">선택 없음</option>
            {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <Input type="date" label="만료일 (선택)" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={submitting}
          helperText="비워두면 무기한" />
      </form>
    </Modal>
  );
}
