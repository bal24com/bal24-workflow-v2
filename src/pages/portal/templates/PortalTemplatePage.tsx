// bal24 v2 — 포털 템플릿 목록 페이지

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Layers, Edit3, Users, Lock } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { STAGE_LABELS } from '../portalConstants';
import type { PortalTemplate } from '../../../types/database';
import PortalTemplateModal from './PortalTemplateModal';

type TemplateRow = PortalTemplate & {
  items: { id: string }[];
};

const SELECT_COLUMNS = '*, items:portal_template_items(id)';

export default function PortalTemplatePage() {
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PortalTemplate | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('portal_templates')
        .select(SELECT_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []) as TemplateRow[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[portal-templates] 조회 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes("could not find the table 'public.portal_templates'") || m.includes('pgrst205')) {
        setErrorMsg('포털 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.');
      } else {
        setErrorMsg('템플릿 목록을 불러오지 못했어요.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          자주 쓰는 포털 항목을 템플릿으로 저장해두고 신규 포털 만들 때 재사용해요.
        </p>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditing(null); setModalOpen(true); }}>
          템플릿 만들기
        </Button>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-dashed border-slate-200">
          <Layers size={28} className="text-slate-300 mb-2" />
          <p className="text-sm text-muted mb-3">아직 등록된 템플릿이 없어요.</p>
          <Button variant="outline" size="sm" leftIcon={<Plus size={14} />} onClick={() => { setEditing(null); setModalOpen(true); }}>
            첫 템플릿 만들기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((t) => (
            <Card key={t.id} className="hover:border-primary/30 hover:shadow-md transition h-full">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-text truncate">{t.name}</h3>
                    {t.description && <div className="text-xs text-muted truncate mt-0.5">{t.description}</div>}
                  </div>
                  <button type="button" onClick={() => { setEditing(t); setModalOpen(true); }}
                    className="p-1.5 rounded text-slate-400 hover:text-primary hover:bg-primary/5"
                    aria-label="수정">
                    <Edit3 size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                  {t.stage_hint && <Badge variant="primary">{STAGE_LABELS[t.stage_hint]}</Badge>}
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    <Layers size={10} />항목 {t.items.length}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                    {t.is_shared ? <><Users size={10} />공유</> : <><Lock size={10} />개인</>}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PortalTemplateModal
        open={modalOpen}
        template={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={() => void fetchData()}
      />
    </div>
  );
}
