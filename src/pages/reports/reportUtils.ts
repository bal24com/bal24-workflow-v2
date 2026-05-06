// bal24 v2 — 결과보고서 자동 집계 + PDF 생성
//
// 박경수님 명세 수정사항 반영:
//  - issued_certificates / attendance: programs 먼저 조회 후 in('program_id', ids)
//  - expenses / income은 ledger_type='own', deleted_at IS NULL 필터

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '../../lib/supabase';
import type {
  Client, Expense, Income, Program, Project, ReportContent, StaffPool,
} from '../../types/database';

const PDF_STORAGE_BUCKET = 'certificates'; // 별도 버킷 없으므로 certificates 재사용

export function formatKoreanDate(value?: string | Date | null): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function formatMoney(n?: number | null): string {
  if (n == null) return '';
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

// ─── 집계 ────────────────────────────────────────────
export type AggregatedReport = {
  project: Project & { client?: Pick<Client, 'id' | 'name'> | null };
  programs: Pick<Program, 'id' | 'name' | 'start_date' | 'end_date'>[];
  attendanceCounts: Record<string, { sessions: number; checked: number }>; // program_id → 통계
  certCounts: { completion: number; lecture: number };
  expertHours: Map<string, number>;            // expert_id → log hours
  expertNames: Map<string, string>;
  expertCertCounts: Map<string, number>;       // expert_id → 강의확인서 발급 수
  expenseGross: number;
  expenseNet: number;
  incomeTotal: number;
};

export async function aggregateReportData(projectId: string): Promise<AggregatedReport> {
  // projects + client (단일 FK)
  const { data: projectData, error: projErr } = await supabase
    .from('projects')
    .select('*, client:clients(id,name)')
    .eq('id', projectId)
    .maybeSingle();
  if (projErr) throw new Error(projErr.message);
  if (!projectData) throw new Error('프로젝트를 찾을 수 없어요.');
  const project = projectData as Project & { client?: Pick<Client, 'id' | 'name'> | null };

  // programs
  const { data: progs, error: progErr } = await supabase
    .from('programs')
    .select('id, name, start_date, end_date')
    .eq('project_id', projectId)
    .order('start_date', { ascending: true });
  if (progErr) throw new Error(progErr.message);
  const programs = (progs ?? []) as Pick<Program, 'id' | 'name' | 'start_date' | 'end_date'>[];
  const programIds = programs.map((p) => p.id);

  // expenses / income / activity_logs / staff_pool / 출석 / 증서 — 병렬
  const [expR, incR, logR, expertR, sessR, certR] = await Promise.all([
    supabase.from('expenses')
      .select('account_code, gross_amount, net_amount')
      .eq('project_id', projectId)
      .eq('ledger_type', 'own')
      .is('deleted_at', null),
    supabase.from('income')
      .select('amount')
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase.from('activity_logs')
      .select('expert_id, duration_hours')
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase.from('staff_pool').select('id, name'),
    programIds.length > 0
      ? supabase.from('attendance_sessions')
          .select('id, program_id, attendance_records(id)')
          .in('program_id', programIds)
      : Promise.resolve({ data: [], error: null }),
    programIds.length > 0
      ? supabase.from('issued_certificates')
          .select('cert_type, expert_id, recipient_name')
          .in('program_id', programIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (expR.error) throw new Error(expR.error.message);
  if (incR.error) throw new Error(incR.error.message);
  if (logR.error) throw new Error(logR.error.message);
  if (expertR.error) console.error('[report] staff_pool 조회 실패:', expertR.error.message);
  if (sessR.error) console.error('[report] 출석 조회 실패:', sessR.error.message);
  if (certR.error) console.error('[report] 증서 조회 실패:', certR.error.message);

  const expenses = (expR.data ?? []) as Pick<Expense, 'account_code' | 'gross_amount' | 'net_amount'>[];
  const income = (incR.data ?? []) as Pick<Income, 'amount'>[];
  const logs = (logR.data ?? []) as { expert_id: string | null; duration_hours: number | null }[];
  const experts = (expertR.data ?? []) as Pick<StaffPool, 'id' | 'name'>[];
  const sessions = (sessR.data ?? []) as Array<{ id: string; program_id: string; attendance_records: { id: string }[] }>;
  const certs = (certR.data ?? []) as Array<{ cert_type: 'completion' | 'lecture'; expert_id: string | null; recipient_name: string }>;

  // 출석 집계: program_id별 세션수 + 체크인 수
  const attendanceCounts: Record<string, { sessions: number; checked: number }> = {};
  for (const p of programs) attendanceCounts[p.id] = { sessions: 0, checked: 0 };
  for (const s of sessions) {
    const acc = attendanceCounts[s.program_id] ?? { sessions: 0, checked: 0 };
    acc.sessions += 1;
    acc.checked += (s.attendance_records ?? []).length;
    attendanceCounts[s.program_id] = acc;
  }

  // 증서 집계
  const certCounts = { completion: 0, lecture: 0 };
  const expertCertCounts = new Map<string, number>();
  for (const c of certs) {
    if (c.cert_type === 'completion') certCounts.completion += 1;
    else certCounts.lecture += 1;
    if (c.expert_id) {
      expertCertCounts.set(c.expert_id, (expertCertCounts.get(c.expert_id) ?? 0) + 1);
    }
  }

  // 인력 시간
  const expertHours = new Map<string, number>();
  for (const l of logs) {
    if (!l.expert_id) continue;
    const h = Number(l.duration_hours ?? 0);
    if (!Number.isFinite(h)) continue;
    expertHours.set(l.expert_id, (expertHours.get(l.expert_id) ?? 0) + h);
  }
  const expertNames = new Map(experts.map((e) => [e.id, e.name]));

  // 예산
  const expenseGross = expenses.reduce((s, e) => s + Number(e.gross_amount ?? 0), 0);
  const expenseNet = expenses.reduce((s, e) => s + Number(e.net_amount ?? 0), 0);
  const incomeTotal = income.reduce((s, i) => s + Number(i.amount ?? 0), 0);

  return {
    project, programs, attendanceCounts, certCounts,
    expertHours, expertNames, expertCertCounts,
    expenseGross, expenseNet, incomeTotal,
  };
}

// ─── content 초안 빌드 ─────────────────────────────
export function buildReportContent(data: AggregatedReport): ReportContent {
  const { project } = data;
  const period = (project.start_date || project.end_date)
    ? `${formatKoreanDate(project.start_date)} ~ ${formatKoreanDate(project.end_date)}`
    : '미정';

  const programs = data.programs.map((p) => {
    const att = data.attendanceCounts[p.id] ?? { sessions: 0, checked: 0 };
    const completionCount = data.certCounts.completion;
    const rate = att.sessions > 0 ? Math.round((att.checked / att.sessions) * 10) / 10 : null;
    return {
      name: p.name,
      sessionCount: att.sessions,
      completionCount,
      attendanceRate: rate,
    };
  });

  const expertList = Array.from(data.expertHours.entries()).map(([id, hours]) => ({
    name: data.expertNames.get(id) ?? '미상',
    logHours: Math.round(hours * 10) / 10,
    certCount: data.expertCertCounts.get(id) ?? 0,
  })).sort((a, b) => b.logHours - a.logHours);

  const balance = data.incomeTotal - data.expenseGross;

  return {
    overview: {
      period,
      clientName: project.client?.name ?? '미지정',
      totalBudget: project.budget ?? null,
      description: project.description ?? '',
    },
    performance: {
      programs,
      summary: programs.length > 0
        ? `총 ${programs.length}개 프로그램 운영, 출석 세션 ${programs.reduce((s, p) => s + (p.sessionCount ?? 0), 0)}회, 수료 ${data.certCounts.completion}명`
        : '운영된 프로그램이 없어요.',
    },
    staff: {
      experts: expertList,
      summary: expertList.length > 0
        ? `총 ${expertList.length}명, 누적 ${expertList.reduce((s, e) => s + e.logHours, 0).toFixed(1)}시간`
        : '인력 투입 일지가 없어요.',
    },
    budget: {
      plannedTotal: project.budget ?? null,
      incomeTotal: data.incomeTotal,
      expenseGross: data.expenseGross,
      expenseNet: data.expenseNet,
      balance,
      summary: `예산 ${formatMoney(project.budget)} 대비 지출 ${formatMoney(data.expenseGross)} (잔액 ${formatMoney(balance)})`,
    },
    notes: '',
  };
}

// ─── PDF 생성 ─────────────────────────────────────
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildReportHTML(title: string, content: ReportContent, projectName: string): string {
  const o = content.overview ?? {};
  const p = content.performance ?? {};
  const s = content.staff ?? {};
  const b = content.budget ?? {};

  const programRows = (p.programs ?? []).map((pg) => `
    <tr>
      <td>${escape(pg.name ?? '')}</td>
      <td style="text-align:right;">${pg.sessionCount ?? 0}회</td>
      <td style="text-align:right;">${pg.attendanceRate != null ? pg.attendanceRate + '명/세션' : '–'}</td>
    </tr>
  `).join('');

  const expertRows = (s.experts ?? []).slice(0, 15).map((e) => `
    <tr>
      <td>${escape(e.name)}</td>
      <td style="text-align:right;">${e.logHours.toFixed(1)}h</td>
      <td style="text-align:right;">${e.certCount ?? 0}건</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Pretendard,sans-serif; color:#1e1b4b; line-height:1.6;">
      <h1 style="font-size:28px; font-weight:700; color:#7C3AED; border-bottom:3px solid #7C3AED; padding-bottom:8px; margin:0 0 16px 0;">${escape(title)}</h1>
      <p style="font-size:14px; color:#666; margin:0 0 24px 0;">${escape(projectName)}</p>

      <h2 style="font-size:18px; font-weight:600; color:#7C3AED; margin:24px 0 8px 0;">① 사업 개요</h2>
      <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <tr><td style="padding:6px 0; color:#666; width:120px;">기간</td><td>${escape(o.period ?? '')}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">고객사</td><td>${escape(o.clientName ?? '')}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">총예산</td><td>${escape(formatMoney(o.totalBudget))}</td></tr>
        ${o.description ? `<tr><td style="padding:6px 0; color:#666; vertical-align:top;">개요</td><td style="white-space:pre-wrap;">${escape(o.description)}</td></tr>` : ''}
      </table>

      <h2 style="font-size:18px; font-weight:600; color:#7C3AED; margin:24px 0 8px 0;">② 추진 실적</h2>
      <p style="font-size:13px; margin:0 0 8px 0; color:#444;">${escape(p.summary ?? '')}</p>
      ${programRows ? `<table style="width:100%; font-size:13px; border-collapse:collapse; border-top:1px solid #ddd;">
        <thead style="background:#f8f7ff;"><tr><th style="text-align:left; padding:6px;">프로그램</th><th style="text-align:right; padding:6px;">세션</th><th style="text-align:right; padding:6px;">출석</th></tr></thead>
        <tbody>${programRows}</tbody>
      </table>` : ''}

      <h2 style="font-size:18px; font-weight:600; color:#7C3AED; margin:24px 0 8px 0;">③ 인력 투입 현황</h2>
      <p style="font-size:13px; margin:0 0 8px 0; color:#444;">${escape(s.summary ?? '')}</p>
      ${expertRows ? `<table style="width:100%; font-size:13px; border-collapse:collapse; border-top:1px solid #ddd;">
        <thead style="background:#f8f7ff;"><tr><th style="text-align:left; padding:6px;">전문가</th><th style="text-align:right; padding:6px;">투입 시간</th><th style="text-align:right; padding:6px;">강의확인서</th></tr></thead>
        <tbody>${expertRows}</tbody>
      </table>` : ''}

      <h2 style="font-size:18px; font-weight:600; color:#7C3AED; margin:24px 0 8px 0;">④ 예산 집행 현황</h2>
      <table style="width:100%; font-size:13px; border-collapse:collapse;">
        <tr><td style="padding:6px 0; color:#666; width:120px;">계획 예산</td><td>${escape(formatMoney(b.plannedTotal))}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">수입 합계</td><td style="color:#10b981;">${escape(formatMoney(b.incomeTotal))}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">지출 (총액)</td><td style="color:#ef4444;">${escape(formatMoney(b.expenseGross))}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">실지급 합계</td><td>${escape(formatMoney(b.expenseNet))}</td></tr>
        <tr><td style="padding:6px 0; color:#666;">잔액 (수입-지출)</td><td style="font-weight:700; color:${(b.balance ?? 0) >= 0 ? '#10b981' : '#ef4444'};">${escape(formatMoney(b.balance))}</td></tr>
      </table>

      <h2 style="font-size:18px; font-weight:600; color:#7C3AED; margin:24px 0 8px 0;">⑤ 특이사항 및 성과</h2>
      <p style="font-size:13px; white-space:pre-wrap; color:#444; min-height:60px;">${escape(content.notes ?? '')}</p>

      <p style="margin-top:32px; text-align:right; font-size:12px; color:#999;">${escape(formatKoreanDate(new Date()))}</p>
    </div>
  `;
}

export async function generateReportPDF(
  title: string, content: ReportContent, projectName: string,
): Promise<Blob> {
  const container = document.createElement('div');
  container.style.cssText = `width:794px; padding:80px 60px; background:#fff; position:absolute; left:-9999px; top:0; box-sizing:border-box;`;
  container.innerHTML = buildReportHTML(title, content, projectName);
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const pdf = new jsPDF({ unit: 'px', format: 'a4', orientation: 'portrait' });
    const w = pdf.internal.pageSize.getWidth();
    // canvas 비율 유지하며 a4 가로 폭에 맞춤
    const ratio = canvas.height / canvas.width;
    const h = w * ratio;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

export async function uploadReportPDF(blob: Blob, projectId: string): Promise<string> {
  const path = `reports/${projectId}_${Date.now()}.pdf`;
  const { error } = await supabase.storage.from(PDF_STORAGE_BUCKET).upload(path, blob, {
    contentType: 'application/pdf', upsert: true,
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes('bucket not found')) throw new Error('파일 저장소(certificates)가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.');
    if (m.includes('row-level security')) throw new Error('PDF 업로드 권한이 없어요.');
    throw new Error('PDF 업로드 중 오류가 발생했어요.');
  }
  const { data: pub } = supabase.storage.from(PDF_STORAGE_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}
