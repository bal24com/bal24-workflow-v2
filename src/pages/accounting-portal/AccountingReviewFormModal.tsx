// 회계사무소 검토 세션 생성 모달 — STEP-ACCOUNTING-ALL P4
// 기간라벨 + 프로젝트 다중선택 + 회계사무소 정보 + 토큰 링크 자동 복사

import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface ProjectOption { id: string; name: string }

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function defaultExpires(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function AccountingReviewFormModal({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [periodLabel, setPeriodLabel] = useState('');
  const [firmName, setFirmName] = useState('');
  const [firmEmail, setFirmEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState(defaultExpires());
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPeriodLabel('');
    setFirmName('');
    setFirmEmail('');
    setExpiresAt(defaultExpires());
    setSelectedProjects([]);

    void (async () => {
      const { data, error } = await supabase
        .from('projects').select('id, name')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) { console.error('[AccountingReviewFormModal] projects 조회 실패:', error.message); return; }
      setProjects((data as ProjectOption[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, [open]);

  function toggleProject(id: string) {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function handleCreate() {
    if (!periodLabel.trim()) { toast.error('기간 라벨을 입력해 주세요.'); return; }
    if (selectedProjects.length === 0) { toast.error('연결 프로젝트를 1개 이상 선택해 주세요.'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('accounting_reviews')
        .insert({
          period_label: periodLabel.trim(),
          project_ids: selectedProjects,
          firm_name: firmName.trim() || null,
          firm_email: firmEmail.trim() || null,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          sent_at: new Date().toISOString(),
          status: 'pending',
        })
        .select('token')
        .single();
      if (error) throw error;

      const token = (data as { token: string }).token;
      const portalUrl = `${window.location.origin}/accounting-review/${token}`;
      try {
        await navigator.clipboard.writeText(portalUrl);
        toast.success('생성 완료. 포털 링크가 클립보드에 복사됐어요.');
      } catch {
        toast.success('생성 완료. 링크는 목록에서 복사할 수 있어요.');
      }
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[AccountingReviewFormModal] 생성 실패:', msg);
      toast.error('검토 세션 생성에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 검토 요청"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
          <Button variant="primary" leftIcon={<Copy size={14} />} onClick={() => void handleCreate()} loading={saving}>
            생성 + 링크 복사
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-xs text-violet-900">
          💡 검토 링크는 비로그인 접근 가능하며 만료일 이후 자동 차단됩니다.
        </div>

        <Field label="기간 라벨" required>
          <Input
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="예: 2026년 5월"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="회계사무소명">
            <Input value={firmName} onChange={(e) => setFirmName(e.target.value)} placeholder="OO회계법인" />
          </Field>
          <Field label="회계사무소 이메일">
            <Input type="email" value={firmEmail} onChange={(e) => setFirmEmail(e.target.value)} placeholder="firm@example.com" />
          </Field>
        </div>

        <Field label="링크 만료일">
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>

        <Field label="연결 프로젝트 (다중 선택)" required>
          <div className="rounded-xl border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100">
            {projects.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-400 italic">등록된 프로젝트가 없어요.</div>
            ) : projects.map((p) => {
              const active = selectedProjects.includes(p.id);
              return (
                <label key={p.id} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${active ? 'bg-violet-50' : 'hover:bg-slate-50'}`}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleProject(p.id)}
                    className="accent-violet-600"
                  />
                  <span className={active ? 'font-semibold text-violet-700' : 'text-slate-700'}>{p.name}</span>
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">선택한 프로젝트의 외주/급여 내역이 포털에 노출됩니다.</p>
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
