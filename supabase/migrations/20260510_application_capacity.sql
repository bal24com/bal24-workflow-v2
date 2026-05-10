-- ============================================================
-- APPLICATION-CAPACITY: 정원 초과 신청 차단
-- ============================================================

create or replace function check_application_capacity(p_program_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_max       int;
  v_current   int;
  v_start     date;
  v_end       date;
  v_today     date := current_date;
begin
  -- 프로그램 정보 조회
  select max_applicants, application_start_date, application_end_date
  into   v_max, v_start, v_end
  from   programs
  where  id = p_program_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'program_not_found');
  end if;

  -- 신청 기간 체크
  if v_start is not null and v_today < v_start then
    return jsonb_build_object('ok', false, 'reason', 'not_started');
  end if;

  if v_end is not null and v_today > v_end then
    return jsonb_build_object('ok', false, 'reason', 'deadline_passed');
  end if;

  -- 정원 미설정 시 무제한
  if v_max is null or v_max = 0 then
    return jsonb_build_object('ok', true, 'reason', 'unlimited');
  end if;

  -- 현재 유효 신청자 수 (withdrawn·rejected 제외)
  select count(*)
  into   v_current
  from   participant_applications
  where  program_id = p_program_id
    and  status not in ('withdrawn','rejected');

  if v_current >= v_max then
    return jsonb_build_object(
      'ok', false, 'reason', 'capacity_full',
      'max', v_max, 'current', v_current
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'reason', 'available',
    'max', v_max, 'current', v_current,
    'remaining', v_max - v_current
  );
end;
$$;

-- anon 도 호출 가능 (외부 신청 폼에서 사용)
grant execute on function check_application_capacity(uuid) to anon, authenticated;
