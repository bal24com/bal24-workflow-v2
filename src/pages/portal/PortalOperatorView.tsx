// 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE Phase 2 — 주관기관 외부 공유 뷰.
// 박경수님 2026-06-07 — 실시간 타임라인 및 갤러리 기능 구현 (activity_logs 연동).

import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, Phone, Calendar, BarChart3, Activity, Image as ImageIcon, MessageSquare, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import type { ProjectPortal } from './portalUtils';

interface OrgRow {
  id: string;
  org_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
}

interface ResponseRow {
  id: string;
  portal_id: string;
  beneficiary_org_id: string | null;
  org_name: string | null;
  answers: Record<string, any>;
  submitted_at: string;
}

interface ActivityFile {
  url: string;
  name: string;
  size?: number;
}

interface ActivityLogRow {
  id: string;
  title: string;
  content: string | null;
  activity_date: string;
  log_type: string;
  file_urls: ActivityFile[] | null;
  created_at: string;
}

interface Props {
  portal: ProjectPortal & { intro_title?: string; intro_content?: string };
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '대기', cls: 'bg-slate-100 text-slate-500' },
  submitted: { label: '제출', cls: 'bg-violet-100 text-violet-700' },
  confirmed: { label: '확정', cls: 'bg-emerald-100 text-emerald-700' },
};

export default function PortalOperatorView({ portal }: Props) {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'timeline' | 'gallery'>('status');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [oRes, rRes, lRes] = await Promise.all([
          supabase.from('portal_beneficiary_orgs').select('id, org_name, contact_name, contact_phone, status').eq('portal_id', portal.id).order('org_name'),
          supabase.from('portal_survey_responses').select('*').eq('portal_id', portal.id).order('submitted_at', { ascending: false }),
          supabase.from('activity_logs').select('id, title, content, activity_date, log_type, file_urls, created_at').eq('project_id', portal.project_id).is('deleted_at', null).order('activity_date', { ascending: false }),
        ]);

        if (cancelled) return;
        setOrgs((oRes.data ?? []) as OrgRow[]);
        setResponses((rRes.data ?? []) as ResponseRow[]);
        setLogs((lRes.data ?? []) as ActivityLogRow[]);
      } catch (err) {
        console.error('[PortalOperatorView] fetch 실패:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [portal.id, portal.project_id]);

  const submittedCount = orgs.filter((o) => o.status !== 'pending').length;
  const submissionRate = orgs.length > 0 ? Math.round((submittedCount / orgs.length) * 100) : 0;
  
  // 갤러리용 이미지 필터링
  const galleryImages = logs.flatMap(log => 
    (log.file_urls ?? [])
      .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
      .map(f => ({ ...f, logTitle: log.title, date: log.activity_date }))
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 상단 통합 헤더 */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wider">Operator Portal</span>
                <span className="text-xs text-slate-400 font-medium">BalanceDot WorkFlow</span>
              </div>
              <h1 className="text-2xl font-black text-[#1E1B4B] tracking-tight">{portal.title}</h1>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">실시간 사업 현황</span>
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-sm">데이터 연결됨</span>
              </div>
            </div>
          </div>
          {(portal.intro_title || portal.intro_content) && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              {portal.intro_title && <p className="text-sm font-bold text-slate-800 mb-1">{portal.intro_title}</p>}
              {portal.intro_content && <p className="text-xs text-slate-500 leading-relaxed">{portal.intro_content}</p>}
            </div>
          )}
        </div>

        {/* 핵심 KPI 대시보드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="전체 참여 기관" value={`${orgs.length}개`} Icon={BarChart3} tone="violet" />
          <KpiCard label="신청 완료율" value={`${submissionRate}%`} sub={`${submittedCount}개 기관 완료`} Icon={Activity} tone="emerald" progress={submissionRate} />
          <KpiCard label="현장 기록" value={`${logs.length}건`} sub="전체 활동 일지" Icon={ImageIcon} tone="cyan" />
        </div>

        {/* 탭 내비게이션 */}
        <div className="flex gap-2 p-1 bg-white rounded-2xl border border-violet-100 shadow-sm sticky top-4 z-10 overflow-x-auto">
          <TabButton active={activeTab === 'status'} onClick={() => setActiveTab('status')} label="기관별 현황" Icon={BarChart3} />
          <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} label="활동 타임라인" Icon={Activity} />
          <TabButton active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} label="현장 갤러리" Icon={ImageIcon} />
        </div>

        {/* 탭 콘텐츠 */}
        <div className="space-y-4">
          {activeTab === 'status' && (
            <section className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-400" /></div>
              ) : orgs.length === 0 ? (
                <EmptyState message="아직 등록된 수혜기관이 없어요." />
              ) : (
                <ul className="grid grid-cols-1 gap-3">
                  {orgs.map((o) => (
                    <OrgListItem key={o.id} org={o} responses={responses.filter((r) => r.beneficiary_org_id === o.id)}
                      isExpanded={expandedId === o.id} onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)} />
                  ))}
                </ul>
              )}
            </section>
          )}

          {activeTab === 'timeline' && (
            <section className="bg-white rounded-3xl border border-violet-100 p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-bold text-[#1E1B4B] flex items-center gap-2">
                <Activity size={20} className="text-violet-600" />
                최근 활동 내역
              </h2>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-400" /></div>
              ) : logs.length === 0 ? (
                <EmptyState message="아직 등록된 활동이 없어요." />
              ) : (
                <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                  {logs.map((log) => (
                    <div key={log.id} className="relative flex items-start gap-6 group">
                      <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white border-4 border-violet-50 text-violet-600 shadow-sm group-hover:scale-110 transition-transform">
                        <Clock size={16} />
                      </div>
                      <div className="flex-1 ml-12 bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-violet-200 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDateKo(log.activity_date)}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 uppercase">{log.log_type}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[#1E1B4B] mb-1">{log.title}</h3>
                        {log.content && <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{log.content}</p>}
                        {log.file_urls && log.file_urls.length > 0 && (
                          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
                            {log.file_urls.map((f, i) => (
                              <div key={i} className="flex-shrink-0 w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden">
                                {/\.(jpg|jpeg|png|webp|gif)$/i.test(f.name) ? (
                                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <ImageIcon size={16} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'gallery' && (
            <section className="bg-white rounded-3xl border border-violet-100 p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-bold text-[#1E1B4B] flex items-center gap-2">
                <ImageIcon size={20} className="text-cyan-600" />
                현장 사진 갤러리
              </h2>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-400" /></div>
              ) : galleryImages.length === 0 ? (
                <EmptyState message="아직 등록된 현장 사진이 없어요." />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {galleryImages.map((img, i) => (
                    <div key={i} className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                        <p className="text-[10px] font-bold text-white truncate">{img.logTitle}</p>
                        <p className="text-[9px] text-white/80">{formatDateKo(img.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, Icon, tone, progress }: { label: string; value: string; sub?: string; Icon: any; tone: 'violet' | 'emerald' | 'cyan'; progress?: number }) {
  const styles = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  }[tone];

  return (
    <div className={`bg-white rounded-3xl border ${styles.split(' ')[2]} p-5 shadow-sm space-y-3 transition-transform hover:-translate-y-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <div className={`p-2 rounded-xl ${styles.split(' ')[0]} ${styles.split(' ')[1]}`}>
          <Icon size={18} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-black text-[#1E1B4B] tabular-nums">{value}</div>
        {sub && <p className="text-[11px] text-slate-500 font-medium mt-0.5">{sub}</p>}
      </div>
      {progress != null && (
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${styles.split(' ')[1].replace('text-', 'bg-')}`} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, Icon }: { active: boolean; onClick: () => void; label: string; Icon: any }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
      active ? 'bg-violet-600 text-white shadow-md shadow-violet-200' : 'text-slate-500 hover:bg-slate-50'
    }`}>
      <Icon size={16} />
      {label}
    </button>
  );
}

function OrgListItem({ org, responses, isExpanded, onToggle }: { org: OrgRow; responses: ResponseRow[]; isExpanded: boolean; onToggle: () => void }) {
  const badge = STATUS_BADGE[org.status] ?? STATUS_BADGE.pending;
  return (
    <li className="bg-white rounded-2xl border border-violet-100 overflow-hidden shadow-sm hover:border-violet-200 transition-all">
      <button type="button" onClick={onToggle} className="w-full p-4 text-left flex items-center gap-4 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-black text-[#1E1B4B] truncate group-hover:text-violet-600 transition-colors">{org.org_name}</h3>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
            {org.contact_name && <span>{org.contact_name}</span>}
            {org.contact_phone && <span className="flex items-center gap-1"><Phone size={10} />{org.contact_phone}</span>}
          </div>
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-slate-300" /> : <ChevronDown size={18} className="text-slate-300" />}
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <MessageSquare size={12} /> 최근 신청 응답
            </h4>
            {responses.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">아직 제출된 응답이 없어요.</p>
            ) : (
              <div className="space-y-3">
                {responses.map((r) => (
                  <div key={r.id} className="text-xs space-y-1.5">
                    {Object.entries(r.answers).map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-slate-400 w-16 flex-shrink-0">{k}</span>
                        <span className="text-slate-700 font-semibold">{String(v)}</span>
                      </div>
                    ))}
                    <div className="pt-1 text-[10px] text-slate-300">{formatDateKo(r.submitted_at)} 제출됨</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300 mb-3">
        <BarChart3 size={24} />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}
