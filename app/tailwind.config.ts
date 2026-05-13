import type { Config } from "tailwindcss";

// Brand palette — these are the SAME values as the CSS variables in app/globals.css.
// Registering them here generates the full `bg-X / text-X / border-X` set plus
// opacity variants (`bg-parchment-2/40`, `border-gold/40`, etc.).

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: "#2D0808",
        "maroon-mid": "#8B1A1A",
        gold: "#C5A028",
        saffron: "#E07B39",
        parchment: "#FAF3E0",
        "parchment-2": "#F4EAD0",
        ink: "#1A0A00",
        "muted-warm": "#7A6652",
        line: "#E0D4B8",
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        body: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
