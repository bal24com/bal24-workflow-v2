// bal24 v2 — 컨소시엄 탭6: 외부공유 (consortium_links 허브)

import { useCallback, useEffect, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import {
  Loader2, Plus,
} from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import EmptyState from '../../../components/EmptyState';
import {
  CONSORTIUM_LINK_TYPE,
  LINK_TYPE_LABEL,
  SHARE_ROLE_LINK_TYPES,
  type ConsortiumLink,
  type ConsortiumLinkType,
} from '../consortiumTypes';
import type { Program } from '../../../types/database';
import ShareLinkCard from '../../../components/shares/ShareLinkCard';
import type { SharedLink } from '../../shares/sharesUtils';

interface Props {
  consortiumId: string;
}

function buildPath(type: ConsortiumLinkType, token: string, consortiumId: string): string {
  const map: Record<ConsortiumLinkType, string> = {
    apply: `/apply/${token}`,
    invite: `/invite/${token}`,
    attend: `/attend/${token}`,
    certificate: `/cert/${token}`,
    portal: `/portal/consortium/${consortiumId}`,
    report: `/report/${token}`,
    settlement: `/settlement/${token}`,
    supporter:   `/share/supporter/${token}`,
    beneficiary: `/share/beneficiary/${token}`,
    team:        `/share/team/${token}`,
    staff:       `/share/staff/${token}`,
  };
  return map[type];
}

export default function ConLinksTab({ consortiumId }: Props) {
  const toast = useToast();
  const [links, setLinks] = useState<ConsortiumLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consortium_links')
        .select('*, consortiums(name)')
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

  const handleToggle = async (sharedLink: SharedLink) => {
    const linkId = sharedLink.id.replace('con-', '');
    const currentLink = links.find(l => l.id === linkId);
    if (!currentLink) return;

    const next = !currentLink.is_active;
    const { error } = await supabase
      .from('consortium_links')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', linkId);
    
    if (error) {
      console.error('[con-links] 활성 토글 실패:', error.message);
      toast.error('상태 변경 중 오류가 발생했어요.');
      return;
    }
    
    toast.success(next ? '링크를 활성화했어요.' : '링크를 비활성화했어요.');
    
    // 로컬 상태 즉시 반영
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, is_active: next } : l));
  };

  const sharedLinks = useMemo(() => {
    return links.map((link) => ({
      id: `con-${link.id}`,
      category: 'consortium' as const,
      label: link.label || LINK_TYPE_LABEL[link.link_type],
      subLabel: (link as any).consortiums?.name,
      token: link.token,
      path: link.url_path.replace(link.token, '').replace(/\/$/, ''),
      createdAt: link.created_at,
      status: link.is_active ? '활성' : '비활성',
      stats: { clicks: link.click_count, responses: link.response_count },
    }));
  }, [links]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">총 {links.length}개 외부 공유 링크</p>
        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1.5" />
          링크 생성
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
        </div>
      ) : sharedLinks.length === 0 ? (
        <EmptyState
          emoji="🔗"
          title="아직 생성된 링크가 없어요."
          description="신청·초대·출석·수료증·포털·보고서·정산 등 외부 공유 링크를 만들어 주세요."
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={14} className="mr-1.5" />
              링크 생성
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sharedLinks.map((shared) => (
            <ShareLinkCard
              key={shared.id}
              link={shared}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
        💡 일괄 발송 기능은 참여사별 담당자 이메일로 링크를 전송하며, 향후 업데이트될 예정입니다.
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
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value as ConsortiumLinkType)}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
          >
            <optgroup label="── 역할별 외부 포털 ──">
              {SHARE_ROLE_LINK_TYPES.map((t) => (
                <option key={t} value={t}>{LINK_TYPE_LABEL[t]}</option>
              ))}
            </optgroup>
            <optgroup label="── 기타 링크 ──">
              {CONSORTIUM_LINK_TYPE.filter((t) => !(SHARE_ROLE_LINK_TYPES as readonly string[]).includes(t)).map((t) => (
                <option key={t} value={t}>{LINK_TYPE_LABEL[t]}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <Input 
          label="라벨" 
          required 
          value={label} 
          onChange={(e) => setLabel(e.target.value)} 
          disabled={submitting}
          placeholder="예) 2026년 봄 캠프 신청 링크" 
        />
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">연결 프로그램 (선택)</label>
          <select 
            value={programId} 
            onChange={(e) => setProgramId(e.target.value)} 
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="">선택 없음</option>
            {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <Input 
          type="date" 
          label="만료일 (선택)" 
          value={expiresAt} 
          onChange={(e) => setExpiresAt(e.target.value)} 
          disabled={submitting}
          helperText="비워두면 무기한" 
        />
      </form>
    </Modal>
  );
}
