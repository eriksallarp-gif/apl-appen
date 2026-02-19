import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#9E2A2B',
        secondary: '#FF9500',
        'primary-dark': '#FF6B00',
        'primary-light': '#FFB84D',
      },
    },
  },
  plugins: [],
}
export default config
