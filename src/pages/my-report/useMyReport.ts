// bal24 v2 — STEP-MEMBER-REPORT-PORTAL useMyReport 훅
// 로그인 MEMBER 의 합격 신청 → 사업실적보고서 자동 생성·로드·저장.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { isMissingTableError } from '../schedule/scheduleUtils';
import {
  DEFAULT_TARGETS, DEFAULT_EXPENDITURE_ITEMS,
  type PerformanceReport, type PerformanceTarget, type PerformanceExpenditureItem,
} from '../../types/performanceReport';

export interface MyApplicationContext {
  application_id: string;
  program_id: string | null;
  project_id: string | null;
  program_name: string | null;
  applicant_name: string | null;
}

interface JoinedApp {
  id: string;
  name: string | null;
  program_id: string | null;
  email: string;
  status: string;
  created_at: string;
  program?: { id: string; name: string | null; project_id: string | null }
         | { id: string; name: string | null; project_id: string | null }[]
         | null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export interface UseMyReportResult {
  loading: boolean;
  saving: boolean;
  tableMissing: boolean;
  noApplication: boolean;
  application: MyApplicationContext | null;
  report: PerformanceReport | null;
  targets: PerformanceTarget[];
  expItems: PerformanceExpenditureItem[];
  saveDraft: (fields: Partial<PerformanceReport>) => Promise<boolean>;
  saveTargets: (rows: PerformanceTarget[]) => Promise<boolean>;
  saveExpItems: (rows: PerformanceExpenditureItem[]) => Promise<boolean>;
  submitReport: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useMyReport(): UseMyReportResult {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [noApplication, setNoApplication] = useState(false);
  const [application, setApplication] = useState<MyApplicationContext | null>(null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [targets, setTargets] = useState<PerformanceTarget[]>([]);
  const [expItems, setExpItems] = useState<PerformanceExpenditureItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setTableMissing(false);
    setNoApplication(false);

    // 1) 로그인 사용자 이메일
    const email = user?.email?.toLowerCase();
    if (!email) {
      setNoApplication(true);
      setLoading(false);
      return;
    }

    // 2) 합격 신청 조회 (가장 최근 1건)
    const { data: appRow, error: appErr } = await supabase
      .from('participant_applications')
      .select(`
        id, name, program_id, email, status, created_at,
        program:programs!program_id(id, name, project_id)
      `)
      .eq('email', email)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appErr) {
      console.error('[my-report] 신청 조회 실패:', appErr.message);
      toast.error('내 신청 정보를 불러오지 못했어요.');
      setNoApplication(true);
      setLoading(false);
      return;
    }
    if (!appRow) {
      setNoApplication(true);
      setLoading(false);
      return;
    }
    const row = appRow as JoinedApp;
    const program = pickOne(row.program);
    const ctx: MyApplicationContext = {
      application_id: row.id,
      program_id: row.program_id,
      project_id: program?.project_id ?? null,
      program_name: program?.name ?? null,
      applicant_name: row.name,
    };
    setApplication(ctx);

    // 3) performance_reports 조회 → 없으면 자동 생성
    const { data: existing, error: reportErr } = await supabase
      .from('performance_reports')
      .select('*')
      .eq('application_id', ctx.application_id)
      .maybeSingle();

    if (reportErr) {
      if (isMissingTableError(reportErr.message)) {
        setTableMissing(true);
        setLoading(false);
        return;
      }
      console.error('[my-report] 보고서 조회 실패:', reportErr.message);
      toast.error('보고서를 불러오지 못했어요.');
      setLoading(false);
      return;
    }

    let reportRow: PerformanceReport | null = (existing as PerformanceReport | null) ?? null;
    if (!reportRow) {
      const { data: created, error: createErr } = await supabase
        .from('performance_reports')
        .insert({
          application_id: ctx.application_id,
          program_id: ctx.program_id,
          project_id: ctx.project_id,
          status: 'draft',
        })
        .select('*')
        .single();
      if (createErr || !created) {
        console.error('[my-report] 보고서 자동 생성 실패:', createErr?.message);
        toast.error('보고서 생성에 실패했어요.');
        setLoading(false);
        return;
      }
      reportRow = created as PerformanceReport;
    }
    setReport(reportRow);

    // 4) targets / expItems 조회 → 없으면 기본값 INSERT
    const reportId = reportRow.id;
    const [tRes, eRes] = await Promise.all([
      supabase.from('performance_targets').select('*').eq('report_id', reportId).order('sort_order'),
      supabase.from('performance_expenditure_items').select('*').eq('report_id', reportId).order('sort_order'),
    ]);
    if (tRes.error) console.error('[my-report] targets 조회 실패:', tRes.error.message);
    if (eRes.error) console.error('[my-report] expItems 조회 실패:', eRes.error.message);

    let initialTargets = ((tRes.data ?? []) as PerformanceTarget[]);
    let initialExp = ((eRes.data ?? []) as PerformanceExpenditureItem[]);
    if (initialTargets.length === 0) {
      const { data: inserted } = await supabase
        .from('performance_targets')
        .insert(DEFAULT_TARGETS.map((t) => ({ ...t, report_id: reportId })))
        .select('*');
      initialTargets = ((inserted ?? []) as PerformanceTarget[]);
    }
    if (initialExp.length === 0) {
      const { data: inserted } = await supabase
        .from('performance_expenditure_items')
        .insert(DEFAULT_EXPENDITURE_ITEMS.map((x) => ({ ...x, report_id: reportId })))
        .select('*');
      initialExp = ((inserted ?? []) as PerformanceExpenditureItem[]);
    }
    setTargets(initialTargets);
    setExpItems(initialExp);
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [load]);

  const saveDraft = useCallback(async (fields: Partial<PerformanceReport>): Promise<boolean> => {
    if (!report) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('performance_reports')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', report.id);
      if (error) {
        console.error('[my-report] 임시저장 실패:', error.message);
        toast.error('저장에 실패했어요.');
        return false;
      }
      setReport((p) => (p ? { ...p, ...fields } : p));
      toast.success('저장됐어요.');
      return true;
    } finally {
      setSaving(false);
    }
  }, [report, toast]);

  const saveTargets = useCallback(async (rows: PerformanceTarget[]): Promise<boolean> => {
    if (!report) return false;
    setSaving(true);
    try {
      // 단순 전략: 기존 전체 삭제 + 재INSERT (행 수 적음)
      const del = await supabase.from('performance_targets').delete().eq('report_id', report.id);
      if (del.error) {
        console.error('[my-report] targets 삭제 실패:', del.error.message);
        toast.error('목표성과 저장 실패.'); return false;
      }
      if (rows.length > 0) {
        const payload = rows.map((r, idx) => ({
          report_id: report.id,
          metric_name: r.metric_name,
          planned_value: r.planned_value,
          actual_value: r.actual_value,
          achievement_rate: r.achievement_rate,
          sort_order: idx,
        }));
        const ins = await supabase.from('performance_targets').insert(payload).select('*');
        if (ins.error) {
          console.error('[my-report] targets INSERT 실패:', ins.error.message);
          toast.error('목표성과 저장 실패.'); return false;
        }
        setTargets(((ins.data ?? []) as PerformanceTarget[]));
      } else {
        setTargets([]);
      }
      toast.success('목표성과를 저장했어요.');
      return true;
    } finally {
      setSaving(false);
    }
  }, [report, toast]);

  const saveExpItems = useCallback(async (rows: PerformanceExpenditureItem[]): Promise<boolean> => {
    if (!report) return false;
    setSaving(true);
    try {
      const del = await supabase.from('performance_expenditure_items').delete().eq('report_id', report.id);
      if (del.error) {
        console.error('[my-report] expItems 삭제 실패:', del.error.message);
        toast.error('비목별 집행내역 저장 실패.'); return false;
      }
      if (rows.length > 0) {
        const payload = rows.map((r, idx) => ({
          report_id: report.id,
          category: r.category,
          sub_category: r.sub_category,
          grant_budget: r.grant_budget,
          self_budget: r.self_budget,
          grant_executed: r.grant_executed,
          self_executed: r.self_executed,
          notes: r.notes,
          sort_order: idx,
        }));
        const ins = await supabase.from('performance_expenditure_items').insert(payload).select('*');
        if (ins.error) {
          console.error('[my-report] expItems INSERT 실패:', ins.error.message);
          toast.error('비목별 집행내역 저장 실패.'); return false;
        }
        setExpItems(((ins.data ?? []) as PerformanceExpenditureItem[]));
      } else {
        setExpItems([]);
      }
      toast.success('비목별 집행내역을 저장했어요.');
      return true;
    } finally {
      setSaving(false);
    }
  }, [report, toast]);

  const submitReport = useCallback(async (): Promise<boolean> => {
    if (!report) return false;
    if (!report.company_name?.trim()) { toast.error('기업명을 입력해 주세요.'); return false; }
    if (!report.manager_name?.trim()) { toast.error('담당자명을 입력해 주세요.'); return false; }
    if (targets.length === 0) { toast.error('목표성과를 1개 이상 입력해 주세요.'); return false; }
    if (expItems.length === 0) { toast.error('비목별 집행내역을 1개 이상 입력해 주세요.'); return false; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('performance_reports')
        .update({ status: 'submitted', submitted_at: now, updated_at: now })
        .eq('id', report.id);
      if (error) {
        console.error('[my-report] 제출 실패:', error.message);
        toast.error('제출에 실패했어요.'); return false;
      }
      setReport((p) => (p ? { ...p, status: 'submitted', submitted_at: now } : p));
      toast.success('보고서를 제출했어요.');
      return true;
    } finally {
      setSaving(false);
    }
  }, [report, targets, expItems, toast]);

  return {
    loading, saving, tableMissing, noApplication,
    application, report, targets, expItems,
    saveDraft, saveTargets, saveExpItems, submitReport,
    refresh: load,
  };
}
