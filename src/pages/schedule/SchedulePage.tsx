// bal24 v2 — 일정·캘린더 메인 페이지 (STEP 17)
// 월/주/목록 3 뷰 전환 + 5 source 필터 + 등록 모달

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Loader2, CalendarDays } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { ScheduleEvent } from '../../types/database';
import { useUserProfile } from '../../hooks/useUserProfile';
import { fetchDbHolidays, buildHolidayMap } from '../../utils/holidays';
import {
  fetchMonthEvents,
  weekRange,
  SOURCE_EMOJI,
  SOURCE_LABEL,
  isMissingTableError,
  type EventSource,
  type UnifiedEvent,
} from './scheduleUtils';
import MonthCalendar from './MonthCalendar';
import WeekCalendar from './WeekCalendar';
import ScheduleEventCard from './ScheduleEventCard';
import ScheduleEventModal from './ScheduleEventModal';
import HolidayManageModal from './HolidayManageModal';

type ViewMode = 'month' | 'week' | 'list';

const ALL_SOURCES: EventSource[] = ['task', 'program', 'attendance', 'custom'];

interface ProjectOption {
  id: string;
  name: string;
}

interface ProgramOption {
  id: string;
  name: string;
  project_id: string | null;
}

export default function SchedulePage() {
  const navigate = useNavigate();
  const { isPM } = useUserProfile();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState<ViewMode>('month');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [weekBase, setWeekBase] = useState<Date>(today);

  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabledSources, setEnabledSources] = useState<Set<EventSource>>(new Set(ALL_SOURCES));

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string | undefined>(undefined);
  const [modalEditTarget, setModalEditTarget] = useState<ScheduleEvent | null>(null);

  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayMap, setHolidayMap] = useState<Map<string, string>>(() => buildHolidayMap([]));

  const reloadHolidays = useCallback(async () => {
    const db = await fetchDbHolidays();
    setHolidayMap(buildHolidayMap(db));
  }, []);

  useEffect(() => {
    void reloadHolidays();
  }, [reloadHolidays]);

  // 프로젝트·프로그램 옵션 한 번만 로드
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [pRes, gRes] = await Promise.all([
        supabase.from('projects').select('id, name').order('created_at', { ascending: false }),
        supabase.from('programs').select('id, name, project_id').order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (pRes.error) console.error('[schedule] projects 옵션 조회 실패:', pRes.error.message);
      if (gRes.error) console.error('[schedule] programs 옵션 조회 실패:', gRes.error.message);
      setProjects(pRes.data ?? []);
      setPrograms((gRes.data ?? []) as ProgramOption[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // 주간 뷰는 주의 시작일이 속한 달을 기준으로, 경계 주는 다음 달도 함께 fetch
      let targetYear = year;
      let targetMonth = month;
      if (view === 'week') {
        const { start } = weekRange(weekBase);
        targetYear = start.getFullYear();
        targetMonth = start.getMonth() + 1;
      }
      const list = await fetchMonthEvents(targetYear, targetMonth);
      setEvents(list);
    } catch (err) {
      console.error('[schedule] 이벤트 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month, view, weekBase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredEvents = useMemo(
    () => events.filter((e) => enabledSources.has(e.source)),
    [events, enabledSources],
  );

  const toggleSource = (src: EventSource) => {
    setEnabledSources((prev) => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  };

  const handlePrev = () => {
    if (view === 'week') {
      const next = new Date(weekBase);
      next.setDate(weekBase.getDate() - 7);
      setWeekBase(next);
    } else {
      const newMonth = month === 1 ? 12 : month - 1;
      const newYear = month === 1 ? year - 1 : year;
      setMonth(newMonth);
      setYear(newYear);
    }
  };

  const handleNext = () => {
    if (view === 'week') {
      const next = new Date(weekBase);
      next.setDate(weekBase.getDate() + 7);
      setWeekBase(next);
    } else {
      const newMonth = month === 12 ? 1 : month + 1;
      const newYear = month === 12 ? year + 1 : year;
      setMonth(newMonth);
      setYear(newYear);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setWeekBase(now);
  };

  const openCreate = (date?: string) => {
    setModalEditTarget(null);
    setModalDefaultDate(date);
    setModalOpen(true);
  };

  const openEditCustom = async (event: UnifiedEvent) => {
    if (event.source !== 'custom' || !event.relatedId) return;
    const { data, error } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('id', event.relatedId)
      .maybeSingle();
    if (error || !data) {
      // schedule_events 테이블 미적용 환경 → 조용히 skip (편집 불가 상태)
      if (error && !isMissingTableError(error.message)) {
        console.error('[schedule] 일정 조회 실패:', error.message);
      }
      return;
    }
    setModalEditTarget(data as ScheduleEvent);
    setModalDefaultDate(undefined);
    setModalOpen(true);
  };

  const handleEventClick = (event: UnifiedEvent) => {
    switch (event.source) {
      case 'task':
        // task의 relatedId 는 project_id 로 매핑됨 (없으면 task id)
        if (event.relatedId) navigate(`/projects/${event.relatedId}`);
        break;
      case 'program':
        navigate('/programs');
        break;
      case 'attendance':
        if (event.relatedId) navigate(`/attendance/${event.relatedId}`);
        break;
      case 'custom':
        void openEditCustom(event);
        break;
      default:
        break;
    }
  };

  const headerTitle = useMemo(() => {
    if (view === 'week') {
      const { start, end } = weekRange(weekBase);
      const fmt = (d: Date) =>
        `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      return `${fmt(start)} ~ ${fmt(end)}`;
    }
    return `${year}년 ${month}월`;
  }, [view, weekBase, year, month]);

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
          <span aria-hidden="true">🗓️</span>
          일정
        </h1>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-violet-100 bg-white p-1 shadow-sm">
            {(['month', 'week', 'list'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition ${
                  view === v ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'
                }`}
              >
                {v === 'month' ? '월간' : v === 'week' ? '주간' : '목록'}
              </button>
            ))}
          </div>

          {isPM && (
            <Button variant="outline" onClick={() => setHolidayModalOpen(true)}>
              <CalendarDays size={16} className="mr-1.5" aria-hidden="true" />
              휴일 관리
            </Button>
          )}
          <Button variant="primary" onClick={() => openCreate()}>
            <Plus size={16} className="mr-1.5" aria-hidden="true" />
            일정 추가
          </Button>
        </div>
      </header>

      {/* 네비게이션 + 필터 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="이전"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="text-base font-bold text-[#1E1B4B] min-w-[180px] text-center">
            {headerTitle}
          </div>
          <button
            type="button"
            onClick={handleNext}
            aria-label="다음"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-violet-50 hover:text-violet-700 transition-colors"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <Button variant="outline" onClick={handleToday} className="ml-1">
            오늘
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {ALL_SOURCES.map((src) => {
            const active = enabledSources.has(src);
            return (
              <button
                key={src}
                type="button"
                onClick={() => toggleSource(src)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'bg-violet-100 text-violet-700 border border-violet-200'
                    : 'bg-white text-slate-400 border border-slate-200 line-through'
                }`}
              >
                <span aria-hidden="true">{SOURCE_EMOJI[src]}</span>
                {SOURCE_LABEL[src]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 본문 */}
      {loading ? (
        <div className="rounded-2xl border border-violet-100 bg-white p-12 flex items-center justify-center">
          <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
        </div>
      ) : view === 'month' ? (
        <MonthCalendar
          year={year}
          month={month}
          events={filteredEvents}
          holidayMap={holidayMap}
          onCellClick={(date) => openCreate(date)}
          onEventClick={handleEventClick}
        />
      ) : view === 'week' ? (
        <WeekCalendar
          baseDate={weekBase}
          events={filteredEvents}
          holidayMap={holidayMap}
          onEventClick={handleEventClick}
          onCellClick={(date) => openCreate(date)}
        />
      ) : (
        <div className="space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-violet-100 bg-white p-12 text-center text-sm text-slate-500">
              표시할 일정이 없어요.
            </div>
          ) : (
            filteredEvents.map((event) => (
              <ScheduleEventCard key={event.id} event={event} onClick={handleEventClick} />
            ))
          )}
        </div>
      )}

      <ScheduleEventModal
        open={modalOpen}
        defaultDate={modalDefaultDate}
        editTarget={modalEditTarget}
        projects={projects}
        programs={programs}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void reload();
        }}
      />

      <HolidayManageModal
        open={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        onChanged={() => void reloadHolidays()}
      />
    </div>
  );
}
