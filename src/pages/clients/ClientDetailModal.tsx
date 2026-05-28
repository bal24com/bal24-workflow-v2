// bal24 v2 — 고객사 상세 모달 (3탭: 기본정보 / 계좌정보 / 연계 프로젝트)

import { useEffect, useState } from 'react';
import {
  Building2, Phone, Mail, MapPin, FileText, Banknote, Briefcase, Loader2, ExternalLink, Trash2, Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { softDelete } from '../../lib/softDeleteUtils';
import { useToast } from '../../contexts/ToastContext';
import type { Client, ClientContact, ProjectStatus } from '../../types/database';

type TabKey = 'info' | 'bank' | 'projects';

interface ProjectRow {
  id: string;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
}

interface Props {
  open: boolean;
  client: Client | null;
  onClose: () => void;
  /** STEP-EXPERT-CRUD-FULL — 삭제 후 부모 목록 갱신 콜백 */
  onDeleted?: () => void;
}

// 박경수님 2026-05-28 STEP-CLIENT-TYPE-TAG — 한글 4종으로 통일
const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  주관기관: { bg: 'bg-violet-100', text: 'text-violet-700', label: '주관기관' },
  수혜기관: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: '수혜기관' },
  참여사:   { bg: 'bg-orange-100', text: 'text-orange-700', label: '참여사'   },
  거래처:   { bg: 'bg-slate-100',  text: 'text-slate-600',  label: '거래처'   },
};

function formatBusinessNumber(raw?: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length !== 10) return raw;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

const STATUS_TONE: Record<ProjectStatus, string> = {
  '제안': 'bg-slate-100 text-slate-600',
  '진행': 'bg-violet-100 text-violet-700',
  '정산': 'bg-orange-100 text-orange-700',
  '종료': 'bg-emerald-100 text-emerald-700',
};

export default function ClientDetailModal({ open, client, onClose, onDeleted }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('info');
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // STEP-EXPERT-CRUD-FULL — soft-delete (휴지통 30일 보관)
  async function handleDelete() {
    if (!client) return;
    if (!window.confirm(`"${client.name}" 고객사를 삭제할까요? 30일 후 자동으로 완전 삭제됩니다. (관리자 휴지통에서 복원 가능)`)) return;
    setDeleting(true);
    const err = await softDelete('clients', client.id);
    setDeleting(false);
    if (err) { toast.error(err); return; }
    toast.success('고객사를 휴지통으로 이동했어요.');
    onClose();
    onDeleted?.();
  }

  useEffect(() => {
    if (!open) return;
    setTab('info');
  }, [open]);

  useEffect(() => {
    if (!open || !client) return;
    let cancelled = false;
    setLoadingContacts(true);
    void (async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) console.error('[clients] 담당자 조회 실패:', error.message);
      setContacts((data as ClientContact[] | null) ?? []);
      setLoadingContacts(false);
    })();
    return () => { cancelled = true; };
  }, [open, client]);

  useEffect(() => {
    if (!open || !client || tab !== 'projects') return;
    let cancelled = false;
    setLoadingProjects(true);
    void (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[clients] 연계 프로젝트 조회 실패:', error.message);
      setProjects((data as ProjectRow[] | null) ?? []);
      setLoadingProjects(false);
    })();
    return () => { cancelled = true; };
  }, [open, client, tab]);

  if (!client) return null;
  // 박경수님 2026-05-28 STEP-CLIENT-TYPE-TAG — 한글 4종 기본값 '거래처'
  const typeKey = (client.client_type ?? '거래처') as string;
  const typeMeta = TYPE_BADGE[typeKey] ?? TYPE_BADGE['거래처'];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={client.name}
      description={client.business_name ?? undefined}
      footer={
        <Button
          variant="outline"
          leftIcon={<Trash2 size={14} />}
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="!border-rose-300 !text-rose-600 hover:!bg-rose-50"
        >
          {deleting ? '삭제 중…' : '삭제'}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeMeta.bg} ${typeMeta.text}`}>
            <Building2 size={12} aria-hidden="true" />
            {typeMeta.label}
          </span>
          {client.business_number && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              사업자 {formatBusinessNumber(client.business_number)}
            </span>
          )}
        </div>

        {/* 탭 */}
        <div className="inline-flex rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
          {([
            { value: 'info', label: '기본정보' },
            { value: 'bank', label: '계좌정보' },
            { value: 'projects', label: '연계 프로젝트' },
          ] as Array<{ value: TabKey; label: string }>).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                tab === t.value ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div className="space-y-3">
            <section className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4 space-y-2">
              <DetailRow icon={<FileText size={14} aria-hidden="true" />} label="법인명">
                {client.business_name ?? '미등록'}
              </DetailRow>
              <DetailRow icon={<Building2 size={14} aria-hidden="true" />} label="대표자">
                {client.ceo_name ?? client.representative ?? '미등록'}
              </DetailRow>
              <DetailRow icon={<Briefcase size={14} aria-hidden="true" />} label="업태/종목">
                {[client.business_type, client.business_item].filter(Boolean).join(' · ') || '미등록'}
              </DetailRow>
              {client.department && (
                <DetailRow icon={<Users size={14} aria-hidden="true" />} label="부서">
                  {client.department}
                </DetailRow>
              )}
              {client.phone && (
                <DetailRow icon={<Phone size={14} aria-hidden="true" />} label="대표 전화">
                  <a href={`tel:${client.phone}`} className="text-violet-700 hover:underline">{client.phone}</a>
                </DetailRow>
              )}
              {client.email && (
                <DetailRow icon={<Mail size={14} aria-hidden="true" />} label="대표 이메일">
                  <a href={`mailto:${client.email}`} className="text-violet-700 hover:underline">{client.email}</a>
                </DetailRow>
              )}
              {client.address && (
                <DetailRow icon={<MapPin size={14} aria-hidden="true" />} label="주소">
                  {client.address}
                </DetailRow>
              )}
            </section>

            {client.note && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">메모</h4>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.note}</p>
              </section>
            )}

            <section>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">담당자 ({contacts.length})</h4>
              {loadingContacts ? (
                <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-violet-400" aria-hidden="true" /></div>
              ) : contacts.length === 0 ? (
                <p className="text-sm text-slate-400 italic">담당자가 등록되지 않았어요.</p>
              ) : (
                <ul className="space-y-1.5">
                  {contacts.map((c) => (
                    <li key={c.id} className="rounded-xl border border-violet-100 bg-white p-3 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1E1B4B]">{c.name}</span>
                        {c.position && <span className="text-xs text-slate-500">{c.position}</span>}
                        {c.main_duties && <span className="text-xs text-slate-400">· {c.main_duties}</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        {c.phone_mobile && <span>📱 {c.phone_mobile}</span>}
                        {c.phone_office && <span>☎ {c.phone_office}</span>}
                        {c.email && <span>✉ {c.email}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === 'bank' && (
          <section className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4 space-y-2">
            <DetailRow icon={<Banknote size={14} aria-hidden="true" />} label="은행">
              {client.bank_name ?? '미등록'}
            </DetailRow>
            <DetailRow icon={<Banknote size={14} aria-hidden="true" />} label="계좌번호">
              {client.bank_account ?? '미등록'}
            </DetailRow>
            <DetailRow icon={<Banknote size={14} aria-hidden="true" />} label="예금주">
              {client.bank_holder ?? '미등록'}
            </DetailRow>
            {client.business_license_url && (
              <div className="pt-2 border-t border-violet-100">
                <a
                  href={client.business_license_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  사업자등록증 보기
                </a>
              </div>
            )}
          </section>
        )}

        {tab === 'projects' && (
          <section>
            {loadingProjects ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
              </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-8">연계된 프로젝트가 없어요.</p>
            ) : (
              <ul className="space-y-1.5">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/projects/${p.id}`}
                      onClick={onClose}
                      className="block rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm hover:border-violet-200 hover:bg-violet-50/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1E1B4B] flex-1 truncate">{p.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[p.status]}`}>
                          {p.status}
                        </span>
                      </div>
                      {(p.start_date || p.end_date) && (
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateKo(p.start_date)} ~ {formatDateKo(p.end_date)}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-violet-500 mt-0.5">{icon}</span>
      <span className="text-slate-500 w-20 shrink-0">{label}</span>
      <span className="text-slate-700 flex-1 min-w-0 break-words">{children}</span>
    </div>
  );
}
