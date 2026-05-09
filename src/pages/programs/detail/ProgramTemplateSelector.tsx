// bal24 v2 — 프로그램 템플릿 선택 + 커스텀 모듈 조합 UI (STEP-PROGRAM-TYPE)
// 시스템 템플릿 / 내 커스텀 / 직접 구성 3 그룹.
// 직접 구성 시 모듈 체크박스 + "이 조합을 템플릿으로 저장" 버튼.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, Loader2, Plus, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Modal, Button, Input } from '../../../components/ui';
import { MODULE_OPTIONS, type ExtendedProgramType } from '../programTypeConfig';
import type { ProgramTemplate } from '../../../types/database';

interface Props {
  programType: ExtendedProgramType;
  selectedModules: string[];
  onModulesChange: (modules: string[]) => void;
}

const CUSTOM_KEY = '__custom__';

export default function ProgramTemplateSelector({
  programType, selectedModules, onModulesChange,
}: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(CUSTOM_KEY);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_templates')
      .select('*')
      .eq('base_type', programType)
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[program-template] 조회 실패:', error.message);
      toast.error('템플릿 목록을 불러오지 못했어요.');
      setTemplates([]);
    } else {
      setTemplates((data as ProgramTemplate[] | null) ?? []);
    }
    setLoading(false);
  }, [programType, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchTemplates();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchTemplates]);

  // programType 변경 시 선택 초기화 (커스텀 모드)
  useEffect(() => {
    setSelectedTemplateId(CUSTOM_KEY);
  }, [programType]);

  const systemTemplates = useMemo(() => templates.filter((t) => t.is_system), [templates]);
  const myTemplates = useMemo(
    () => templates.filter((t) => !t.is_system && t.created_by === user?.id),
    [templates, user?.id],
  );

  function handleTemplateChange(value: string) {
    setSelectedTemplateId(value);
    if (value === CUSTOM_KEY) return;
    const tpl = templates.find((t) => t.id === value);
    if (tpl) onModulesChange(Array.isArray(tpl.modules) ? tpl.modules : []);
  }

  function toggleModule(id: string) {
    if (selectedModules.includes(id)) {
      onModulesChange(selectedModules.filter((m) => m !== id));
    } else {
      onModulesChange([...selectedModules, id]);
    }
    setSelectedTemplateId(CUSTOM_KEY);
  }

  async function handleSaveCustomTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTemplateName.trim()) {
      toast.error('템플릿 이름을 입력해 주세요.');
      return;
    }
    if (selectedModules.length === 0) {
      toast.error('모듈을 1개 이상 선택해 주세요.');
      return;
    }
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from('program_templates').insert({
        name: newTemplateName.trim(),
        base_type: programType,
        modules: selectedModules,
        is_system: false,
        created_by: user?.id ?? null,
      });
      if (error) {
        console.error('[program-template] 저장 실패:', error.message);
        toast.error('템플릿 저장 중 오류가 발생했어요.');
        return;
      }
      toast.success('템플릿을 저장했어요.');
      setSaveOpen(false);
      setNewTemplateName('');
      await fetchTemplates();
    } finally {
      setSavingTemplate(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">템플릿 선택</label>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            템플릿 불러오는 중…
          </div>
        ) : (
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value={CUSTOM_KEY}>직접 구성</option>
            {systemTemplates.length > 0 && (
              <optgroup label="시스템 기본 템플릿">
                {systemTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.description ? ` — ${t.description}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            {myTemplates.length > 0 && (
              <optgroup label="내가 만든 템플릿">
                {myTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700">
            모듈 구성 ({selectedModules.length}개)
          </label>
          {selectedTemplateId === CUSTOM_KEY && selectedModules.length > 0 && (
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700"
            >
              <Bookmark size={12} aria-hidden="true" />
              이 조합을 템플릿으로 저장
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 rounded-xl border border-slate-200 bg-slate-50/40 p-3 max-h-64 overflow-y-auto">
          {MODULE_OPTIONS.map((m) => {
            const checked = selectedModules.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModule(m.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors text-left ${
                  checked
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-violet-50'
                }`}
              >
                {checked ? <Check size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400">
          💡 템플릿 선택 시 모듈이 자동으로 채워져요. 항목을 직접 토글하면 "직접 구성" 으로 전환돼요.
        </p>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="커스텀 템플릿 저장"
        description={`현재 선택된 ${selectedModules.length}개 모듈을 "${programType}" 유형 템플릿으로 저장해요.`}
        size="md"
        closeOnBackdrop={!savingTemplate}
        footer={
          <>
            <Button variant="outline" onClick={() => setSaveOpen(false)} disabled={savingTemplate}>취소</Button>
            <Button type="submit" form="tpl-save-form" variant="primary" loading={savingTemplate} leftIcon={<Save size={14} />}>
              저장
            </Button>
          </>
        }
      >
        <form id="tpl-save-form" onSubmit={(e) => void handleSaveCustomTemplate(e)} noValidate>
          <Input
            label="템플릿 이름"
            required
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            disabled={savingTemplate}
            placeholder="예) 우리 회사 표준 교육 템플릿"
            helperText={`${selectedModules.length}개 모듈 포함`}
          />
        </form>
      </Modal>
    </div>
  );
}
