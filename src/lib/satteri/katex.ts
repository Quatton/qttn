import katex from "katex";
import { defineMdastPlugin, type MdastPluginInput } from "satteri";

type KatexOptions = Parameters<typeof katex.renderToString>[1];

export type SatteriKatexOptions = Omit<
  NonNullable<KatexOptions>,
  "displayMode" | "throwOnError"
> & {
  readonly errorColor?: string;
};

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);

const errorSpan = (source: string, message: string, color: string): string =>
  `<span class="katex-error" title="${escapeHtml(message)}" ` +
  `style="color:${escapeHtml(color)}">${escapeHtml(source)}</span>`;

export const satteriKatex = ({
  errorColor = "#cc0000",
  ...katexOptions
}: SatteriKatexOptions = {}): MdastPluginInput => {
  const render = (source: string, displayMode: boolean) => {
    try {
      return {
        raw: katex.renderToString(source, {
          ...katexOptions,
          displayMode,
          throwOnError: true,
        }),
        mdxExpressions: false,
      };
    } catch (error) {
      return {
        raw: errorSpan(source, String(error), errorColor),
        mdxExpressions: false,
      };
    }
  };

  return defineMdastPlugin({
    name: "satteri-katex",
    math: (node) => render(node.value, true),
    inlineMath: (node) => render(node.value, false),
  });
};

export default satteriKatex;
