import animate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  // The app toggles dark mode by adding a `dark` class to its root element.
  darkMode: "class",
  content: ["./index.html", "./*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [animate, typography],
};
