import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        panel: "0 12px 28px rgba(2, 8, 23, 0.16)",
        soft: "0 10px 24px rgba(2, 8, 23, 0.1)"
      },
      colors: {
        brand: {
          50: "#f5f8ff",
          700: "#0e3a7a",
          800: "#0b2a5b"
        }
      },
      borderRadius: {
        panel: "14px"
      }
    }
  },
  plugins: []
};

export default config;
