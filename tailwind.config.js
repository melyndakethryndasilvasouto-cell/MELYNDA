/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        game: ['Nunito', 'sans-serif'],
        title: ['"Fredoka One"', 'cursive'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'bounce-in': 'bounce-in 0.5s cubic-bezier(0.68,-0.55,0.27,1.55)',
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'bounce-in': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-5deg)' },
          '75%': { transform: 'rotate(5deg)' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(107,184,255,0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(107,184,255,0.8), 0 0 50px rgba(167,139,250,0.4)' },
        },
      },
    },
  },
  plugins: [],
}
