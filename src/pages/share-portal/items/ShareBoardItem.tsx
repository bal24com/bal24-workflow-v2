// 박경수님 2026-06-08 — 프로그램 외부공유 공통 게시판 (역할 무관 program_id 단위 단일 게시판).
// /share/{role}/:token 모든 역할 페이지 하단에 노출. anon 읽기/쓰기.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquare, Plus, FileText, Download, ChevronLeft, Pin, Send } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import { Modal, Input, FileDropZone } from '../../../components/ui';
import { PORTAL_FILES_BUCKET } from '../../portal/portalConstants';
import ItemCard from './ItemCard';

interface PostFile { url: string; name: string; }
interface BoardPost {
  id: string; title: string; content: string;
  author_name: string; author_role: string;
  file_urls: PostFile[]; is_notice: boolean; created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  supporter: '지원기관', beneficiary: '수혜기관', team: '수혜팀', staff: '강사·멘토', operator: '운영', team_club: '동아리',
};

interface Props {
  programId: string;
  /** 현재 외부 페이지의 역할 */
  role: string;
}

export default function ShareBoardItem({ programId, role }: Props) {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BoardPost | null>(null);
  const [writeOpen, setWriteOpen] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_share_posts')
      .select('*')
      .eq('program_id', programId)
      .order('is_notice', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) console.error('[ShareBoardItem] 조회 실패:', error.message);
    setPosts((data ?? []) as BoardPost[]);
    setLoading(false);
  }, [programId]);

  useEffect(() => { void fetchPosts(); }, [fetchPosts]);

  return (
    <ItemCard icon={<MessageSquare size={18} className="text-violet-600" />} title="공통 게시판">
      {selected ? (
        <PostDetail post={selected} onBack={() => setSelected(null)} />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500">참여 기관·팀·강사 누구나 자유롭게 글을 남길 수 있어요.</p>
            <button type="button" onClick={() => setWriteOpen(true)}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
              <Plus size={13} aria-hidden="true" /> 글쓰기
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">아직 글이 없어요. 첫 글을 남겨보세요.</p>
          ) : (
            <ul className="space-y-1.5">
              {posts.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setSelected(p)}
                    className={`w-full text-left rounded-xl border p-3 hover:border-violet-300 transition-colors ${
                      p.is_notice ? 'border-violet-200 bg-violet-50/40' : 'border-slate-100 bg-white'
                    }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.is_notice && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-600 text-white text-[9px] font-black">
                          <Pin size={9} aria-hidden="true" /> 공지
                        </span>
                      )}
                      <span className="text-sm font-bold text-[#1E1B4B] truncate">{p.title}</span>
                      {p.file_urls.length > 0 && (
                        <span className="text-[10px] text-violet-500 inline-flex items-center gap-0.5"><FileText size={10} />{p.file_urls.length}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {p.author_name} · {ROLE_LABEL[p.author_role] ?? p.author_role} · {formatDateKo(p.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <WriteModal open={writeOpen} onClose={() => setWriteOpen(false)}
        programId={programId} role={role}
        onSaved={() => { void fetchPosts(); }} />
    </ItemCard>
  );
}

function PostDetail({ post, onBack }: { post: BoardPost; onBack: () => void }) {
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-violet-700">
        <ChevronLeft size={14} aria-hidden="true" /> 목록
      </button>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {post.is_notice && <span className="px-1.5 py-0.5 rounded bg-violet-600 text-white text-[9px] font-black">공지</span>}
          <h3 className="text-base font-bold text-[#1E1B4B]">{post.title}</h3>
        </div>
        <p className="text-[11px] text-slate-400">
          {post.author_name} · {ROLE_LABEL[post.author_role] ?? post.author_role} · {formatDateKo(post.created_at)}
        </p>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{post.content}</p>
      {post.file_urls.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-100">
          {post.file_urls.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noreferrer"
              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-violet-200 text-xs">
              <span className="truncate pr-3 font-semibold text-slate-600">{f.name}</span>
              <Download size={13} className="text-slate-400" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function WriteModal({ open, onClose, onSaved, programId, role }: {
  open: boolean; onClose: () => void; onSaved: () => void; programId: string; role: string;
}) {
  const [authorName, setAuthorName] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<PostFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleUpload(file: File) {
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const path = `share-board/${programId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(PORTAL_FILES_BUCKET).upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from(PORTAL_FILES_BUCKET).getPublicUrl(path);
      setFiles((prev) => [...prev, { url: data.publicUrl, name: file.name }]);
    } catch (e) {
      console.error('[ShareBoardItem] 업로드 실패:', e);
      setErr('파일 업로드에 실패했어요.');
    }
  }

  async function handleSubmit() {
    setErr(null);
    if (!authorName.trim()) { setErr('작성자(이름·기관)를 입력해 주세요.'); return; }
    if (!title.trim() || !content.trim()) { setErr('제목과 내용을 입력해 주세요.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('program_share_posts').insert({
      program_id: programId,
      author_name: authorName.trim(),
      author_role: role,
      title: title.trim(),
      content: content.trim(),
      file_urls: files,
      is_notice: false,
    });
    setSubmitting(false);
    if (error) { console.error('[ShareBoardItem] 저장 실패:', error.message); setErr('저장에 실패했어요.'); return; }
    setAuthorName(''); setTitle(''); setContent(''); setFiles([]);
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="게시판 글쓰기" size="lg">
      <div className="space-y-3">
        <Input label="작성자 (이름·기관)" value={authorName} onChange={(e) => setAuthorName(e.target.value)}
          placeholder="예) 금성고 김선생" />
        <Input label="제목" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700">내용</label>
          <textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력해 주세요."
            className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-violet-500 resize-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700">파일 첨부 (선택)</label>
          {files.length > 0 && (
            <div className="space-y-1 mb-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <span className="truncate pr-3">{f.name}</span>
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-rose-400 hover:text-rose-600 text-xs">삭제</button>
                </div>
              ))}
            </div>
          )}
          <FileDropZone onFileSelected={handleUpload} disabled={submitting} enablePaste />
        </div>
        {err && <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p>}
        <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
          className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm">
          {submitting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
          <Send size={14} aria-hidden="true" /> 등록
        </button>
      </div>
    </Modal>
  );
}
