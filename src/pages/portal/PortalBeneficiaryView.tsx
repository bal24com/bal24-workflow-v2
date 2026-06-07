// 박경수님 2026-06-07 STEP-PORTAL-BENEFICIARY-ENHANCE — 수혜기관(학교/기업) 고도화 포털.
// 대시보드(KPI) + 참가자 관리 + 행정 서류 보관함 + 신청 설문 통합.

import { useEffect, useState } from 'react';
import { 
  Loader2, CheckCircle2, FileText, Send, Users, 
  BarChart3, Clock, Download, Upload, ShieldCheck, 
  MessageSquare, Sparkles, Phone, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { ITEM_TYPE_LABEL, canAct } from './portalUtils';
import { FileDropZone } from '../../components/ui';
import { PORTAL_FILES_BUCKET } from './portalConstants';
import PortalBoardTab from './PortalBoardTab';

interface SurveyConfig {
  schedule_options?: string[];
  fields?: string[];
}

interface BeneficiaryOrg {
  id: string;
  portal_id: string;
  org_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  status: string;
}

interface PortalLite {
  id: string;
  project_id: string;
  title: string;
  intro_title: string | null;
  intro_content: string | null;
  survey_config: SurveyConfig | null;
}

interface ParticipantRow {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  created_at: string;
}

interface PortalItemRow {
  id: string;
  item_type: string;
  title: string | null;
  label: string | null;
  description: string | null;
  file_url: string | null;
  file_name: string | null;
  actionable_roles: string[] | null;
}

interface PortalResponseRow {
  id: string;
  item_id: string;
  content: string | null;
  file_url: string | null;
  is_approved: boolean | null;
  submitted_at: string;
}

interface Props {
  portal: PortalLite;
  org: BeneficiaryOrg;
  onStatusChange: (status: string) => void;
}

type TabKey = 'dashboard' | 'personnel' | 'documents' | 'board' | 'apply' | 'intro';

const STATUS_STEP = [
  { key: 'pending',   label: '신청 대기', desc: '사업 참여 신청을 준비 중입니다.' },
  { key: 'submitted', label: '심사 중',   desc: '제출하신 서류와 신청서를 검토하고 있습니다.' },
  { key: 'confirmed', label: '승인 완료', desc: '사업 참여가 최종 확정되었습니다.' },
];

export default function PortalBeneficiaryView({ portal, org, onStatusChange }: Props) {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // 데이터 상태
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [items, setItems] = useState<PortalItemRow[]>([]);
  const [responses, setResponses] = useState<PortalResponseRow[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);

  // 신청 폼 상태
  const submitted = org.status !== 'pending';
  const cfg = portal.survey_config ?? {};
  const scheduleOpts = cfg.schedule_options ?? [];
  const fields = (cfg.fields && cfg.fields.length > 0) ? cfg.fields : ['희망일정', '참여인원', '담당자명', '연락처'];

  const [answers, setAnswers] = useState<Record<string, string>>({
    희망일정: '',
    참여인원: '',
    담당자명: org.contact_name ?? '',
    연락처:   org.contact_phone ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [pRes, iRes, rRes, sRes] = await Promise.all([
          // 1) 소속 참가자 (조직명 매칭)
          supabase.from('participant_applications').select('id, name, phone, status, created_at').eq('organization', org.org_name).order('name'),
          // 2) 포털 아이템 (수혜기관 노출 대상)
          supabase.from('portal_items').select('*').eq('portal_id', portal.id).order('sort_order'),
          // 3) 포털 응답 (우리 조직의 응답만 필터링은 클라이언트에서 respondent_id 등으로 해야 하나, 현재 respondent_id 가 UUID 가 아닐 수 있어 전체 로드 후 필터링)
          supabase.from('portal_responses').select('*').order('submitted_at', { ascending: false }),
          // 4) 기존 설문 응답
          supabase.from('portal_survey_responses').select('*').eq('beneficiary_org_id', org.id).order('submitted_at', { ascending: false }),
        ]);

        if (cancelled) return;
        setParticipants((pRes.data ?? []) as ParticipantRow[]);
        setItems((iRes.data ?? []) as PortalItemRow[]);
        setResponses((rRes.data ?? []) as PortalResponseRow[]);
        setSurveyResponses(sRes.data ?? []);
      } catch (err) {
        console.error('[PortalBeneficiaryView] fetch 실패:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [portal.id, org.id, org.org_name]);

  function setAnswer(k: string, v: string) {
    setAnswers((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSurveySubmit() {
    setErr(null);
    for (const f of fields) {
      if (!String(answers[f] ?? '').trim()) {
        setErr(`'${f}' 항목을 입력해 주세요.`);
        return;
      }
    }
    setSubmitting(true);
    const payload: Record<string, string> = {};
    fields.forEach((f) => { payload[f] = String(answers[f] ?? '').trim(); });

    const { error: rErr } = await supabase.from('portal_survey_responses').insert({
      portal_id: portal.id,
      beneficiary_org_id: org.id,
      org_name: org.org_name,
      answers: payload,
    });
    if (rErr) {
      setSubmitting(false);
      setErr('신청 제출에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }

    await supabase.from('portal_beneficiary_orgs').update({ status: 'submitted' }).eq('id', org.id);
    
    setSubmitting(false);
    setSubmitSuccess(true);
    onStatusChange('submitted');
    setTab('dashboard'); // 제출 후 대시보드로 이동
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Loader2 size={28} className="animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
      {/* 고정 상단 헤더 */}
      <header className="bg-white border-b border-violet-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[9px] font-black uppercase">Beneficiary Portal</span>
              <span className="text-[10px] text-slate-400 font-bold">{org.org_name}</span>
            </div>
            <h1 className="text-lg font-black text-[#1E1B4B] truncate max-w-[200px] sm:max-w-md">{portal.title}</h1>
          </div>
          <div className={`px-3 py-1 rounded-full text-[11px] font-bold ${
            org.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : 
            org.status === 'submitted' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {org.status === 'confirmed' ? '승인 완료' : org.status === 'submitted' ? '심사 중' : '진행 대기'}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
        {/* 탭 내비게이션 */}
        <div className="flex gap-1.5 p-1 bg-white rounded-2xl border border-violet-100 shadow-sm overflow-x-auto">
          <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} label="홈" Icon={BarChart3} />
          <TabButton active={tab === 'board'} onClick={() => setTab('board')} label="게시판" Icon={MessageSquare} />
          <TabButton active={tab === 'personnel'} onClick={() => setTab('personnel')} label="소속 인원" Icon={Users} />
          <TabButton active={tab === 'documents'} onClick={() => setTab('documents')} label="서류 보관함" Icon={FileText} />
          {!submitted && <TabButton active={tab === 'apply'} onClick={() => setTab('apply')} label="신청하기" Icon={Send} />}
          <TabButton active={tab === 'intro'} onClick={() => setTab('intro')} label="안내" Icon={Clock} />
        </div>

        {/* 탭 콘텐츠 */}
        <main className="space-y-6">
          {tab === 'board' && (
            <PortalBoardTab 
              portalId={portal.id} 
              beneficiaryOrgId={org.id} 
              authorName={org.org_name} 
              authorRole="beneficiary_org" 
            />
          )}

          {tab === 'dashboard' && (
            <div className="space-y-6">
              {/* 진행 단계 트래커 */}
              <div className="bg-white rounded-3xl border border-violet-100 p-6 sm:p-8 shadow-sm">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">진행 상황</h2>
                <div className="relative flex justify-between">
                  <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-100 -z-0" />
                  {STATUS_STEP.map((step, idx) => {
                    const isDone = (org.status === 'confirmed') || (org.status === 'submitted' && idx <= 1) || (org.status === 'pending' && idx === 0);
                    const isCurrent = (org.status === step.key) || (org.status === 'confirmed' && idx === 2);
                    return (
                      <div key={step.key} className="relative z-10 flex flex-col items-center text-center max-w-[100px]">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isDone ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-200 text-slate-300'
                        }`}>
                          {isDone ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                        </div>
                        <span className={`mt-2 text-xs font-bold ${isCurrent ? 'text-violet-700' : 'text-slate-500'}`}>{step.label}</span>
                        {isCurrent && <p className="text-[10px] text-slate-400 mt-1 hidden sm:block">{step.desc}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* KPI 요약 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard label="소속 인원" value={`${participants.length}명`} Icon={Users} tone="violet" />
                <KpiCard label="제출 서류" value={`${responses.length}건`} sub={`전체 ${items.filter(i => i.item_type === 'file_upload').length}건 중`} Icon={FileText} tone="cyan" />
                <KpiCard label="사업 안내" value={portal.intro_title || '진행 중'} Icon={Clock} tone="emerald" />
              </div>

              {/* 최근 응답 (설문) */}
              {surveyResponses.length > 0 && (
                <div className="bg-white rounded-3xl border border-violet-100 p-6 shadow-sm">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">나의 신청 정보</h3>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="space-y-2">
                      {Object.entries(surveyResponses[0].answers).map(([k, v]) => (
                        <div key={k} className="flex text-sm">
                          <span className="w-20 text-slate-400 flex-shrink-0">{k}</span>
                          <span className="font-bold text-slate-700">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'personnel' && (
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-violet-50 flex items-center justify-between gap-4">
                <h2 className="text-lg font-black text-[#1E1B4B]">소속 참가자 명단</h2>
                <span className="text-xs font-bold text-slate-400">{participants.length}명</span>
              </div>
              {participants.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <Users size={40} className="mx-auto text-slate-200" />
                  <p className="text-sm text-slate-400">아직 등록된 인원이 없어요.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3">이름</th>
                        <th className="px-6 py-3">연락처</th>
                        <th className="px-6 py-3">상태</th>
                        <th className="px-6 py-3">신청일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {participants.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-700">{p.name}</td>
                          <td className="px-6 py-4 text-slate-500 font-medium">{p.phone || '-'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              p.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                              p.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {p.status === 'accepted' ? '승인' : p.status === 'rejected' ? '반려' : '대기'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[11px] text-slate-400">{formatDateKo(p.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl border border-violet-100 p-6 shadow-sm">
                <h2 className="text-lg font-black text-[#1E1B4B] mb-1">행정 서류 보관함</h2>
                <p className="text-xs text-slate-500">사업 운영에 필요한 서류를 제출하거나 안내문을 다운로드하세요.</p>
              </div>
              <ul className="space-y-3">
                {items.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center text-sm text-slate-400">
                    등록된 항목이 없어요.
                  </div>
                ) : (
                  items.map((item) => (
                    <ItemCard 
                      key={item.id} 
                      item={item} 
                      org={org}
                      responses={responses.filter(r => r.item_id === item.id)} 
                      onSaved={(r) => setResponses(prev => [r, ...prev])}
                    />
                  ))
                )}
              </ul>
            </div>
          )}

          {tab === 'apply' && (
            <div className="bg-white rounded-3xl border border-violet-100 p-6 sm:p-8 shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-black text-[#1E1B4B]">사업 참여 신청</h2>
                <p className="text-xs text-slate-500">기본 정보를 입력하여 신청을 완료해 주세요.</p>
              </div>
              
              <div className="space-y-4">
                {fields.map((f) => {
                  if (f === '희망일정' && scheduleOpts.length > 0) {
                    return (
                      <div key={f}>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">{f} *</label>
                        <select value={answers[f] ?? ''} onChange={(e) => setAnswer(f, e.target.value)}
                          className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm bg-white outline-none focus:border-violet-500 shadow-sm transition-all">
                          <option value="">선택해 주세요</option>
                          {scheduleOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    );
                  }
                  return (
                    <div key={f}>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">{f} *</label>
                      <input type="text" value={answers[f] ?? ''} onChange={(e) => setAnswer(f, e.target.value)}
                        placeholder={f === '연락처' ? '예) 010-1234-5678' : `${f} 입력`}
                        className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-violet-500 shadow-sm transition-all" />
                    </div>
                  );
                })}
                {err && (
                  <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 font-medium">{err}</p>
                )}
                <button type="button" onClick={() => void handleSurveySubmit()} disabled={submitting}
                  className="w-full h-12 rounded-2xl bg-violet-600 text-white font-black hover:bg-violet-700 disabled:opacity-50 shadow-lg shadow-violet-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  {submitting && <Loader2 size={18} className="animate-spin" />}
                  신청서 제출하기
                </button>
              </div>
            </div>
          )}

          {tab === 'intro' && (
            <div className="bg-white rounded-3xl border border-violet-100 p-6 sm:p-8 shadow-sm space-y-4">
              <h2 className="text-lg font-black text-[#1E1B4B]">{portal.intro_title || '안내 사항'}</h2>
              {portal.intro_content ? (
                <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  {portal.intro_content}
                </div>
              ) : (
                <div className="p-12 text-center text-slate-300 italic text-sm">관리자가 안내 내용을 등록하지 않았어요.</div>
              )}
            </div>
          )}
        </main>
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
    <div className={`bg-white rounded-3xl border border-violet-50 p-5 shadow-sm space-y-3 transition-transform hover:-translate-y-1`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <div className={`p-2 rounded-xl ${styles}`}>
          <Icon size={18} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-black text-[#1E1B4B] tracking-tight">{value}</div>
        {sub && <p className="text-[11px] text-slate-500 font-medium mt-0.5">{sub}</p>}
      </div>
      {progress != null && (
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-violet-600" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, Icon }: { active: boolean; onClick: () => void; label: string; Icon: any }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all whitespace-nowrap ${
      active ? 'bg-violet-600 text-white shadow-md shadow-violet-100' : 'text-slate-500 hover:bg-slate-50'
    }`}>
      <Icon size={16} />
      {label}
    </button>
  );
}

function ItemCard({ 
  item, org, responses, onSaved 
}: { 
  item: PortalItemRow; 
  org: BeneficiaryOrg;
  responses: PortalResponseRow[]; 
  onSaved: (r: PortalResponseRow) => void 
}) {
  const [submitting, setSubmitting] = useState(false);
  const title = item.title ?? item.label ?? '(제목 없음)';
  const completed = responses.length > 0;

  async function submitAction(payload: Partial<PortalResponseRow>) {
    setSubmitting(true);
    // respondent_id 는 수혜기관 ID 로 고정
    const { data, error } = await supabase
      .from('portal_responses')
      .insert({
        item_id: item.id,
        portal_role: 'beneficiary_org',
        respondent_id: org.id,
        response_type: payload.is_approved != null ? 'approval' : (payload.file_url ? 'file' : 'feedback'),
        ...payload,
      })
      .select('*')
      .single();
    setSubmitting(false);
    if (error) {
      alert('제출 중 오류가 발생했어요.');
      return;
    }
    if (data) onSaved(data as PortalResponseRow);
  }

  const handleFileUpload = async (file: File) => {
    setSubmitting(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const path = `portal-responses/${org.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: upErr } = await supabase.storage
        .from(PORTAL_FILES_BUCKET)
        .upload(path, file);
      
      if (upErr) throw upErr;
      
      const { data: { publicUrl } } = supabase.storage
        .from(PORTAL_FILES_BUCKET)
        .getPublicUrl(path);

      await submitAction({ file_url: publicUrl, content: file.name });
    } catch (err) {
      console.error('File upload failed:', err);
      alert('파일 업로드에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li className="bg-white rounded-2xl border border-violet-100 p-5 space-y-4 hover:border-violet-300 transition-colors shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-tighter">
              {ITEM_TYPE_LABEL[item.item_type] || item.item_type}
            </span>
            {completed && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                <CheckCircle2 size={12} /> 완료됨
              </span>
            )}
          </div>
          <h4 className="text-sm font-black text-[#1E1B4B]">{title}</h4>
          {item.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>}
        </div>
      </div>

      <div className="pt-2">
        {item.item_type === 'file_download' && item.file_url && (
          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
            onClick={() => !completed && void submitAction({ content: '다운로드' })}
            className="w-full h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between px-4 text-xs font-bold text-violet-700 hover:bg-violet-50 transition-colors">
            <span className="flex items-center gap-2 truncate pr-4 text-slate-600">
              <FileText size={14} className="text-slate-400" />
              {item.file_name || '안내 파일 다운로드'}
            </span>
            <Download size={14} />
          </a>
        )}

        {item.item_type === 'file_upload' && (
          <div className="space-y-2">
            <FileDropZone
              uploading={submitting}
              onFileSelected={handleFileUpload}
              fileUrl={responses[0]?.file_url ?? null}
              fileName={responses[0]?.content ?? null}
              disabled={submitting}
              onClear={() => {}} // 기존 응답 삭제 로직은 복잡하므로 일단 비워둠
            />
          </div>
        )}

        {item.item_type === 'approval' && (
          <button type="button" onClick={() => void submitAction({ is_approved: true, content: '동의' })}
            disabled={submitting || completed}
            className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
              completed ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-600 text-white shadow-lg shadow-violet-100'
            }`}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {completed ? '동의 완료됨' : '내용을 확인하고 동의합니다'}
          </button>
        )}

        {item.item_type === 'feedback' && (
          <FeedbackAction 
            completed={completed} 
            submitting={submitting} 
            lastResponse={responses[0]?.content}
            onSubmit={(txt) => submitAction({ content: txt })} 
          />
        )}
      </div>
    </li>
  );
}

function FeedbackAction({ 
  completed, submitting, lastResponse, onSubmit 
}: { 
  completed: boolean; 
  submitting: boolean; 
  lastResponse?: string | null;
  onSubmit: (txt: string) => void 
}) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-2">
      {completed ? (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
          <p className="font-bold mb-1 text-slate-400">나의 의견:</p>
          {lastResponse}
        </div>
      ) : (
        <>
          <textarea 
            value={text} onChange={(e) => setText(e.target.value)} rows={3}
            disabled={submitting}
            placeholder="의견을 입력해 주세요."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50" 
          />
          <button type="button"
            onClick={() => text.trim() && onSubmit(text.trim())}
            disabled={submitting || !text.trim()}
            className="w-full h-10 rounded-xl bg-violet-600 text-white text-xs font-bold flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            의견 제출하기
          </button>
        </>
      )}
    </div>
  );
}
