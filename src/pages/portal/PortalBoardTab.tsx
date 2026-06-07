// 박경수님 2026-06-07 STEP-PORTAL-BOARD — 포털 공용 게시판 탭 컴포넌트.
// 자유로운 의견 교환 및 파일 업로드 지원.

import { useEffect, useState } from 'react';
import { 
  Loader2, MessageSquare, Plus, FileText, Download, 
  Trash2, ChevronLeft, Calendar, User, Pin
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { Modal, Button, Input, FileDropZone } from '../../components/ui';
import { PORTAL_FILES_BUCKET } from './portalConstants';

interface PostFile {
  url: string;
  name: string;
}

interface PortalPost {
  id: string;
  title: string;
  content: string;
  author_name: string;
  author_role: string;
  file_urls: PostFile[];
  is_notice: boolean;
  created_at: string;
}

interface Props {
  portalId: string;
  beneficiaryOrgId?: string;
  staffId?: string;
  authorName: string;
  authorRole: 'operator' | 'beneficiary_org' | 'staff';
}

export default function PortalBoardTab({ 
  portalId, beneficiaryOrgId, staffId, authorName, authorRole 
}: Props) {
  const [posts, setPosts] = useState<PortalPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PortalPost | null>(null);
  const [writeOpen, setWriteOpen] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, [portalId, beneficiaryOrgId, staffId]);

  async function fetchPosts() {
    setLoading(true);
    try {
      let query = supabase
        .from('portal_posts')
        .select('*')
        .eq('portal_id', portalId)
        .order('is_notice', { ascending: false })
        .order('created_at', { ascending: false });

      // 특정 조직 또는 강사 전용 게시글만 보고 싶을 때의 필터는 기획에 따라 다를 수 있으나,
      // 여기서는 해당 포털 전체의 공용 게시판으로 동작하도록 함.
      // 필요 시 .or(`beneficiary_org_id.eq.${beneficiaryOrgId},beneficiary_org_id.is.null`) 추가 가능.

      const { data, error } = await query;
      if (error) throw error;
      setPosts((data ?? []) as PortalPost[]);
    } catch (err) {
      console.error('[PortalBoardTab] fetchPosts 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading && posts.length === 0) {
    return <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {selectedPost ? (
        <PostDetailView 
          post={selectedPost} 
          onBack={() => setSelectedPost(null)} 
          onDeleted={() => { setSelectedPost(null); fetchPosts(); }}
          canDelete={authorRole === 'operator'} // 일단 운영자만 삭제 가능하도록 설정
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black text-[#1E1B4B] flex items-center gap-2">
              <MessageSquare size={20} className="text-violet-600" />
              자유 게시판
            </h2>
            <button 
              type="button" 
              onClick={() => setWriteOpen(true)}
              className="h-9 px-4 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 shadow-lg shadow-violet-100 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Plus size={14} /> 글쓰기
            </button>
          </div>

          {posts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-16 text-center text-slate-400">
              <MessageSquare size={48} className="mx-auto text-slate-200 mb-4 opacity-50" />
              <p className="text-sm font-medium">아직 등록된 게시글이 없어요.</p>
              <p className="text-xs mt-1">첫 번째 소식을 남겨보세요!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => (
                <PostListItem key={post.id} post={post} onClick={() => setSelectedPost(post)} />
              ))}
            </ul>
          )}
        </>
      )}

      <PostWriteModal 
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        onSaved={fetchPosts}
        portalId={portalId}
        beneficiaryOrgId={beneficiaryOrgId}
        staffId={staffId}
        authorName={authorName}
        authorRole={authorRole}
      />
    </div>
  );
}

function PostListItem({ post, onClick }: { post: PortalPost; onClick: () => void }) {
  return (
    <li className={`bg-white rounded-2xl border transition-all hover:border-violet-300 hover:shadow-md cursor-pointer group ${
      post.is_notice ? 'border-violet-200 bg-violet-50/30' : 'border-violet-50 shadow-sm'
    }`}>
      <button type="button" onClick={onClick} className="w-full p-5 text-left flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {post.is_notice && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-600 text-white text-[9px] font-black uppercase">
                <Pin size={10} /> 공지
              </span>
            )}
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{post.author_name} · {post.author_role === 'operator' ? '운영사' : '참여자'}</span>
          </div>
          <h3 className="text-sm font-black text-[#1E1B4B] group-hover:text-violet-600 transition-colors truncate">{post.title}</h3>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400 font-medium">
          {post.file_urls.length > 0 && (
            <span className="flex items-center gap-1 text-violet-500">
              <FileText size={12} /> {post.file_urls.length}
            </span>
          )}
          <span>{formatDateKo(post.created_at)}</span>
        </div>
      </button>
    </li>
  );
}

function PostDetailView({ post, onBack, onDeleted, canDelete }: { post: PortalPost; onBack: () => void; onDeleted: () => void; canDelete: boolean }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setDeleting(true);
    const { error } = await supabase.from('portal_posts').delete().eq('id', post.id);
    setDeleting(false);
    if (error) alert('삭제 실패: ' + error.message);
    else onDeleted();
  }

  return (
    <div className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="p-4 border-b border-violet-50 flex items-center justify-between gap-4">
        <button onClick={onBack} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex gap-2">
          {canDelete && (
            <button 
              onClick={handleDelete} 
              disabled={deleting}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-rose-400 transition-colors"
            >
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
        </div>
      </div>
      
      <div className="p-6 sm:p-8 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {post.is_notice && <span className="px-1.5 py-0.5 rounded bg-violet-600 text-white text-[9px] font-black uppercase">Notice</span>}
            <h1 className="text-xl font-black text-[#1E1B4B] leading-tight">{post.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400 font-bold border-b border-slate-50 pb-4">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                <User size={12} />
              </div>
              {post.author_name}
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
              {formatDateKo(post.created_at)}
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed min-h-[100px]">
          {post.content}
        </div>

        {post.file_urls.length > 0 && (
          <div className="pt-6 border-t border-slate-50 space-y-3">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <FileText size={12} /> 첨부 파일 ({post.file_urls.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {post.file_urls.map((file, i) => (
                <a 
                  key={i} 
                  href={file.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-violet-200 hover:bg-violet-50 transition-all group"
                >
                  <span className="text-xs font-bold text-slate-600 truncate pr-4">{file.name}</span>
                  <Download size={14} className="text-slate-300 group-hover:text-violet-600" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PostWriteModal({ 
  open, onClose, onSaved, portalId, beneficiaryOrgId, staffId, authorName, authorRole 
}: { 
  open: boolean; 
  onClose: () => void; 
  onSaved: () => void;
  portalId: string;
  beneficiaryOrgId?: string;
  staffId?: string;
  authorName: string;
  authorRole: string;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isNotice, setIsNotice] = useState(false);
  const [files, setFiles] = useState<PostFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('portal_posts').insert({
      portal_id: portalId,
      beneficiary_org_id: beneficiaryOrgId || null,
      staff_id: staffId || null,
      author_name: authorName,
      author_role: authorRole,
      title: title.trim(),
      content: content.trim(),
      is_notice: authorRole === 'operator' ? isNotice : false, // 운영자만 공지 가능
      file_urls: files,
    });
    setSubmitting(false);

    if (error) alert('저장 실패: ' + error.message);
    else {
      onSaved();
      onClose();
      setTitle('');
      setContent('');
      setFiles([]);
    }
  }

  const handleFileUpload = async (file: File) => {
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const path = `portal-posts/${portalId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(PORTAL_FILES_BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from(PORTAL_FILES_BUCKET).getPublicUrl(path);
      setFiles(prev => [...prev, { url: publicUrl, name: file.name }]);
    } catch (err) {
      alert('업로드 실패');
    }
  };

  return (
    <Modal 
      open={open} 
      onClose={onClose} 
      title="새 글 작성" 
      size="lg"
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting} disabled={!title.trim() || !content.trim()}>등록하기</Button>
        </div>
      }
    >
      <form className="space-y-4">
        <Input 
          label="제목" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          placeholder="게시글 제목을 입력해 주세요." 
          required
        />
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700">내용</label>
          <textarea 
            rows={6} 
            value={content} 
            onChange={e => setContent(e.target.value)}
            placeholder="내용을 자유롭게 입력해 주세요."
            className="w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-violet-500 transition-all resize-none"
          />
        </div>
        
        {authorRole === 'operator' && (
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={isNotice} 
              onChange={e => setIsNotice(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <span className="text-sm font-bold text-slate-600 group-hover:text-violet-600">이 글을 상단 공지로 지정하기</span>
          </label>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700">파일 첨부</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600">
                <span className="truncate pr-4">{f.name}</span>
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-rose-400 hover:text-rose-600">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <FileDropZone 
            onFileSelected={handleFileUpload}
            disabled={submitting}
            enablePaste={true}
          />
        </div>
      </form>
    </Modal>
  );
}
