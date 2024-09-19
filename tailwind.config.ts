import type { Config } from "tailwindcss";
import { fontFamily as _fontFamily } from "tailwindcss/defaultTheme";
import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import exposeColors from "@tailwind-plugin/expose-colors";
import daisyUI from "daisyui";
import tailwindCSSAnimated from "tailwindcss-animated";

export default <Partial<Config>>{
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  daisyui: {
    themes: ["bumblebee"],
  },
  plugins: [
    daisyUI,
    typography,
    containerQueries,
    exposeColors({
      prefix: "--color",
      extract: ["coral", "zinc"],
      mode: "rgb",
    }),
    tailwindCSSAnimated,
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          "50": "#fff3ed",
          "100": "#ffe2d4",
          "200": "#ffc2a9",
          "300": "#ff8559",
          "400": "#fe6239",
          "500": "#fc3913",
          "600": "#ed1f09",
          "700": "#c51209",
          "800": "#9c1110",
          "900": "#7e1110",
          "950": "#440607",
        },

        background: "oklch(var(--b1))",
        content: "oklch(var(--bc))",

        surface: {
          DEFAULT: "oklch(var(--b2))",
          content: "oklch(var(--bc))",
        },

        primary: {
          DEFAULT: "oklch(var(--p))",
          content: "oklch(var(--pc))",
          surface: "rgba(var(--primary-surface), <alpha-value>)",
          "surface-content":
            "rgba(var(--primary-surface-content), <alpha-value>)",
          border: "rgba(var(--primary-border), <alpha-value>)",
        },

        muted: {
          DEFAULT: "rgba(var(--muted), <alpha-value>)",
          content: "rgba(var(--muted-content), <alpha-value>)",
        },

        hover: "rgba(var(--hover), <alpha-value>)",
        border: "oklch(var(--b3))",
      },
      fontFamily: {
        sans: ["var(--font-sans)", ..._fontFamily.sans],
        serif: ["var(--font-serif)", ..._fontFamily.serif],
      },
      screens: {
        xs: "475px",
      },
    },
  },
};
