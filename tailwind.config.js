// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
  // Penting untuk library SDK
  corePlugins: {
    preflight: false, // Nonaktifkan reset CSS agar tidak konflik dengan app konsumen
  },
};