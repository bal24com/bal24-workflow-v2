// bal24 v2 — 커리큘럼 템플릿 fetch/save/load 유틸 (Stage 3-C)
// curriculum_templates + curriculum_template_items 정규화 2 테이블.

import { supabase } from '../../../../lib/supabase';
import type {
  CurriculumTemplate,
  CurriculumTemplateItem,
  ProgramCurriculum,
} from '../../../../types/database';

export interface TemplateWithItems extends CurriculumTemplate {
  items: CurriculumTemplateItem[];
  /** 차시 수 (목록 미리보기용) */
  item_count: number;
}

/** 차시 메타 (Q5: 매칭 제외 / Q6: session_date 제외) */
export type CurriculumSessionMeta = Pick<
  ProgramCurriculum,
  'session_no' | 'title' | 'content' | 'duration' | 'start_time' | 'end_time' | 'venue'
>;

/** 템플릿 목록 (item_count 집계) */
export async function fetchTemplates(): Promise<TemplateWithItems[]> {
  const { data, error } = await supabase
    .from('curriculum_templates')
    .select('*, items:curriculum_template_items(id)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[curriculum-templates] 목록 조회 실패:', error.message);
    return [];
  }
  type Row = CurriculumTemplate & { items: { id: string }[] };
  return ((data as Row[] | null) ?? []).map((r) => ({
    ...r,
    items: [],
    item_count: r.items?.length ?? 0,
  }));
}

/** 단일 템플릿 + 차시들 fetch (미리보기·가져오기용) */
export async function fetchTemplateDetail(templateId: string): Promise<TemplateWithItems | null> {
  const [tplRes, itemsRes] = await Promise.all([
    supabase
      .from('curriculum_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle(),
    supabase
      .from('curriculum_template_items')
      .select('*')
      .eq('template_id', templateId)
      .order('session_no', { ascending: true }),
  ]);
  if (tplRes.error) {
    console.error('[curriculum-templates] 템플릿 조회 실패:', tplRes.error.message);
    return null;
  }
  if (!tplRes.data) return null;
  if (itemsRes.error) {
    console.error('[curriculum-templates] 템플릿 차시 조회 실패:', itemsRes.error.message);
  }
  const items = (itemsRes.data as CurriculumTemplateItem[] | null) ?? [];
  return {
    ...(tplRes.data as CurriculumTemplate),
    items,
    item_count: items.length,
  };
}

/**
 * 현재 프로그램의 차시 묶음을 템플릿으로 저장.
 * Q5/Q6: 인력 매칭·session_date는 저장 X.
 */
export async function saveAsTemplate(
  name: string,
  description: string | null,
  sessions: CurriculumSessionMeta[],
  createdBy: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!name.trim()) return { ok: false, error: '템플릿 이름을 입력해 주세요.' };
  if (sessions.length === 0) return { ok: false, error: '저장할 차시가 없어요.' };

  const tplRes = await supabase
    .from('curriculum_templates')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      created_by: createdBy,
    })
    .select('id')
    .maybeSingle();
  if (tplRes.error || !tplRes.data) {
    console.error('[curriculum-templates] 템플릿 INSERT 실패:', tplRes.error?.message);
    return { ok: false, error: '템플릿 저장에 실패했어요.' };
  }
  const templateId = (tplRes.data as { id: string }).id;

  const itemsPayload = sessions.map((s) => ({
    template_id: templateId,
    session_no: s.session_no,
    title: s.title,
    content: s.content ?? null,
    duration: s.duration ?? null,
    start_time: s.start_time ?? null,
    end_time: s.end_time ?? null,
    venue: s.venue ?? null,
  }));
  const itemsRes = await supabase.from('curriculum_template_items').insert(itemsPayload);
  if (itemsRes.error) {
    console.error('[curriculum-templates] 템플릿 차시 INSERT 실패:', itemsRes.error.message);
    // 부분 실패 — template은 만들어졌으니 사용자가 다시 시도해서 채울 수 있음
    return { ok: false, error: '템플릿 차시 저장에 실패했어요. (템플릿 메타는 생성됨)' };
  }
  return { ok: true };
}

export type LoadMode = 'replace' | 'append';

/**
 * 템플릿 차시를 프로그램에 가져오기.
 * Q3: replace(덮어쓰기) / append(뒤에 추가) 두 모드.
 */
export async function loadTemplateInto(
  programId: string,
  templateId: string,
  mode: LoadMode,
): Promise<{ ok: boolean; error?: string; insertedCount?: number }> {
  const tpl = await fetchTemplateDetail(templateId);
  if (!tpl) return { ok: false, error: '템플릿을 찾을 수 없어요.' };
  if (tpl.items.length === 0) return { ok: false, error: '템플릿에 차시가 없어요.' };

  let baseSessionNo = 0;
  if (mode === 'replace') {
    const delRes = await supabase.from('program_curriculum').delete().eq('program_id', programId);
    if (delRes.error) {
      console.error('[curriculum-templates] 기존 차시 삭제 실패:', delRes.error.message);
      return { ok: false, error: '기존 차시 삭제에 실패했어요.' };
    }
  } else {
    const maxRes = await supabase
      .from('program_curriculum')
      .select('session_no')
      .eq('program_id', programId)
      .order('session_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxRes.error) {
      console.error('[curriculum-templates] 기존 차시 max 조회 실패:', maxRes.error.message);
      return { ok: false, error: '기존 차시 정보를 불러오지 못했어요.' };
    }
    baseSessionNo = (maxRes.data as { session_no: number } | null)?.session_no ?? 0;
  }

  const payload = tpl.items.map((it, idx) => ({
    program_id: programId,
    session_no: mode === 'replace' ? idx + 1 : baseSessionNo + idx + 1,
    title: it.title,
    content: it.content,
    duration: it.duration,
    start_time: it.start_time,
    end_time: it.end_time,
    venue: it.venue,
    // Q6: session_date는 null로 (프로그램마다 다름)
  }));
  const insRes = await supabase.from('program_curriculum').insert(payload);
  if (insRes.error) {
    console.error('[curriculum-templates] 차시 INSERT 실패:', insRes.error.message);
    return { ok: false, error: '차시 가져오기에 실패했어요.' };
  }
  return { ok: true, insertedCount: payload.length };
}

export async function deleteTemplate(templateId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('curriculum_templates').delete().eq('id', templateId);
  if (error) {
    console.error('[curriculum-templates] 템플릿 삭제 실패:', error.message);
    return { ok: false, error: '템플릿 삭제에 실패했어요.' };
  }
  return { ok: true };
}
