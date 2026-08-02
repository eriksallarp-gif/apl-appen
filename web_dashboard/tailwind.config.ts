import type { Config } from 'tailwindcss'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const themeTokens = require('./data/config/colors.js');

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: themeTokens.light.primary,
        secondary: themeTokens.light.secondary,
        background: themeTokens.light.background,
        surface: themeTokens.light.surface,
        border: themeTokens.light.border,
        text: themeTokens.light.text,
        muted: themeTokens.light.muted,
        success: themeTokens.light.success,
        warning: themeTokens.light.warning,
        error: themeTokens.light.error,
        'primary-dark': themeTokens.dark.primary,
        'surface-dark': themeTokens.dark.surface,
        'text-dark': themeTokens.dark.text,
      },
    },
  },
  plugins: [],
}
export default config
