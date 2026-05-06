/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // bal24 v2 디자인 토큰 (CSS Variables RGB 채널 + opacity modifier 호환)
        primary:   'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        accent:    'rgb(var(--color-accent) / <alpha-value>)',
        success:   'rgb(var(--color-success) / <alpha-value>)',
        warning:   'rgb(var(--color-warning) / <alpha-value>)',
        danger:    'rgb(var(--color-danger) / <alpha-value>)',
        bg:        'rgb(var(--color-bg) / <alpha-value>)',
        card:      'rgb(var(--color-card) / <alpha-value>)',
        sidebar:   'rgb(var(--color-sidebar) / <alpha-value>)',
        text:      'rgb(var(--color-text) / <alpha-value>)',
        muted:     'rgb(var(--color-muted) / <alpha-value>)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        btn:  'var(--radius-btn)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Noto Sans KR',
          'sans-serif',
        ],
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
