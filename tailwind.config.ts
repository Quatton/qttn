import type { Config } from "tailwindcss";
import { fontFamily as _fontFamily } from "tailwindcss/defaultTheme";
import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import exposeColors from "@tailwind-plugin/expose-colors";

export default <Partial<Config>>{
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  plugins: [
    typography,
    containerQueries,
    exposeColors({
      prefix: "--color",
      extract: ["coral", "zinc"],
      mode: "rgb",
    }),
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

        background: "rgba(var(--background), <alpha-value>)",
        foreground: "rgba(var(--foreground), <alpha-value>)",

        surface: {
          DEFAULT: "rgba(var(--surface), <alpha-value>)",
          foreground: "rgba(var(--surface-foreground), <alpha-value>)",
        },

        primary: {
          DEFAULT: "rgba(var(--primary), <alpha-value>)",
          foreground: "rgba(var(--primary-foreground), <alpha-value>)",
          contrast: "rgba(var(--primary-contrast), <alpha-value>)",
          "contrast-foreground":
            "rgba(var(--primary-contrast-foreground), <alpha-value>)",

          surface: "rgba(var(--primary-surface), <alpha-value>)",
          "surface-foreground":
            "rgba(var(--primary-surface-foreground), <alpha-value>)",
          border: "rgba(var(--primary-border), <alpha-value>)",
        },

        muted: {
          DEFAULT: "rgba(var(--muted), <alpha-value>)",
          foreground: "rgba(var(--muted-foreground), <alpha-value>)",
        },

        hover: "rgba(var(--hover), <alpha-value>)",
        border: "rgba(var(--border), <alpha-value>)",
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
