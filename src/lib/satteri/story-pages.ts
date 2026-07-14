import type { RootContent } from "mdast";
import { defineMdastPlugin } from "satteri";

/**
 * Convert MDX content separated by `----` into:
 * <Story page={n} total={n} [isLast]></Story>
 *
 * Mirrors the logic of lib/remark/story-pages.mjs for the Sätteri pipeline.
 * Notes:
 * - Frontmatter (yaml) and ESM import/export (mdxjsEsm) nodes are preserved at the top.
 * - Page content remains as MDAST nodes, so markdown is still processed.
 */
export const satteriStoryPages = () => {
  const done = new WeakSet();

  return defineMdastPlugin({
    name: "story-pages",
    thematicBreak(node, ctx) {
      const root = ctx.parent(node);
      if (!root || !("children" in root) || done.has(root)) return;
      done.add(root);

      const children = root.children as unknown as RootContent[];

      const firstBodyIndex = children.findIndex((n) => n.type !== "yaml" && n.type !== "mdxjsEsm");

      if (firstBodyIndex === -1) return;

      const headerNodes = children.slice(0, firstBodyIndex);
      const bodyNodes = children.slice(firstBodyIndex);

      const hasSeparator = bodyNodes.some((n) => n.type === "thematicBreak");
      if (!hasSeparator) return;

      const pages: RootContent[][] = [];
      let currentPage: RootContent[] = [];

      for (const n of bodyNodes) {
        if (n.type === "thematicBreak") {
          if (currentPage.length > 0) {
            pages.push(currentPage);
            currentPage = [];
          }
          continue;
        }
        currentPage.push(n);
      }

      if (currentPage.length > 0) {
        pages.push(currentPage);
      }

      if (pages.length === 0) return;

      const pageNodes: RootContent[] = pages.map((pageChildren, index) => {
        const isLast = index === pages.length - 1;
        return {
          type: "mdxJsxFlowElement" as const,
          name: "Story",
          attributes: [
            {
              type: "mdxJsxAttribute" as const,
              name: "page",
              value: String(index + 1),
            },
            ...(isLast ? [{ type: "mdxJsxAttribute" as const, name: "isLast", value: null }] : []),
            {
              type: "mdxJsxAttribute" as const,
              name: "total",
              value: String(pages.length),
            },
          ],
          children: pageChildren,
        };
      }) as RootContent[];

      ctx.setProperty(root, "children", [...headerNodes, ...pageNodes]);
    },
  });
};
