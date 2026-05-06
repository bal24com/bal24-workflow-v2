// bal24 v2 — 출석 세션 상세
// QR 코드 + 체크인 링크 + 역할별 탭 + 수동 추가 + 활성 토글

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ArrowLeft, Loader2, Copy, Plus, Calendar, MapPin,
} from 'lucide-react';
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, Modal, Input,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import {
  ROLE_LABELS, METHOD_LABELS, getCheckInUrl, isSessionExpired, formatTime,
} from './attendanceUtils';
import type {
  AttendanceRecord, AttendanceSession, AttendeeRole,
} from '../../types/database';

type TabKey = AttendeeRole;
const TABS: { key: TabKey; label: string }[] = [
  { key: 'student', label: '교육생' },
  { key: 'instructor', label: '강사' },
  { key: 'ta', label: 'TA' },
];

export default function AttendanceDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('student');
  const [copied, setCopied] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  const lastFetchRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [sR, rR] = await Promise.all([
        supabase.from('attendance_sessions').select('*').eq('id', sessionId).maybeSingle(),
        supabase.from('attendance_records').select('*').eq('session_id', sessionId).order('check_in_at', { ascending: false }),
      ]);
      if (sR.error) throw sR.error;
      if (rR.error) throw rR.error;
      setSession((sR.data ?? null) as AttendanceSession | null);
      setRecords((rR.data ?? []) as AttendanceRecord[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[attendance-detail] 조회 실패:', raw);
      setErrorMsg('세션 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId === lastFetchRef.current) return;
    lastFetchRef.current = sessionId ?? '';
    void fetchData();
  }, [sessionId, fetchData]);

  const checkinUrl = useMemo(
    () => session ? getCheckInUrl(session.session_token) : '',
    [session],
  );

  const filtered = useMemo(
    () => records.filter((r) => r.attendee_role === tab),
    [records, tab],
  );

  const tabCounts = useMemo(() => ({
    student: records.filter((r) => r.attendee_role === 'student').length,
    instructor: records.filter((r) => r.attendee_role === 'instructor').length,
    ta: records.filter((r) => r.attendee_role === 'ta').length,
  }), [records]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checkinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[attendance-detail] 복사 실패:', raw);
      setErrorMsg('링크 복사에 실패했어요.');
    }
  };

  const handleToggleOpen = async () => {
    if (!session) return;
    setTogglePending(true);
    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ check_in_open: !session.check_in_open })
        .eq('id', session.id);
      if (error) throw error;
      setSession({ ...session, check_in_open: !session.check_in_open });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[attendance-detail] 토글 실패:', raw);
      setErrorMsg('상태 변경에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setTogglePending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted">
        <Loader2 size={18} className="animate-spin mr-2" />
        불러오는 중…
      </div>
    );
  }
  if (errorMsg && !session) {
    return (
      <div className="space-y-3">
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
        <Link to="/attendance" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft size={14} />출석 목록으로
        </Link>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-muted mb-3">세션을 찾을 수 없어요.</p>
        <Link to="/attendance" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft size={14} />출석 목록으로
        </Link>
      </div>
    );
  }

  const expired = isSessionExpired(session.token_expires_at);
  const active = session.check_in_open && !expired;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="space-y-2">
        <Link to="/attendance" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary">
          <ArrowLeft size={12} />출석 목록
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-text">{session.title}</h1>
          <Badge variant={active ? 'success' : 'default'}>
            {expired ? '만료' : session.check_in_open ? '열림' : '닫힘'}
          </Badge>
        </div>
        <div className="text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><Calendar size={12} />{formatDateKo(session.session_date)}</span>
          {(session.start_time || session.end_time) && <span>{formatTime(session.start_time)}{session.end_time ? `~${formatTime(session.end_time)}` : ''}</span>}
          {session.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{session.location}</span>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>체크인 QR · 링크</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shrink-0">
              <QRCodeCanvas value={checkinUrl} size={160} level="M" />
            </div>
            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <div className="text-xs text-muted mb-1">체크인 URL</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                    {checkinUrl}
                  </code>
                  <Button type="button" variant="outline" size="sm" leftIcon={<Copy size={14} />} onClick={() => void handleCopy()}>
                    {copied ? '복사됨!' : '복사'}
                  </Button>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={session.check_in_open}
                    onChange={() => void handleToggleOpen()}
                    disabled={togglePending}
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
                  <span className="font-semibold text-slate-700">체크인 링크 활성</span>
                  <span className="text-xs text-muted">({togglePending ? '변경 중…' : session.check_in_open ? '외부 출석 가능' : '외부 출석 불가'})</span>
                </label>
              </div>
              {expired && (
                <div className="rounded-xl bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning">
                  토큰이 만료됐어요. 외부 링크로 출석 불가.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <nav role="tablist" aria-label="역할 탭" className="flex items-center gap-1 border-b border-slate-200 flex-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={['inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors',
                  active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'].join(' ')}
              >
                {t.label}
                <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                  active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'].join(' ')}>
                  {tabCounts[t.key]}
                </span>
              </button>
            );
          })}
        </nav>
        <Button variant="outline" size="sm" leftIcon={<Plus size={14} />} onClick={() => setManualOpen(true)}>수동 추가</Button>
      </div>

      {errorMsg && session && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-12">
              아직 {ROLE_LABELS[tab]} 출석이 없어요.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">이름</th>
                  <th className="text-left px-4 py-2.5 font-semibold">전화</th>
                  <th className="text-left px-4 py-2.5 font-semibold">체크인 시각</th>
                  <th className="text-center px-4 py-2.5 font-semibold">방법</th>
                  <th className="text-left px-4 py-2.5 font-semibold">메모</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-semibold text-text">{r.attendee_name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{r.attendee_phone ?? '–'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{new Date(r.check_in_at).toLocaleString('ko-KR')}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant={r.check_in_method === 'manual' ? 'secondary' : 'primary'}>
                        {METHOD_LABELS[r.check_in_method]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">{r.note ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <ManualAddModal
        open={manualOpen}
        sessionId={session.id}
        role={tab}
        onClose={() => setManualOpen(false)}
        onAdded={() => void fetchData()}
      />
    </div>
  );
}

// ─── 수동 추가 모달 ───────────────────────────────
function ManualAddModal({
  open, sessionId, role, onClose, onAdded,
}: {
  open: boolean;
  sessionId: string;
  role: AttendeeRole;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setName(''); setPhone(''); setErrorMsg(null);
  }, [open]);

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!name.trim()) { setErrorMsg('이름을 입력해 주세요.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('attendance_records').insert({
        session_id: sessionId,
        attendee_role: role,
        attendee_name: name.trim(),
        attendee_phone: phone.trim() || null,
        check_in_method: 'manual',
      });
      if (error) throw error;
      onAdded();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[attendance-detail] 수동 추가 실패:', raw);
      setErrorMsg('수동 추가에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${ROLE_LABELS[role]} 수동 출석`}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} loading={submitting}>추가</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="이름" required value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
        <Input label="전화 (선택)" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} placeholder="010-0000-0000" />
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-3 py-2 text-sm text-danger">{errorMsg}</div>
        )}
      </div>
    </Modal>
  );
}
