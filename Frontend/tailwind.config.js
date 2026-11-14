/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        hmkRed: "#e52d35",
        hmkDark: "#171719",
      },
    },
  },
  plugins: [],
};
