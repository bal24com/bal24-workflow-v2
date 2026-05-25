import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// STEP-BUNDLE-SPLIT — vendor 청크 분리로 메인 청크 크기 감소 + 캐시 효율 향상
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          // React 코어 + 라우터
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            id.match(/node_modules\/react\//) ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react'
          }

          // Supabase 클라이언트
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase'
          }

          // 아이콘 라이브러리 (큼 — 별도 청크)
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide'
          }

          // 문서 생성 (docx/jspdf/html2canvas/xlsx — 무거움 + 일부 페이지만 사용)
          if (
            id.includes('node_modules/docx') ||
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/html2canvas') ||
            id.includes('node_modules/xlsx') ||
            id.includes('node_modules/canvg') ||
            id.includes('node_modules/dompurify')
          ) {
            return 'vendor-docs'
          }

          // QR
          if (id.includes('node_modules/qrcode')) {
            return 'vendor-qr'
          }

          // Recharts (차트 — 무거움. 사용 페이지: 리포트/대시보드/설문 결과)
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/victory-vendor')
          ) {
            return 'vendor-charts'
          }

          // 데이터 페칭/유틸
          if (
            id.includes('node_modules/@tanstack') ||
            id.includes('node_modules/date-fns')
          ) {
            return 'vendor-utils'
          }

          // 그 외 node_modules 일괄
          return 'vendor-other'
        },
      },
    },
  },
})
