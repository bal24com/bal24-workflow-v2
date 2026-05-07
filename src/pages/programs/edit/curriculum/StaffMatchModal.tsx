// bal24 v2 — 커리큘럼 인력 매칭 모달
// 외부 전문가(staff_pool) / 내부 직원(profiles) 탭 전환 + 검색 + 역할·금액·메모 → 추가.

import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';
import { supabase } from '../../../../lib/supabase';
import { CURRICULUM_STAFF_ROLES } from '../../../../lib/curriculumStaff';
import { inputClass, Field } from '../cards/CardShell';
import type {
  CurriculumStaffRole, StaffPool, Profile,
} from '../../../../types/database';

type SourceTab = 'external' | 'internal';

type StaffOption = Pick<StaffPool, 'id' | 'name' | 'phone' | 'specialty'>;
type ProfileOption = Pick<Profile, 'id' | 'name' | 'department' | 'position'>;

interface Props {
  open: boolean;
  onClose: () => void;
  curriculumId: string;
  onAdded: () => void;
}

export default function StaffMatchModal({ open, onClose, curriculumId, onAdded }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<SourceTab>('external');
  const [search, setSearch] = useState('');
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [profileList, setProfileList] = useState<ProfileOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [role, setRole] = useState<CurriculumStaffRole>('강사');
  const [feeText, setFeeText] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [staffRes, profileRes] = await Promise.all([
          supabase
            .from('staff_pool')
            .select('id, name, phone, specialty')
            .order('name', { ascending: true }),
          supabase
            .from('profiles')
            .select('id, name, department, position')
            .eq('is_active', true)
            .order('name', { ascending: true }),
        ]);
        if (cancelled) return;
        if (staffRes.error) {
          console.error('[curriculum-match] 외부 전문가 조회 실패:', staffRes.error.message);
        } else {
          setStaffList((staffRes.data as StaffOption[] | null) ?? []);
        }
        if (profileRes.error) {
          console.error('[curriculum-match] 내부 직원 조회 실패:', profileRes.error.message);
        } else {
          setProfileList((profileRes.data as ProfileOption[] | null) ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId('');
      setRole('강사');
      setFeeText('');
      setNote('');
    }
  }, [open]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staffList;
    return staffList.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.specialty ?? []).some((sp) => sp.toLowerCase().includes(q)),
    );
  }, [staffList, search]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profileList;
    return profileList.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.department ?? '').toLowerCase().includes(q),
    );
  }, [profileList, search]);

  async function handleAdd() {
    if (!selectedId) {
      toast.error('인력을 선택해 주세요.');
      return;
    }
    const fee = feeText.trim() ? Number(feeText.replace(/,/g, '')) : null;
    if (fee != null && (Number.isNaN(fee) || fee < 0)) {
      toast.error('지급 금액은 0 이상의 숫자여야 해요.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        curriculum_id: curriculumId,
        staff_pool_id: tab === 'external' ? selectedId : null,
        profile_id: tab === 'internal' ? selectedId : null,
        role,
        fee,
        note: note.trim() || null,
      };
      const { error } = await supabase.from('curriculum_staff').insert(payload);
      if (error) {
        console.error('[curriculum-match] 추가 실패:', error.message);
        toast.error('인력 추가에 실패했어요. 동일 인력이 이미 매칭됐는지 확인해 주세요.');
        return;
      }
      toast.success('매칭 인력을 추가했어요.');
      onAdded();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="매칭 인력 추가"
      description="외부 전문가는 정산 연동, 내부 직원은 급여 별도 처리예요."
      size="brand"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
          <Button variant="primary" onClick={handleAdd} disabled={!selectedId || submitting}>
            {submitting ? '추가 중…' : '추가'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center bg-violet-50 rounded-full p-0.5 border border-violet-100 self-start">
          <button
            type="button"
            onClick={() => { setTab('external'); setSelectedId(''); }}
            className={`h-7 px-3 text-xs font-bold rounded-full transition-colors ${
              tab === 'external' ? 'bg-violet-600 text-white' : 'text-violet-600 hover:bg-violet-100'
            }`}
          >
            외부 전문가 ({staffList.length})
          </button>
          <button
            type="button"
            onClick={() => { setTab('internal'); setSelectedId(''); }}
            className={`h-7 px-3 text-xs font-bold rounded-full transition-colors ${
              tab === 'internal' ? 'bg-violet-600 text-white' : 'text-violet-600 hover:bg-violet-100'
            }`}
          >
            내부 직원 ({profileList.length})
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'external' ? '이름·특기 검색' : '이름·부서 검색'}
            className={`${inputClass} pl-9`}
          />
        </div>

        <div className="max-h-56 overflow-y-auto rounded-xl border border-violet-100 bg-violet-50/30">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
            </div>
          ) : tab === 'external' ? (
            filteredStaff.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">검색 결과가 없어요.</p>
            ) : (
              <ul className="flex flex-col">
                {filteredStaff.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-violet-100 transition-colors ${
                        selectedId === s.id ? 'bg-violet-100' : ''
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                        selectedId === s.id ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
                      }`} aria-hidden="true" />
                      <span className="flex-1 min-w-0 truncate font-semibold text-[#1E1B4B]">{s.name}</span>
                      {s.specialty && s.specialty.length > 0 && (
                        <span className="shrink-0 text-[10px] text-slate-500 truncate max-w-[180px]">
                          {s.specialty.slice(0, 2).join(' · ')}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : filteredProfiles.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">검색 결과가 없어요.</p>
          ) : (
            <ul className="flex flex-col">
              {filteredProfiles.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-violet-100 transition-colors ${
                      selectedId === p.id ? 'bg-violet-100' : ''
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full border-2 shrink-0 ${
                      selectedId === p.id ? 'bg-violet-600 border-violet-600' : 'border-slate-300'
                    }`} aria-hidden="true" />
                    <span className="flex-1 min-w-0 truncate font-semibold text-[#1E1B4B]">{p.name}</span>
                    {(p.department || p.position) && (
                      <span className="shrink-0 text-[10px] text-slate-500 truncate">
                        {[p.department, p.position].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="역할" required>
            <select value={role} onChange={(e) => setRole(e.target.value as CurriculumStaffRole)} className={inputClass}>
              {CURRICULUM_STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="지급 금액" hint="원 — 비어 있으면 미정">
            <input
              type="text"
              inputMode="numeric"
              value={feeText}
              onChange={(e) => setFeeText(e.target.value)}
              placeholder="예) 1500000"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="메모" hint="선택">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예) 1차시 / 식대 별도"
            className={inputClass}
          />
        </Field>
      </div>
    </Modal>
  );
}
