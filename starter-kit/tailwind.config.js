/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts,scss}"],
  theme: { extend: { colors: {
        darkBlue: '#0e3a4c'
      }} },
  safelist: [
    'bg-emerald-50','text-emerald-700','border-emerald-100',
    'bg-amber-50','text-amber-700','border-amber-100',
    'bg-red-50','text-red-700','border-red-100',
    'bg-gray-50','text-gray-700','border-gray-200',
    'md:grid-cols-1','md:grid-cols-2','md:grid-cols-3','md:grid-cols-4','md:grid-cols-5','md:grid-cols-6'
  ],
  plugins: [],
};