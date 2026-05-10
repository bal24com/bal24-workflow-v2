// bal24 v2 — STEP-INVITE-APPROVE-PART2 강사 초대 승인/반려 유틸
// v9 approveAndRegisterAsStaff 패턴 차용 (인력풀 머지 + curriculum_staff trigger 의존)

import { supabase } from './supabase';

type Result = { ok: boolean; error?: string };
type ActorRef = { id: string; name: string };
type InvitationRow = {
  id: string; curriculum_id: string | null; staff_pool_id: string | null;
  profile_id: string | null; role: string | null; name: string;
};
type ProfileRow = {
  real_name: string; phone: string | null; email: string | null;
  id_number: string | null; bio: string | null;
  bank_name: string | null; bank_account: string | null; bank_holder: string | null;
  photo_url: string | null;
};

async function logActivity(invId: string, action: 'approve' | 'reject', actor: ActorRef, note: string) {
  // activity_logs 컬럼: target_type/target_id/detail(jsonb) 사용 (스펙의 table_name/record_id/note 대응)
  const { error } = await supabase.from('activity_logs').insert({
    actor_id: actor.id, actor_name: actor.name, action,
    target_type: 'instructor_invitations', target_id: invId, target_name: note,
    detail: { note },
  });
  if (error) console.warn('[invite-approval] activity_logs 기록 실패:', error.message);
}

/** instructor_profiles → staff_pool 머지 (이름+휴대폰 중복 체크) */
async function mergeStaffPool(prof: ProfileRow): Promise<string | null> {
  const name = prof.real_name?.trim();
  if (!name) return null;
  const phone = prof.phone?.trim() || null;
  let q = supabase.from('staff_pool').select('id').eq('name', name);
  q = phone ? q.eq('phone_mobile', phone) : q.is('phone_mobile', null);
  const exist = await q.limit(1).maybeSingle();
  if (exist.error && exist.error.code !== 'PGRST116') {
    console.error('[invite-approval] staff_pool 조회 실패:', exist.error.message); return null;
  }
  const payload = {
    name, phone_mobile: phone,
    email: prof.email?.trim() || null,
    career_summary: prof.bio?.trim() || null,
    bank_name: prof.bank_name?.trim() || null,
    bank_account: prof.bank_account?.trim() || null,
    bank_holder: prof.bank_holder?.trim() || null,
    id_number: prof.id_number?.trim() || null,
    profile_image_url: prof.photo_url || null,
  };
  if (exist.data?.id) {
    const upd = await supabase.from('staff_pool').update(payload).eq('id', exist.data.id);
    if (upd.error) console.error('[invite-approval] staff_pool UPDATE 실패:', upd.error.message);
    return exist.data.id;
  }
  const ins = await supabase.from('staff_pool').insert(payload).select('id').maybeSingle();
  if (ins.error || !ins.data) { console.error('[invite-approval] staff_pool INSERT 실패:', ins.error?.message); return null; }
  return ins.data.id;
}

/** PART B — 승인 (status='수락' → trigger가 curriculum_staff 자동 INSERT) */
export async function approveInvitation(invitationId: string, actorId: string, actorName: string): Promise<Result> {
  try {
    const inv = await supabase.from('instructor_invitations')
      .select('id, curriculum_id, staff_pool_id, profile_id, role, name')
      .eq('id', invitationId).maybeSingle();
    if (inv.error || !inv.data) return { ok: false, error: '초대 정보를 찾을 수 없어요.' };
    const i = inv.data as InvitationRow;

    // instructor_profiles 조회 (있으면 staff_pool 머지)
    let mergedStaffPoolId: string | null = i.staff_pool_id;
    if (!i.staff_pool_id) {
      const prof = await supabase.from('instructor_profiles')
        .select('real_name, phone, email, id_number, bio, bank_name, bank_account, bank_holder, photo_url')
        .eq('invitation_id', invitationId).maybeSingle();
      if (prof.error && prof.error.code !== 'PGRST116') {
        console.error('[invite-approval] profile 조회 실패:', prof.error.message);
      } else if (prof.data) {
        mergedStaffPoolId = await mergeStaffPool(prof.data as ProfileRow);
        if (mergedStaffPoolId) {
          const linkUpd = await supabase.from('instructor_invitations')
            .update({ staff_pool_id: mergedStaffPoolId }).eq('id', invitationId);
          if (linkUpd.error) console.warn('[invite-approval] invitation.staff_pool_id 연결 실패:', linkUpd.error.message);
        }
      }
    }

    // status='수락' UPDATE → trigger trg_curriculum_staff_on_approve가 curriculum_staff INSERT
    const upd = await supabase.from('instructor_invitations')
      .update({ status: '수락', responded_at: new Date().toISOString() }).eq('id', invitationId);
    if (upd.error) return { ok: false, error: '승인 처리에 실패했어요. 다시 시도해 주세요.' };

    await logActivity(invitationId, 'approve', { id: actorId, name: actorName }, '담당자 승인 — curriculum_staff 자동 등록');
    return { ok: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[invite-approval] 승인 실패:', raw);
    return { ok: false, error: '승인 처리 중 오류가 발생했어요.' };
  }
}

/** PART C — 반려 (status='거절' + 사유 기록) */
export async function rejectInvitation(invitationId: string, actorId: string, actorName: string, reason?: string): Promise<Result> {
  try {
    const upd = await supabase.from('instructor_invitations')
      .update({
        status: '거절', responded_at: new Date().toISOString(),
        rejected_reason: reason?.trim() || '담당자 반려',
      }).eq('id', invitationId);
    if (upd.error) return { ok: false, error: '반려 처리에 실패했어요. 다시 시도해 주세요.' };
    await logActivity(invitationId, 'reject', { id: actorId, name: actorName }, reason?.trim() || '담당자 반려');
    return { ok: true };
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[invite-approval] 반려 실패:', raw);
    return { ok: false, error: '반려 처리 중 오류가 발생했어요.' };
  }
}
