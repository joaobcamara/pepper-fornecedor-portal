import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./providers/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        paper: "#f8f4ef",
        mist: "#eef6f7",
        peach: "#ffe7d8",
        coral: "#ff8058",
        cherry: "#db4d39",
        ink: "#14213d",
        ember: "#f04e23"
      },
      boxShadow: {
        panel: "0 22px 60px rgba(20, 33, 61, 0.10)",
        soft: "0 12px 30px rgba(20, 33, 61, 0.08)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      fontFamily: {
        sans: ["var(--font-sans)"]
      },
      backgroundImage: {
        "pepper-glow":
          "radial-gradient(circle at top left, rgba(255, 183, 131, 0.28), transparent 32%), radial-gradient(circle at top right, rgba(255, 128, 88, 0.18), transparent 28%), linear-gradient(180deg, #fffdfa 0%, #fff6f0 48%, #fffefb 100%)"
      }
    }
  },
  plugins: []
};

export default config;
