// bal24 v2 — STEP-MEMBER-REPORT-PORTAL 수혜기업 사업실적보고서 작성·제출 페이지

import {
  Loader2, FileText, ShieldAlert, CheckCircle2, Send, AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui';
import { useMyReport } from './useMyReport';
import {
  REPORT_STATUS_LABELS,
} from '../../types/performanceReport';
import ReportBasicSection from './ReportBasicSection';
import ReportTargetSection from './ReportTargetSection';
import ReportExpItemSection from './ReportExpItemSection';
import ReportAchievementSection from './ReportAchievementSection';

export default function MyReportPage() {
  const {
    loading, saving, tableMissing, noApplication,
    application, report, targets, expItems,
    saveDraft, saveTargets, saveExpItems, submitReport,
  } = useMyReport();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-bold">보고서 테이블이 아직 만들어지지 않았어요.</p>
        <p className="mt-1 text-xs">관리자가 SQL 마이그레이션을 실행하면 사용할 수 있어요.</p>
      </div>
    );
  }

  if (noApplication) {
    return (
      <div className="max-w-2xl mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <FileText size={22} className="text-violet-600" aria-hidden="true" />
          내 사업보고
        </h1>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <ShieldAlert size={28} className="mx-auto text-amber-400" aria-hidden="true" />
          <p className="text-base font-bold text-[#1E1B4B]">선정된 사업이 없어요</p>
          <p className="text-sm text-slate-500">
            합격 처리된 사업이 있어야 보고서를 작성할 수 있어요.
            <br />
            담당자에게 문의해 주세요.
          </p>
        </div>
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
      {/* 상단 헤더 */}
      <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">사업실적보고서</p>
            <h1 className="mt-1 text-xl font-bold text-[#1E1B4B] flex items-center gap-2">
              <FileText size={20} className="text-violet-600" aria-hidden="true" />
              {application.program_name ?? '프로그램'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {application.applicant_name ?? '신청자'} · 작성·제출
            </p>
          </div>
          <span className={[
            'text-[11px] font-semibold px-2 py-1 rounded-md border',
            isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : isSubmitted ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
            : isRejected ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-slate-100 text-slate-700 border-slate-200',
          ].join(' ')}>
            {REPORT_STATUS_LABELS[report.status]}
          </span>
        </div>
      </header>

      {/* 상태 안내 배너 */}
      {isSubmitted && (
        <div className="rounded-xl bg-cyan-50 border border-cyan-100 px-4 py-3 text-sm text-cyan-900 flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden="true" />
          제출 완료된 보고서예요. PM 검토 중이에요.
        </div>
      )}
      {isApproved && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden="true" />
          승인 완료된 보고서예요.
        </div>
      )}
      {isRejected && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-900 space-y-1">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" />
            반려된 보고서예요. 사유를 확인하고 수정 후 재제출해 주세요.
          </p>
          {report.reject_reason && (
            <p className="text-xs whitespace-pre-wrap pl-6">{report.reject_reason}</p>
          )}
        </div>
      )}

      {/* 5 섹션 */}
      <ReportBasicSection report={report} readOnly={readOnly} saving={saving} onSave={saveDraft} />
      <ReportTargetSection rows={targets} readOnly={readOnly} saving={saving} onSave={saveTargets} />
      <ReportExpItemSection rows={expItems} readOnly={readOnly} saving={saving} onSave={saveExpItems} />
      <ReportAchievementSection report={report} readOnly={readOnly} saving={saving} onSave={saveDraft} />

      {/* 하단 제출 버튼 */}
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
                await submitReport();
              }}
            >
              {isRejected ? '수정 후 재제출' : '최종 제출'}
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-slate-400 pt-2">© 2026 (주)밸런스닷 · WorkFlow</p>
    </div>
  );
}
