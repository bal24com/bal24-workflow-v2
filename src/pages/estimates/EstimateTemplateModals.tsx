// 견적서 템플릿 저장·불러오기 모달 (박경수님 요청)
// 현재 견적 항목들을 이름 붙여 저장 → 다른 견적에서 1-클릭 불러오기.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Trash2, Download } from 'lucide-react';

export interface TemplateItem {
  category: string;
  description: string | null;
  payee_name: string | null;
  unit_price: number;
  quantity: number;
  tax_rate_type: string;
  memo: string | null;
}

interface Template {
  id: string;
  name: string;
  memo: string | null;
  items: TemplateItem[];
  created_at: string;
}

export function SaveEstimateTemplateModal({ open, items, onClose, onSaved }: {
  open: boolean; items: TemplateItem[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(''); setMemo(''); } }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('템플릿 이름을 입력해 주세요.'); return; }
    if (items.length === 0) { toast.error('저장할 항목이 없어요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('estimate_templates').insert({
      name: name.trim(), memo: memo.trim() || null, items,
    });
    setSaving(false);
    if (error) {
      const raw = error.message.toLowerCase();
      toast.error(raw.includes('does not exist') || raw.includes('pgrst205')
        ? 'estimate_templates 테이블이 적용되지 않았어요. 마이그레이션 실행 필요.'
        : raw.includes('row-level security')
          ? '저장 권한이 없어요. 관리자에게 문의해 주세요.'
          : `저장 실패: ${error.message}`);
      return;
    }
    toast.success(`"${name}" 템플릿을 저장했어요. (${items.length}건)`);
    onSaved(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="견적 템플릿으로 저장" size="md"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
        <Button type="submit" form="save-est-tpl" variant="primary" loading={saving}>저장</Button>
      </>}>
      <form id="save-est-tpl" onSubmit={handleSubmit} className="space-y-3" noValidate>
        <Input label="템플릿 이름" required value={name} onChange={(e) => setName(e.target.value)}
          placeholder="예) 2일 캠프 기본 비용" disabled={saving} />
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">메모 (선택)</label>
          <textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} disabled={saving}
            placeholder="언제·어떤 사업에 쓴 비용 구성인지 메모"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        <p className="text-xs text-slate-500">현재 견적의 <strong className="text-violet-700">{items.length}개 항목</strong>이 템플릿으로 저장됩니다.</p>
      </form>
    </Modal>
  );
}

export function LoadEstimateTemplateModal({ open, onClose, onApply }: {
  open: boolean; onClose: () => void; onApply: (items: TemplateItem[], replace: boolean) => void;
}) {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    const { data, error } = await supabase.from('estimate_templates')
      .select('id, name, memo, items, created_at')
      .is('deleted_at', null).order('created_at', { ascending: false });
    setLoading(false);
    if (error) { toast.error('템플릿 목록을 불러오지 못했어요.'); return; }
    setTemplates((data ?? []) as Template[]);
  }
  useEffect(() => { if (open) void reload(); }, [open]);

  async function handleDelete(t: Template) {
    if (!window.confirm(`"${t.name}" 템플릿을 삭제할까요?`)) return;
    const { error } = await supabase.from('estimate_templates')
      .update({ deleted_at: new Date().toISOString() }).eq('id', t.id);
    if (error) { toast.error('삭제 중 오류가 발생했어요.'); return; }
    toast.success('템플릿을 삭제했어요.');
    void reload();
  }

  return (
    <Modal open={open} onClose={onClose} title="견적 템플릿 불러오기" size="md"
      footer={<Button variant="ghost" onClick={onClose}>닫기</Button>}>
      {loading ? (
        <p className="text-center text-sm text-muted py-8">불러오는 중…</p>
      ) : templates.length === 0 ? (
        <p className="text-center text-sm text-slate-400 italic py-8">저장된 템플릿이 없어요. 견적 페이지에서 [템플릿으로 저장] 으로 추가하세요.</p>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="rounded-xl border border-slate-200 p-3 hover:border-violet-300">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#1E1B4B]">{t.name}</div>
                  {t.memo && <div className="text-xs text-slate-500 truncate">{t.memo}</div>}
                  <div className="text-[11px] text-slate-400 mt-0.5">{t.items.length}개 항목 · {new Date(t.created_at).toLocaleDateString('ko-KR')}</div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button variant="primary" size="sm" leftIcon={<Download size={11} />}
                    onClick={() => { onApply(t.items, false); onClose(); }}>추가</Button>
                  <Button variant="outline" size="sm"
                    onClick={() => { if (window.confirm('현재 견적 항목을 모두 지우고 이 템플릿으로 교체할까요?')) { onApply(t.items, true); onClose(); } }}>
                    교체
                  </Button>
                  <button type="button" onClick={() => void handleDelete(t)}
                    className="text-[11px] text-rose-600 hover:underline inline-flex items-center gap-0.5 justify-end">
                    <Trash2 size={10} aria-hidden="true" />삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
