// bal24 v2 — 프로그램 수정 풀 페이지 (V7 NewEducationV9 9 카드 이식)
// 9 카드 (⑦ 교안은 후속 STEP, ⑨ 정적 안내).

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import {
  emptyForm,
  programToForm,
  validateForm,
  saveProgram,
  type ProgramEditForm,
  type FormError,
} from './programEditUtils';
import OverviewCard from './cards/OverviewCard';
import ScheduleCard from './cards/ScheduleCard';
import NoticeCard from './cards/NoticeCard';
import GoalCard from './cards/GoalCard';
import OutcomeLinkCard from './cards/OutcomeLinkCard';
import SurveyLinkCard from './cards/SurveyLinkCard';
import ClassificationCard from './cards/ClassificationCard';
import ApplicationCard from './cards/ApplicationCard';
import type { Program } from '../../../types/database';

export default function ProgramEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<ProgramEditForm>(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error: err } = await supabase
        .from('programs')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        console.error('[program-edit] 로드 실패:', err.message);
        toast.error('프로그램 정보를 불러오지 못했어요.');
      } else if (!data) {
        setNotFound(true);
      } else {
        setForm(programToForm(data as Program));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  function update<K extends keyof ProgramEditForm>(key: K, value: ProgramEditForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error?.field === key) setError(null);
  }

  async function handleSave() {
    if (!id) return;
    const v = validateForm(form);
    if (v) {
      setError(v);
      toast.error(v.message);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveProgram(id, form);
      toast.success('프로그램 정보를 저장했어요.');
      navigate(`/programs/${id}`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[program-edit] 저장 실패:', raw);
      toast.error('저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin mr-2" aria-hidden="true" />
        불러오는 중…
      </div>
    );
  }

  if (notFound || !id) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">프로그램을 찾을 수 없어요.</p>
        <Link
          to="/programs"
          className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          프로그램 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1080px]">
      <div className="space-y-2">
        <Link
          to={`/programs/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          프로그램 상세로
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1E1B4B]">프로그램 수정</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              7개 카드를 채워 프로그램 정보를 풍부하게 보강하세요. 커리큘럼은 상세 → 커리큘럼 탭에서 관리해요.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(`/programs/${id}`)} disabled={saving}>
              취소
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving} leftIcon={<Save size={14} />}>
              저장
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <OverviewCard form={form} onChange={update} errorField={error?.field} />
        <ScheduleCard form={form} onChange={update} errorField={error?.field} />
        <NoticeCard form={form} onChange={update} />
        <GoalCard form={form} onChange={update} />
        <ApplicationCard form={form} onChange={update} errorField={error?.field} programId={id ?? null} />
        <OutcomeLinkCard programId={id} />
        <SurveyLinkCard />
        <ClassificationCard />
      </div>

      <div className="flex justify-end pt-2 pb-8">
        <Button variant="primary" onClick={handleSave} loading={saving} leftIcon={<Save size={14} />} size="lg">
          저장
        </Button>
      </div>
    </div>
  );
}
