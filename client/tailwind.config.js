/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#09090e',
          card: '#111118',
          panel: '#1a1a26',
          border: '#2a2a3e',
          hover: '#22223a',
        },
        brand: {
          DEFAULT: '#4f46e5',
          light: '#818cf8',
          dark: '#3730a3',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(79,70,229,0.4)',
        'glow-sm': '0 0 10px rgba(79,70,229,0.3)',
        'glow-gold': '0 0 20px rgba(249,115,22,0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float-slow': 'floatSlow 10s ease-in-out infinite',
        'float-medium': 'floatMedium 7s ease-in-out infinite',
        'float-fast': 'floatFast 5s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(79,70,229,0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(79,70,229,0.6)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '33%': { transform: 'translateY(-25px) translateX(15px)' },
          '66%': { transform: 'translateY(15px) translateX(-10px)' },
        },
        floatMedium: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-35px) translateX(20px)' },
        },
        floatFast: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
};
