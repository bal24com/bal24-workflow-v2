// bal24 v2 — STEP-MEMBER-PERFORMANCE-REPORT MEMBER 사업보고 탭
// 프로그램 상세 진입 — 본인의 performance_report 작성 (5섹션) + 제출.
// /my-report 와 동일 데이터, 다른 진입점.

import {
  Loader2, FileText, ShieldAlert, CheckCircle2, Send, AlertTriangle,
} from 'lucide-react';
import { Button } from '../../../components/ui';
import { useMyReport } from '../../my-report/useMyReport';
import { notifyReportSubmittedToPM } from '../../../lib/notifyUtils';
import { REPORT_STATUS_LABELS } from '../../../types/performanceReport';
import ReportBasicSection from '../../my-report/ReportBasicSection';
import ReportTargetSection from '../../my-report/ReportTargetSection';
import ReportExpItemSection from '../../my-report/ReportExpItemSection';
import ReportAchievementSection from '../../my-report/ReportAchievementSection';
import GrantExpenditureSection from './GrantExpenditureSection';

interface Props {
  programId: string;
}

export default function PerformanceReportTab({ programId }: Props) {
  const {
    loading, saving, tableMissing, noApplication,
    application, report, targets, expItems,
    saveDraft, saveTargets, saveExpItems, submitReport,
  } = useMyReport(programId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-bold">보고서 테이블이 아직 만들어지지 않았어요.</p>
        <p className="mt-1 text-xs">관리자가 SQL 마이그레이션을 실행하면 사용할 수 있어요.</p>
      </div>
    );
  }

  if (noApplication) {
    return (
      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
        <ShieldAlert size={28} className="mx-auto text-amber-400" aria-hidden="true" />
        <p className="text-base font-bold text-[#1E1B4B]">이 프로그램에 합격된 신청이 없어요</p>
        <p className="text-sm text-slate-500">
          이 프로그램의 합격 처리된 신청이 있어야 보고서를 작성할 수 있어요.
          <br />
          담당자에게 문의해 주세요.
        </p>
      </div>
    );
  }

  if (!report || !application) return null;

  const isSubmitted = report.status === 'submitted';
  const isApproved = report.status === 'approved';
  const isRejected = report.status === 'rejected';
  const readOnly = isSubmitted || isApproved;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* 헤더 */}
      <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">사업실적보고서</p>
            <h2 className="mt-1 text-lg font-bold text-[#1E1B4B] flex items-center gap-2">
              <FileText size={18} className="text-violet-600" aria-hidden="true" />
              {application.program_name ?? '프로그램'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {application.applicant_name ?? '신청자'} · 작성·제출
            </p>
          </div>
          {/* CLAUDE.md 디자인 시스템: 회색/바이올렛/주황/민트 */}
          <span className={[
            'text-[11px] font-semibold px-2 py-1 rounded-md border',
            isApproved ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
            : isSubmitted ? 'bg-violet-50 text-violet-700 border-violet-200'
            : isRejected ? 'bg-orange-50 text-orange-700 border-orange-200'
            : 'bg-slate-100 text-slate-700 border-slate-200',
          ].join(' ')}>
            {REPORT_STATUS_LABELS[report.status]}
          </span>
        </div>
      </header>

      {/* 상태 안내 */}
      {isSubmitted && (
        <div className="rounded-xl bg-violet-50 border border-violet-100 px-4 py-3 text-sm text-violet-900 flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden="true" />
          제출 완료된 보고서예요. PM 검토 중이에요.
        </div>
      )}
      {isApproved && (
        <div className="rounded-xl bg-cyan-50 border border-cyan-100 px-4 py-3 text-sm text-cyan-900 flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden="true" />
          승인 완료된 보고서예요.
        </div>
      )}
      {isRejected && (
        <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 text-sm text-orange-900 space-y-1">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" />
            반려된 보고서예요. 사유를 확인하고 수정 후 재제출해 주세요.
          </p>
          {report.reject_reason && (
            <p className="text-xs whitespace-pre-wrap pl-6">{report.reject_reason}</p>
          )}
        </div>
      )}

      {/* 5 섹션 — ① 정산총괄 ② 목표 ③ 비목별 ④ 지출증빙(자동) ⑤ 사업성과+사진 */}
      <ReportBasicSection report={report} readOnly={readOnly} saving={saving} onSave={saveDraft} />
      <ReportTargetSection rows={targets} readOnly={readOnly} saving={saving} onSave={saveTargets} />
      <ReportExpItemSection rows={expItems} readOnly={readOnly} saving={saving} onSave={saveExpItems} />
      <GrantExpenditureSection programId={programId} />
      <ReportAchievementSection report={report} readOnly={readOnly} saving={saving} onSave={saveDraft} />

      {/* 제출 버튼 */}
      {!readOnly && (
        <div className="sticky bottom-4 z-10">
          <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-lg flex items-center justify-end gap-2">
            {isRejected && (
              <p className="flex-1 text-xs text-rose-600 font-semibold">반려 사유를 반영하고 다시 제출해 주세요.</p>
            )}
            <Button
              variant="primary"
              size="lg"
              loading={saving}
              leftIcon={<Send size={14} />}
              onClick={async () => {
                if (!window.confirm('제출 후에는 수정이 어려워요. 제출하시겠어요?')) return;
                const ok = await submitReport();
                if (ok && application) {
                  // PM 에게 제출 알림 (fire-and-forget)
                  void notifyReportSubmittedToPM({
                    projectId: application.project_id,
                    programTitle: application.program_name ?? '프로그램',
                    applicantName: application.applicant_name ?? undefined,
                  });
                }
              }}
            >
              {isRejected ? '수정 후 재제출' : '최종 제출'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
