// 태그(분류) fetch · 적용 유틸 — 고객사·전문가 공용
// STEP-TAGS-2B-3B

import { supabase } from './supabase';
import type { TagCategory, TagScope } from '../types/database';

/** 특정 scope 의 태그 카테고리 목록 (관리자 등록) */
export async function fetchTagCategories(scope: TagScope): Promise<TagCategory[]> {
  const { data, error } = await supabase
    .from('tag_categories')
    .select('*')
    .eq('scope', scope)
    .order('order_index', { ascending: true });
  if (error) {
    console.error('[tag-categories] 조회 실패:', error.message);
    return [];
  }
  return (data ?? []) as TagCategory[];
}

/** clients 또는 staff_pool row 의 tags 갱신 */
export async function updateRowTags(
  table: 'clients' | 'staff_pool',
  id: string,
  tags: string[],
): Promise<string | null> {
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  const { error } = await supabase
    .from(table)
    .update({ tags: clean, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error(`[tag-update:${table}]`, error.message);
    return '태그 저장에 실패했어요.';
  }
  return null;
}

/** 새 태그 카테고리 추가 (관리자) */
export async function createTagCategory(
  scope: TagScope,
  name: string,
  orderIndex: number,
): Promise<{ data: TagCategory | null; error: string | null }> {
  const { data, error } = await supabase
    .from('tag_categories')
    .insert({ scope, name: name.trim(), order_index: orderIndex })
    .select('*')
    .single();
  if (error) {
    console.error('[tag-categories] 생성 실패:', error.message);
    if (error.message.toLowerCase().includes('duplicate')) {
      return { data: null, error: '이미 같은 이름의 태그가 있어요.' };
    }
    return { data: null, error: '태그 추가에 실패했어요.' };
  }
  return { data: data as TagCategory, error: null };
}

/** 태그 카테고리 삭제 (관리자) */
export async function deleteTagCategory(id: string): Promise<string | null> {
  const { error } = await supabase.from('tag_categories').delete().eq('id', id);
  if (error) {
    console.error('[tag-categories] 삭제 실패:', error.message);
    return '태그 삭제에 실패했어요.';
  }
  return null;
}

/** 태그 순서 변경 (관리자) */
export async function updateTagOrder(id: string, orderIndex: number): Promise<string | null> {
  const { error } = await supabase.from('tag_categories').update({ order_index: orderIndex }).eq('id', id);
  if (error) {
    console.error('[tag-categories] 순서 변경 실패:', error.message);
    return '순서 변경에 실패했어요.';
  }
  return null;
}
