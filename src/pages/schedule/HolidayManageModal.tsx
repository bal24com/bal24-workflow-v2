// bal24 v2 — 휴일 관리 모달 (admin/PM 전용)
// holidays 테이블 INSERT / DELETE 처리. 정적 공휴일은 별도 보존.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { fetchDbHolidays, type DbHoliday } from '../../utils/holidays';
import { isMissingTableError } from './scheduleUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 등록·삭제 후 부모(SchedulePage)가 holidayMap 다시 빌드하도록 트리거 */
  onChanged: () => void;
}

const todayIso = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export default function HolidayManageModal({ open, onClose, onChanged }: Props) {
  const [list, setList] = useState<DbHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [date, setDate] = useState<string>(todayIso());
  const [name, setName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setTableMissing(false);
    const { data, error } = await supabase
      .from('holidays')
      .select('id, date, name, is_national, created_at')
      .order('date', { ascending: true });
    if (error) {
      if (isMissingTableError(error.message)) {
        setTableMissing(true);
        setList([]);
      } else {
        console.error('[holidays] 목록 조회 실패:', error.message);
        setErrorMsg('휴일 목록을 불러오지 못했어요.');
      }
    } else {
      setList((data ?? []) as DbHoliday[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setName('');
    setErrorMsg(null);
    void reload();
  }, [open]);

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!date) return setErrorMsg('날짜를 선택해 주세요.');
    if (!name.trim()) return setErrorMsg('휴일명을 입력해 주세요.');

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('holidays')
        .insert({ date, name: name.trim(), is_national: false });
      if (error) throw error;
      setName('');
      await reload();
      onChanged();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[holidays] 등록 실패:', raw);
      if (isMissingTableError(raw)) {
        setTableMissing(true);
      } else {
        setErrorMsg('등록 중 오류가 발생했어요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (h: DbHoliday) => {
    if (!window.confirm(`"${h.name}" (${h.date}) 휴일을 삭제할까요?`)) return;
    const list_backup = list;
    setList((prev) => prev.filter((x) => x.id !== h.id));
    const { error } = await supabase.from('holidays').delete().eq('id', h.id);
    if (error) {
      console.error('[holidays] 삭제 실패:', error.message);
      setList(list_backup);
      setErrorMsg('삭제에 실패했어요.');
      return;
    }
    onChanged();
  };

  // 우상단에 등록된 DB 휴일 데이터들을 미리 fetchDbHolidays 캐시로 워밍업
  useEffect(() => {
    if (open) void fetchDbHolidays();
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="휴일 관리"
      description="달력에 표시할 사용자 정의 휴일을 등록·삭제합니다. (정적 공휴일은 자동 적용)"
      size="md"
      footer={
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="space-y-5">
        {tableMissing ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            holidays 테이블이 없어요. <code className="px-1 bg-amber-100 rounded">20260510_holidays.sql</code> 마이그레이션을 먼저 실행해 주세요.
          </div>
        ) : (
          <>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 items-end">
                <Input
                  type="date"
                  label="날짜"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={submitting}
                />
                <Input
                  label="휴일명"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  placeholder="예) 회사 창립기념일"
                />
                <Button type="submit" variant="primary" loading={submitting}>
                  <Plus size={16} className="mr-1" aria-hidden="true" />
                  등록
                </Button>
              </div>
              {errorMsg && (
                <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                  {errorMsg}
                </div>
              )}
            </form>

            <div>
              <div className="text-xs font-bold text-slate-500 mb-2">등록된 휴일 ({list.length})</div>
              {loading ? (
                <div className="text-sm text-slate-500 text-center py-6">불러오는 중…</div>
              ) : list.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-6 rounded-xl bg-slate-50/50 border border-slate-100">
                  아직 등록된 휴일이 없어요.
                </div>
              ) : (
                <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                  {list.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-100 bg-white"
                    >
                      <span className="text-xs font-mono text-slate-500 w-24">{h.date}</span>
                      <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{h.name}</span>
                      <button
                        type="button"
                        onClick={() => void handleDelete(h)}
                        aria-label={`${h.name} 삭제`}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
