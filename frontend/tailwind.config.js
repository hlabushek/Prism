/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        prism: {
          red: '#db233d',
          orange: '#ef9630',
          yellow: '#f6c82d',
          green: '#1ca369',
          blue: '#1969ae',
          void: '#050811',
          lightBg: '#f8fafc',
          surface: '#090e1a',
          card: '#0f172a',
          cardLight: '#ffffff',
        },
        telegram: {
          bg: 'var(--tg-theme-bg-color, #050811)',
          text: 'var(--tg-theme-text-color, #f8fafc)',
          hint: 'var(--tg-theme-hint-color, #94a3b8)',
          link: 'var(--tg-theme-link-color, #38bdf8)',
          button: 'var(--tg-theme-button-color, #1969ae)',
          buttonText: 'var(--tg-theme-button-text-color, #ffffff)',
          secondaryBg: 'var(--tg-theme-secondary-bg-color, #0e1626)',
        },
        camps: {
          official: '#1969ae', // Royal Blue
          war_z: '#db233d',     // Ruby Red
          business: '#1ca369',  // Emerald Green
          liberal: '#ef9630',   // Amber Orange
          western: '#f6c82d',   // Solar Yellow
        }
      },
      boxShadow: {
        'prism-glow': '0 0 25px rgba(25, 105, 174, 0.25), 0 0 35px rgba(219, 35, 61, 0.15)',
        'prism-sm': '0 0 15px rgba(25, 105, 174, 0.2)',
        'card-light': '0 4px 20px -2px rgba(15, 23, 42, 0.08)',
        'card-dark': '0 4px 25px -2px rgba(0, 0, 0, 0.5)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Newsreader', 'Merriweather', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Space Grotesk', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
