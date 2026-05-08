// bal24 v2 — 수료증·강의확인서 발급 목록 + 일괄 발급

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Loader2, Settings, Download, ExternalLink } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import EmptyState from '../../components/EmptyState';
import {
  generateCertNumber,
  generateCertificatePDF,
  getNextCertSeq,
  uploadCertificatePDF,
} from './certificateUtils';
import { formatIssueDateKo } from '../../lib/certificatePdf';
import type {
  CertificateTemplate,
  CertificateType,
  FormApplication,
  IssuedCertificate,
  Program,
} from '../../types/database';
import CertificateTemplateModal from './CertificateTemplateModal';

type RecipientRow = {
  /** 수료증: form_application_id / 강의확인서: invitation.id (또는 staff_pool/profile id) */
  key: string;
  recipientType: 'student' | 'instructor';
  formApplicationId?: string;
  expertId?: string;
  recipientName: string;
  /** 이미 발급된 증서 (있으면) */
  issued?: IssuedCertificate;
};

type InvitationRow = {
  id: string;
  staff_pool_id?: string | null;
  profile_id?: string | null;
  name: string;
  status?: string | null;
};

export default function CertificatePage() {
  const [programs, setPrograms] = useState<Pick<Program, 'id' | 'name'>[]>([]);
  const [programId, setProgramId] = useState<string>('');
  const [tab, setTab] = useState<CertificateType>('completion');
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [issuedList, setIssuedList] = useState<IssuedCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const fetchPrograms = useCallback(async () => {
    const { data, error } = await supabase.from('programs').select('id, name').order('created_at', { ascending: false });
    if (error) {
      console.error('[cert] 프로그램 조회 실패:', error.message);
      return;
    }
    setPrograms(data ?? []);
    if (!programId && data && data.length > 0) setProgramId(data[0].id);
  }, [programId]);

  useEffect(() => { void fetchPrograms(); }, [fetchPrograms]);

  const fetchData = useCallback(async () => {
    if (!programId) { setLoading(false); return; }
    setLoading(true);
    setErrorMsg(null);
    try {
      const [tplR, issuedR] = await Promise.all([
        supabase.from('certificate_templates').select('*')
          .eq('program_id', programId)
          .eq('cert_type', tab),
        supabase.from('issued_certificates').select('*')
          .eq('program_id', programId)
          .eq('cert_type', tab),
      ]);
      if (tplR.error) throw tplR.error;
      if (issuedR.error) throw issuedR.error;
      setTemplates((tplR.data ?? []) as CertificateTemplate[]);
      const issued = (issuedR.data ?? []) as IssuedCertificate[];
      setIssuedList(issued);

      let rows: RecipientRow[] = [];
      if (tab === 'completion') {
        const { data: apps, error: appsErr } = await supabase
          .from('form_applications')
          .select('id, applicant_name, status, program_id')
          .eq('program_id', programId)
          .eq('status', '승인');
        if (appsErr) throw appsErr;
        rows = ((apps ?? []) as Pick<FormApplication, 'id' | 'applicant_name'>[])
          .filter((a) => a.applicant_name)
          .map((a) => {
            const found = issued.find((i) => i.form_application_id === a.id);
            return {
              key: `app-${a.id}`,
              recipientType: 'student' as const,
              formApplicationId: a.id,
              recipientName: a.applicant_name ?? '미상',
              issued: found,
            };
          });
      } else {
        // 강의확인서: 해당 프로그램의 수락된 강사만 (instructor_invitations.program_id 필터 + status='수락')
        const { data: invs, error: invsErr } = await supabase
          .from('instructor_invitations')
          .select('id, staff_pool_id, profile_id, name, status')
          .eq('program_id', programId)
          .eq('status', '수락')
          .order('created_at', { ascending: false });
        if (invsErr) throw invsErr;
        rows = ((invs ?? []) as InvitationRow[]).map((v) => {
          const expertId = v.staff_pool_id ?? null;
          const found = issued.find((i) => i.expert_id === expertId);
          return {
            key: `inv-${v.id}`,
            recipientType: 'instructor' as const,
            expertId: expertId ?? undefined,
            recipientName: v.name,
            issued: found,
          };
        });
      }
      setRecipients(rows);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[cert] 조회 실패:', raw);
      setErrorMsg('목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [programId, tab]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const defaultTemplate = useMemo(() => {
    return templates.find((t) => t.is_default) ?? templates[0] ?? null;
  }, [templates]);

  const programName = useMemo(() => {
    return programs.find((p) => p.id === programId)?.name ?? '';
  }, [programs, programId]);

  const issueOne = useCallback(async (row: RecipientRow): Promise<{ ok: boolean; reason?: string }> => {
    if (!defaultTemplate) return { ok: false, reason: '템플릿이 없어요. 먼저 템플릿 설정을 해 주세요.' };
    if (row.issued?.pdf_url) return { ok: true };

    try {
      const seq = await getNextCertSeq();
      const now = new Date();
      const certNumber = generateCertNumber(now, seq);
      const blob = await generateCertificatePDF({
        recipientName: row.recipientName,
        programName,
        issueDate: formatIssueDateKo(now.toISOString().slice(0, 10)),
        validHours: defaultTemplate.valid_hours,
        certNumber,
        institutionName: defaultTemplate.institution_name,
        signatureName: defaultTemplate.signature_name ?? '',
        sealImageUrl: defaultTemplate.seal_file_url,
        certType: tab,
      });
      const { pdfUrl } = await uploadCertificatePDF(blob, certNumber);

      const { error } = await supabase.from('issued_certificates').insert({
        template_id: defaultTemplate.id,
        program_id: programId,
        cert_type: tab,
        recipient_type: row.recipientType,
        form_application_id: row.formApplicationId ?? null,
        expert_id: row.expertId ?? null,
        recipient_name: row.recipientName,
        issue_date: now.toISOString().slice(0, 10),
        cert_number: certNumber,
        pdf_url: pdfUrl,
      });
      if (error) {
        if (error.message.toLowerCase().includes('row-level security')) {
          return { ok: false, reason: '발급 기록 저장 권한이 없어요.' };
        }
        return { ok: false, reason: '발급 기록 저장에 실패했어요.' };
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PDF 생성 실패';
      console.error('[cert] 발급 실패:', msg);
      return { ok: false, reason: msg };
    }
  }, [defaultTemplate, programName, programId, tab]);

  const handleIssueOne = async (row: RecipientRow) => {
    setGeneratingKey(row.key);
    setErrorMsg(null);
    const r = await issueOne(row);
    setGeneratingKey(null);
    if (!r.ok && r.reason) setErrorMsg(r.reason);
    else await fetchData();
  };

  const handleBulkIssue = async () => {
    if (!defaultTemplate) {
      setErrorMsg('템플릿이 없어요. 먼저 템플릿 설정을 해 주세요.'); return;
    }
    const targets = recipients.filter((r) => !r.issued?.pdf_url);
    if (targets.length === 0) { setErrorMsg('미발급 대상이 없어요.'); return; }
    if (!confirm(`${targets.length}명에게 일괄 발급할까요?`)) return;

    setBulkRunning(true);
    setErrorMsg(null);
    let success = 0;
    let failed = 0;
    for (const row of targets) {
      const r = await issueOne(row);
      if (r.ok) success += 1;
      else failed += 1;
    }
    setBulkRunning(false);
    if (failed > 0) setErrorMsg(`${success}건 성공 / ${failed}건 실패. 콘솔에서 상세 확인해 주세요.`);
    await fetchData();
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🏆</span>
        수료증
      </h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500">프로그램</label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-w-[14rem]"
          >
            <option value="">선택해 주세요</option>
            {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<Settings size={16} />} onClick={() => setTemplateModalOpen(true)}>
            템플릿 설정
          </Button>
          <Button
            variant="primary"
            leftIcon={<Award size={16} />}
            onClick={() => void handleBulkIssue()}
            loading={bulkRunning}
            disabled={!defaultTemplate || recipients.filter((r) => !r.issued).length === 0}
          >
            일괄 발급
          </Button>
        </div>
      </div>

      <nav role="tablist" aria-label="증서 유형" className="flex items-center gap-1 border-b border-slate-200">
        {([['completion', '수료증'], ['lecture', '강의확인서']] as const).map(([key, label]) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={['inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'].join(' ')}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {!defaultTemplate && programId && !loading && (
        <div className="rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning">
          이 프로그램의 {tab === 'completion' ? '수료증' : '강의확인서'} 템플릿이 없어요. 우측 상단 "템플릿 설정"으로 먼저 등록해 주세요.
        </div>
      )}

      {tab === 'lecture' && programId && !loading && recipients.length === 0 && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-500 text-center">
          이 프로그램에 수락된 강사가 없어요. 강사 초청 후 강사가 수락하면 여기에 표시돼요.
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            발급 대상 ({recipients.length}명) — 발급 완료 {issuedList.length}건
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted">
              <Loader2 size={16} className="animate-spin mr-2" />
              불러오는 중…
            </div>
          ) : recipients.length === 0 ? (
            <EmptyState
              emoji="🏆"
              title={tab === 'completion' ? '승인된 신청자가 없어요.' : '등록된 강사가 없어요.'}
              description={tab === 'completion' ? '폼 관리에서 신청 승인을 진행해 주세요.' : '프로그램 강사 초대를 진행해 주세요.'}
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">이름</th>
                  <th className="text-center px-4 py-2.5 font-semibold">상태</th>
                  <th className="text-left px-4 py-2.5 font-semibold">증서번호</th>
                  <th className="text-right px-4 py-2.5 font-semibold">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipients.map((r) => {
                  const issued = r.issued;
                  const isGenerating = generatingKey === r.key;
                  return (
                    <tr key={r.key} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-text">{r.recipientName}</td>
                      <td className="px-4 py-2.5 text-center">
                        {issued ? (
                          <Badge variant="success">발급 완료</Badge>
                        ) : (
                          <Badge variant="default">미발급</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted">
                        {issued?.cert_number ?? '–'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {issued?.pdf_url && (
                            <a
                              href={issued.pdf_url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
                            >
                              <ExternalLink size={12} />
                              미리보기
                            </a>
                          )}
                          {issued?.pdf_url ? (
                            <a
                              href={issued.pdf_url}
                              download
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            >
                              <Download size={12} />
                              다운로드
                            </a>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => void handleIssueOne(r)}
                              loading={isGenerating}
                              disabled={!defaultTemplate || bulkRunning}
                            >
                              PDF 발급
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <CertificateTemplateModal
        open={templateModalOpen}
        programs={programs}
        defaultProgramId={programId}
        template={null}
        onClose={() => setTemplateModalOpen(false)}
        onSaved={() => void fetchData()}
      />
    </div>
  );
}
