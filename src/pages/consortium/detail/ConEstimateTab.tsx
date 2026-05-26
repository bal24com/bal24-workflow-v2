// 컨소시엄 견적 탭 — 박경수님 + SkyClaw STEP-CONSORTIUM-UPGRADE-FULL PART B (2026-05-28)
// 총 사업비 + 부가세 토글 + 카테고리별 항목 (탑다운) + 참여사 배분 미리보기.
// 박경수님 환경 호환: 컨소시엄에 project_id 가 연결된 경우 EstimateTab 안내, 미연결 시 안내문.

import { useMemo, useState } from 'react';
import { Receipt, Wallet, Calculator } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../../../lib/utils';
import { sumSharePct, memberDisplayName, memberRoleBadgeClass, memberRoleLabel, validateRatioSum } from '../consortiumUtils';
import type { ConsortiumMember } from '../consortiumTypes';
import { ESTIMATE_CATEGORIES, CATEGORY_ICON } from '../../../constants/estimateCategories';

interface Props {
  consortiumId: string;
  projectId: string | null;
  totalBudget: number;
  members: ConsortiumMember[];
}

export default function ConEstimateTab({ consortiumId: _cid, projectId, totalBudget, members }: Props) {
  // 부가세 포함 여부 (로컬 토글 — DB 저장은 projects.estimate_includes_vat 연동 별도)
  const [includesVat, setIncludesVat] = useState(false);
  const finalAmount = useMemo(
    () => includesVat ? Math.round(totalBudget * 1.1) : totalBudget,
    [totalBudget, includesVat],
  );
  const ratioCheck = useMemo(() => validateRatioSum(members), [members]);
  const totalRatio = sumSharePct(members);

  return (
    <div className="space-y-4">
      {/* 총 사업비 + 부가세 토글 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calculator size={16} className="text-violet-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#1E1B4B]">총 사업비</h2>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={includesVat} onChange={(e) => setIncludesVat(e.target.checked)}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
            부가세 10% 포함
          </label>
        </div>
        <div className="flex items-baseline justify-between border-t border-violet-50 pt-3">
          <span className="text-xs text-slate-500">최종 제안금액</span>
          <span className="text-2xl font-bold text-violet-700 tabular-nums">{formatMoney(finalAmount)}</span>
        </div>
        {includesVat && (
          <p className="text-[11px] text-slate-400 text-right">
            공급가액 {formatMoney(totalBudget)} + VAT {formatMoney(finalAmount - totalBudget)}
          </p>
        )}
      </section>

      {/* 카테고리별 항목 — 프로젝트 견적 탭 연결 안내 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
        <div className="flex items-center gap-1.5">
          <Receipt size={16} className="text-violet-500" aria-hidden="true" />
          <h2 className="text-sm font-bold text-[#1E1B4B]">카테고리별 항목</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ESTIMATE_CATEGORIES.map((cat) => (
            <div key={cat} className="rounded-xl border border-violet-50 bg-violet-50/30 p-3 text-center">
              <div className="text-xl">{CATEGORY_ICON[cat]}</div>
              <div className="text-xs font-semibold text-violet-700 mt-1">{cat}</div>
            </div>
          ))}
        </div>
        {projectId ? (
          <Link to={`/projects/${projectId}#estimate`} className="block text-center text-xs text-violet-600 hover:underline">
            프로젝트 견적 탭에서 항목 관리 →
          </Link>
        ) : (
          <p className="text-[11px] text-slate-400 text-center">
            ※ 컨소시엄에 프로젝트가 연결되면 견적 항목을 등록할 수 있어요.
          </p>
        )}
      </section>

      {/* 참여사별 배분 미리보기 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wallet size={16} className="text-emerald-500" aria-hidden="true" />
            <h2 className="text-sm font-bold text-[#1E1B4B]">참여사별 배분 미리보기</h2>
          </div>
          <span className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded border ${ratioCheck.valid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
            합계 {totalRatio.toFixed(1)}% {ratioCheck.valid ? '✓' : '⚠️'}
          </span>
        </div>
        {members.length === 0 ? (
          <p className="text-sm text-slate-400 italic text-center py-6">참여사가 등록되지 않았어요.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => {
              const ratio = Number(m.budget_ratio ?? m.task_share_pct ?? 0);
              const allocated = Math.round(finalAmount * ratio / 100);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-violet-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${memberRoleBadgeClass(m)}`}>
                      {m.is_self ? '★ ' : ''}{memberRoleLabel(m)}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 truncate">{memberDisplayName(m)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs whitespace-nowrap">
                    <span className="text-slate-500 tabular-nums">{ratio.toFixed(1)}%</span>
                    <span className="font-bold text-violet-700 tabular-nums">{formatMoney(allocated)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
