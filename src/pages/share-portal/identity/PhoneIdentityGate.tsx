// bal24 v2 — 외부 전문가 페이지 본인 식별 게이트 (Stage 3-B-2-②)
// Q2 옵션 A: 전화번호 입력 → curriculum_staff에서 매칭된 차시 조회 → 식별 성공 시 본문 노출.

import { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

export interface IdentifiedExpert {
  source: 'external' | 'internal';
  identifierId: string;       // staff_pool_id 또는 profile_id
  name: string;
  phone: string;
  /** 이 프로그램에서 본인이 매칭된 curriculum_staff row의 id 모음 */
  curriculumStaffIds: string[];
}

interface Props {
  programId: string;
  onIdentified: (expert: IdentifiedExpert) => void;
}

const inputClass =
  'w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm text-[#1E1B4B] placeholder-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors';

function normalizePhone(p: string): string {
  return p.replace(/[\s-]/g, '');
}

interface CurriculumStaffJoin {
  id: string;
  staff_pool_id: string | null;
  profile_id: string | null;
  staff_pool: { id: string; name: string; phone: string | null } | { id: string; name: string; phone: string | null }[] | null;
  profile: { id: string; name: string; phone: string | null } | { id: string; name: string; phone: string | null }[] | null;
  curriculum: { id: string; program_id: string } | { id: string; program_id: string }[] | null;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export default function PhoneIdentityGate({ programId, onIdentified }: Props) {
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleVerify() {
    setErrMsg(null);
    const normalized = normalizePhone(phone);
    if (!normalized || normalized.length < 8) {
      setErrMsg('전화번호를 정확히 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      // 이 프로그램에 묶인 curriculum_staff 중 staff_pool/profile.phone 매칭
      const { data, error } = await supabase
        .from('curriculum_staff')
        .select(
          'id, staff_pool_id, profile_id, staff_pool:staff_pool(id,name,phone), profile:profiles(id,name,phone), curriculum:program_curriculum!inner(id,program_id)',
        )
        .eq('curriculum.program_id', programId);
      if (error) {
        console.error('[share-portal/expert] 본인 식별 조회 실패:', error.message);
        setErrMsg('식별에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }

      const rows = (data as CurriculumStaffJoin[] | null) ?? [];
      const matchedRows = rows.filter((r) => {
        const sp = pickOne(r.staff_pool);
        const pf = pickOne(r.profile);
        const candidate = r.staff_pool_id ? sp?.phone : pf?.phone;
        return candidate ? normalizePhone(candidate) === normalized : false;
      });

      if (matchedRows.length === 0) {
        setErrMsg('이 프로그램에 매칭된 인력 정보가 없어요. 담당자에게 문의해 주세요.');
        return;
      }

      const first = matchedRows[0];
      const sp = pickOne(first.staff_pool);
      const pf = pickOne(first.profile);
      const isExternal = !!first.staff_pool_id;
      const expert: IdentifiedExpert = {
        source: isExternal ? 'external' : 'internal',
        identifierId: isExternal ? first.staff_pool_id! : first.profile_id!,
        name: isExternal ? sp?.name ?? '?' : pf?.name ?? '?',
        phone: normalized,
        curriculumStaffIds: matchedRows.map((r) => r.id),
      };
      onIdentified(expert);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-start gap-2">
        <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-violet-50 text-violet-600">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-bold text-[#1E1B4B]">본인 확인</h2>
          <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">
            매칭된 전화번호를 입력하면 본인의 차시 정보·활동일지·강의확인서를 볼 수 있어요.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleVerify();
          }}
          placeholder="010-0000-0000"
          autoFocus
          className={inputClass}
        />
        {errMsg && (
          <p role="alert" className="text-xs text-rose-600 font-semibold">{errMsg}</p>
        )}
        <button
          type="button"
          onClick={() => void handleVerify()}
          disabled={submitting || !phone.trim()}
          className="inline-flex items-center justify-center gap-1 h-11 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
          {submitting ? '확인 중…' : '확인'}
        </button>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        ⓘ 입력하신 번호는 본인 확인에만 사용되며 외부에 노출되지 않아요. 잘못 입력하셨다면 다시 입력해 주세요.
      </p>
    </section>
  );
}
