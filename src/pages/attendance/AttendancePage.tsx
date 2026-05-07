// bal24 v2 — 출석 세션 목록 페이지

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Loader2, Copy, MapPin, Calendar, Users,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { copyToClipboard } from '../../lib/clipboard';
import EmptyState from '../../components/EmptyState';
import {
  calcAttendanceSummary,
  formatTime,
  getCheckInUrl,
  isSessionExpired,
} from './attendanceUtils';
import type {
  AttendanceRecord,
  AttendanceSession,
  Program,
} from '../../types/database';
import AttendanceFormModal from './AttendanceFormModal';

type SessionRow = AttendanceSession & {
  records: Pick<AttendanceRecord, 'attendee_role'>[];
  program: { id: string; name: string } | null;
};

const SELECT_COLUMNS =
  '*, records:attendance_records(attendee_role), program:programs(id,name)';

export default function AttendancePage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [programs, setPrograms] = useState<Pick<Program, 'id' | 'name'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [programFilter, setProgramFilter] = useState<string>('전체');
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [sR, pR] = await Promise.all([
        supabase.from('attendance_sessions').select(SELECT_COLUMNS).order('session_date', { ascending: false }),
        supabase.from('programs').select('id, name').order('created_at', { ascending: false }),
      ]);
      if (sR.error) throw sR.error;
      if (pR.error) throw pR.error;
      setSessions((sR.data ?? []) as SessionRow[]);
      setPrograms(pR.data ?? []);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[attendance] 조회 실패:', raw);
      setErrorMsg('출석 세션을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const visible = useMemo(() => {
    if (programFilter === '전체') return sessions;
    return sessions.filter((s) => s.program_id === programFilter);
  }, [sessions, programFilter]);

  const handleCopy = async (token: string) => {
    const ok = await copyToClipboard(getCheckInUrl(token));
    if (ok) {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    } else {
      setErrorMsg('링크 복사에 실패했어요. 직접 선택해서 복사해 주세요.');
    }
  };

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">✅</span>
        출석체크
      </h1>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500">프로그램 필터</label>
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-w-[14rem]"
          >
            <option value="전체">전체 프로그램</option>
            {programs.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => setModalOpen(true)}>세션 추가</Button>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />
          불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="✅"
          title={programFilter !== '전체' ? '선택한 프로그램의 세션이 없어요.' : '아직 출석 세션이 없어요.'}
          description="첫 세션을 만들어 보세요."
          action={
            <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
              + 세션 추가
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((s) => {
            const summary = calcAttendanceSummary(s.records);
            const expired = isSessionExpired(s.token_expires_at);
            const active = s.check_in_open && !expired;
            return (
              <Card key={s.id} className="hover:border-primary/30 hover:shadow-md transition h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/attendance/${s.id}`} className="flex-1 min-w-0">
                      <CardTitle className="truncate hover:text-primary transition-colors">{s.title}</CardTitle>
                      <div className="text-xs text-muted truncate mt-0.5">{s.program?.name ?? '프로그램 미연결'}</div>
                    </Link>
                    <Badge variant={active ? 'success' : 'default'}>
                      {expired ? '만료' : s.check_in_open ? '열림' : '닫힘'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    <span>{formatDateKo(s.session_date)}</span>
                    {(s.start_time || s.end_time) && (
                      <span>· {formatTime(s.start_time)}{s.end_time ? `~${formatTime(s.end_time)}` : ''}</span>
                    )}
                  </div>
                  {s.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-400" />
                      <span className="truncate">{s.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-slate-400" />
                    <span>총 {summary.total}명 (학생 {summary.student} / 강사 {summary.instructor} / TA {summary.ta})</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); void handleCopy(s.session_token); }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <Copy size={12} />
                      {copiedToken === s.session_token ? '복사됨!' : '체크인 링크 복사'}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AttendanceFormModal
        open={modalOpen}
        programs={programs}
        defaultProgramId={programFilter !== '전체' ? programFilter : undefined}
        session={null}
        onClose={() => setModalOpen(false)}
        onSaved={() => void fetchData()}
      />
    </div>
  );
}
