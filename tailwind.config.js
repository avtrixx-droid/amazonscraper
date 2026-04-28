/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        border: 'hsl(217 33% 15%)',
        background: 'hsl(222 47% 5%)',
        foreground: 'hsl(210 40% 96%)',
        primary: {
          DEFAULT: 'hsl(25 95% 53%)',
          foreground: 'hsl(0 0% 100%)',
        },
        card: {
          DEFAULT: 'hsl(222 47% 8%)',
          foreground: 'hsl(210 40% 96%)',
        },
        muted: {
          DEFAULT: 'hsl(217 33% 12%)',
          foreground: 'hsl(215 20% 55%)',
        },
        accent: {
          DEFAULT: 'hsl(217 91% 60%)',
          foreground: 'hsl(0 0% 100%)',
        },
        destructive: {
          DEFAULT: 'hsl(0 72% 51%)',
        },
        success: {
          DEFAULT: 'hsl(142 71% 45%)',
        },
        warning: {
          DEFAULT: 'hsl(38 92% 50%)',
        },
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};