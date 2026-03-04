/** @type {import('tailwindcss').Config} */
const withOpacity = (cssVariable) => `rgb(var(${cssVariable}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware core palette
        'canvas': withOpacity('--color-canvas'),
        'canvas-alt': withOpacity('--color-canvas-alt'),
        'ink': withOpacity('--color-ink'),
        'ink-muted': withOpacity('--color-ink-muted'),
        'ink-faint': withOpacity('--color-ink-faint'),
        'border': withOpacity('--color-border'),
        'border-strong': withOpacity('--color-border-strong'),
        // Accent
        'accent': withOpacity('--color-accent'),
        'accent-hover': withOpacity('--color-accent-hover'),
        'accent-foreground': withOpacity('--color-accent-foreground'),
        'accent-muted': 'rgb(var(--color-accent) / 0.16)',
        'accent-secondary': withOpacity('--color-accent-secondary'),
        'accent-secondary-hover': withOpacity('--color-accent-secondary-hover'),
        'accent-secondary-muted': 'rgb(var(--color-accent-secondary) / 0.16)',
        'accent-tertiary': withOpacity('--color-accent-tertiary'),
        'accent-tertiary-hover': withOpacity('--color-accent-tertiary-hover'),
        'accent-tertiary-muted': 'rgb(var(--color-accent-tertiary) / 0.16)',
        // Secondary colors for variety
        'pastel-lavender': '#818CF8',
        'pastel-mint': '#34D399',
        'pastel-peach': '#FBBF24',
        'pastel-sky': '#60A5FA',
        'pastel-lemon': '#FCD34D',
        // Surreal atmosphere
        'void': withOpacity('--color-void'),
        'deep-indigo': withOpacity('--color-deep-indigo'),
        'nebula': withOpacity('--color-nebula-purple'),
        'cold-star': withOpacity('--color-cold-star'),
        'distant-amber': withOpacity('--color-distant-amber'),
        // Status colors - vibrant
        'status-live': withOpacity('--color-status-live'),
        'status-live-bg': 'rgb(var(--color-status-live) / 0.16)',
        'status-upcoming': withOpacity('--color-status-upcoming'),
        'status-upcoming-bg': 'rgb(var(--color-status-upcoming) / 0.16)',
        'status-closed': withOpacity('--color-status-closed'),
        'status-closed-bg': 'rgb(var(--color-status-closed) / 0.16)',
        'status-error': withOpacity('--color-status-error'),
        'status-error-bg': 'rgb(var(--color-status-error) / 0.16)',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Work Sans"', '"Space Grotesk"', 'sans-serif'],
        mono: ['"Inconsolata"', 'monospace'],
      },
      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '400' }],
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.035em', fontWeight: '400' }],
        'display-md': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '400' }],
        'display-sm': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '400' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '-0.01em' }],
        'body': ['0.9375rem', { lineHeight: '1.6', letterSpacing: '-0.005em' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0' }],
        'label': ['0.6875rem', { lineHeight: '1.3', letterSpacing: '0.08em', fontWeight: '500' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0,0,0,0.04)',
        'card': '0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.02)',
        'elevated': '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.04)',
        'float': '0 20px 60px rgba(5,5,12,0.40), 0 8px 20px rgba(5,5,12,0.25)',
        'float-hover': '0 28px 80px rgba(5,5,12,0.50), 0 12px 30px rgba(5,5,12,0.30)',
        'glow-orange': '0 0 20px rgba(255,138,0,0.30), 0 0 60px rgba(255,138,0,0.10)',
        'glow-blue': '0 0 20px rgba(120,200,255,0.25), 0 0 60px rgba(120,200,255,0.08)',
        'glow-purple': '0 0 20px rgba(139,124,255,0.25), 0 0 60px rgba(139,124,255,0.08)',
      },
      transitionTimingFunction: {
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'dream': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'float': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      },
      animation: {
        'fade-up': 'fogRise 1s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'progress': 'progressOvershoot 2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float-idle': 'floatIdle 6s ease-in-out infinite',
        'sky-drift': 'skyDrift 30s ease infinite',
        'geo-rotate': 'geoRotate 120s linear infinite',
        'halo': 'haloExpand 2s ease-out infinite',
        'shimmer-border': 'borderShimmer 3s ease infinite',
      },
      keyframes: {
        fogRise: {
          '0%': { opacity: '0', transform: 'translateY(40px)', filter: 'blur(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        progressOvershoot: {
          '0%': { strokeDashoffset: '283' },
          '70%': { strokeDashoffset: 'calc(var(--progress-target) - 12)' },
          '100%': { strokeDashoffset: 'var(--progress-target)' },
        },
        floatIdle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        skyDrift: {
          '0%, 100%': { backgroundPosition: '0% 0%' },
          '25%': { backgroundPosition: '50% 20%' },
          '50%': { backgroundPosition: '100% 50%' },
          '75%': { backgroundPosition: '50% 80%' },
        },
        geoRotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        haloExpand: {
          '0%': { transform: 'scale(1)', opacity: '0.75' },
          '100%': { transform: 'scale(3.5)', opacity: '0' },
        },
        borderShimmer: {
          '0%': { backgroundPosition: '0% 0%' },
          '50%': { backgroundPosition: '100% 100%' },
          '100%': { backgroundPosition: '0% 0%' },
        },
      },
    },
  },
  plugins: [],
}
