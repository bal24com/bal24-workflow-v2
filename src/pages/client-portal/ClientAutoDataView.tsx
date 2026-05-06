// bal24 v2 — 포털 auto_data 항목 렌더
// 4종: applications / attendance / curriculum / report
// programs 먼저 조회 후 in() 패턴 (박경수님 명세)

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import type { PortalAutoDataKey } from '../../types/database';

type Props = {
  projectId: string;
  dataKey: PortalAutoDataKey;
};

type Row = Record<string, unknown>;

export default function ClientAutoDataView({ projectId, dataKey }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    (async () => {
      try {
        // programs IDs 먼저 조회
        const { data: progs, error: progErr } = await supabase
          .from('programs').select('id').eq('project_id', projectId);
        if (progErr) throw progErr;
        const programIds = (progs ?? []).map((p) => p.id);

        if (dataKey === 'applications') {
          const { data, error } = await supabase
            .from('form_applications')
            .select('applicant_name, applicant_phone, applicant_email, status, submitted_at')
            .eq('program_id', projectId);
          if (error) throw error;
          if (!cancelled) setRows((data ?? []) as Row[]);
        } else if (dataKey === 'attendance') {
          if (programIds.length === 0) { if (!cancelled) setRows([]); return; }
          const { data, error } = await supabase
            .from('attendance_records')
            .select('attendee_name, attendee_role, check_in_at, attendance_sessions!inner(program_id, title)')
            .in('attendance_sessions.program_id', programIds)
            .order('check_in_at', { ascending: false });
          if (error) throw error;
          if (!cancelled) setRows((data ?? []) as Row[]);
        } else if (dataKey === 'curriculum') {
          if (programIds.length === 0) { if (!cancelled) setRows([]); return; }
          const { data, error } = await supabase
            .from('attendance_sessions')
            .select('title, session_date, location')
            .in('program_id', programIds)
            .order('session_date');
          if (error) throw error;
          if (!cancelled) setRows((data ?? []) as Row[]);
        } else if (dataKey === 'report') {
          const { data, error } = await supabase
            .from('project_reports')
            .select('title, status, pdf_url, submitted_at')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          if (!cancelled) setRows((data ?? []) as Row[]);
        }
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[client-portal] auto_data 조회 실패:', raw);
        setErrorMsg('데이터를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, dataKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted">
        <Loader2 size={14} className="animate-spin mr-2" />
        불러오는 중…
      </div>
    );
  }
  if (errorMsg) {
    return <div role="alert" className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-2">{errorMsg}</div>;
  }
  if (rows.length === 0) {
    return <p className="text-xs text-muted text-center py-4">아직 데이터가 없어요.</p>;
  }

  if (dataKey === 'applications') {
    return (
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr>
            <th className="text-left px-2 py-1.5 font-semibold">이름</th>
            <th className="text-left px-2 py-1.5 font-semibold">전화</th>
            <th className="text-center px-2 py-1.5 font-semibold">상태</th>
            <th className="text-left px-2 py-1.5 font-semibold">신청일</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5 font-semibold text-text">{String(r.applicant_name ?? '–')}</td>
                <td className="px-2 py-1.5 text-muted">{String(r.applicant_phone ?? '–')}</td>
                <td className="px-2 py-1.5 text-center text-muted">{String(r.status ?? '–')}</td>
                <td className="px-2 py-1.5 text-muted">{formatDateKo(String(r.submitted_at ?? ''))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (dataKey === 'attendance') {
    return (
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr>
            <th className="text-left px-2 py-1.5 font-semibold">참여자</th>
            <th className="text-left px-2 py-1.5 font-semibold">역할</th>
            <th className="text-left px-2 py-1.5 font-semibold">체크인</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-2 py-1.5 font-semibold text-text">{String(r.attendee_name ?? '–')}</td>
                <td className="px-2 py-1.5 text-muted">{String(r.attendee_role ?? '–')}</td>
                <td className="px-2 py-1.5 text-muted">{new Date(String(r.check_in_at ?? '')).toLocaleString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (dataKey === 'curriculum') {
    return (
      <ul className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center justify-between text-xs px-3 py-2 bg-slate-50 rounded-lg">
            <span className="font-semibold text-text">{String(r.title ?? '–')}</span>
            <span className="text-muted">{formatDateKo(String(r.session_date ?? ''))} · {String(r.location ?? '–')}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between text-xs px-3 py-2 bg-slate-50 rounded-lg">
          <span className="font-semibold text-text">{String(r.title ?? '–')}</span>
          <span className="flex items-center gap-2">
            <span className="text-muted">{String(r.status ?? '–')}</span>
            {r.pdf_url ? (
              <a href={String(r.pdf_url)} target="_blank" rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 text-primary hover:underline">
                <ExternalLink size={10} />PDF
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
