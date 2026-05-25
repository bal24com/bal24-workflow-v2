// 박경수님 + SkyClaw 2026-05-26 — 흰 화면 방지 ErrorBoundary
// 라우팅·lazy chunk·하위 컴포넌트에서 throw 된 에러를 잡아 사용자에게 친절한 안내 표시.
// React 16+ 에서 class component 만 ErrorBoundary 역할 가능.

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(err: unknown): State {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary] 컴포넌트 트리에서 에러 발생:', err, info);
  }

  handleReload = () => {
    try { sessionStorage.removeItem('bal24_chunk_retry_at'); } catch { /* 무시 */ }
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/home';
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-bold text-text">화면을 표시하지 못했어요</h1>
          <p className="text-sm text-muted">
            새 버전이 배포된 직후거나 일시적인 네트워크 오류일 수 있어요. 새로고침으로 대부분 해결됩니다.
          </p>
          <details className="text-left">
            <summary className="cursor-pointer text-xs text-slate-400 hover:underline">오류 메시지 보기</summary>
            <pre className="mt-2 p-2 rounded bg-slate-50 border border-slate-100 text-[10px] text-slate-600 whitespace-pre-wrap break-words">{this.state.errorMessage}</pre>
          </details>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button type="button" onClick={this.handleReload}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">
              🔄 새로고침
            </button>
            <button type="button" onClick={this.handleHome}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">
              🏠 홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }
}
