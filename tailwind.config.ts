import type { Config } from "tailwindcss";
import { fontFamily as _fontFamily } from "tailwindcss/defaultTheme";
import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";

export default (<Partial<Config>>{
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	plugins: [typography, containerQueries],
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

				background: "var(--background)",
				foreground: "var(--foreground)",

				surface: "var(--surface)",
				"surface-foreground": "var(--surface-foreground)",

				primary: "var(--primary)",
				"primary-foreground": "var(--primary-foreground)",

				"primary-contrast": "var(--primary-contrast)",
				"primary-contrast-foreground": "var(--primary-contrast-foreground)",

				"primary-surface": "var(--primary-surface)",
				"primary-surface-foreground": "var(--primary-surface-foreground)",
				"primary-border": "var(--primary-border)",

				hover: "var(--hover)",
				muted: "var(--muted)",
				"muted-foreground": "var(--muted-foreground)",
				border: "var(--border)",
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
});
