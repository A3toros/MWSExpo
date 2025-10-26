/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'header-blue': '#3B82F6', // Blue color for headers
      },
    },
  },
  plugins: [],
}

console.log('Tailwind config with NativeWind preset loaded');
module.exports = config;


