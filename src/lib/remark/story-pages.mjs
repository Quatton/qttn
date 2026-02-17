/**
 * Convert MDX content separated by `----` into:
 * <Story page={n}></Story>
 *
 * Notes:
 * - Frontmatter and ESM import/export nodes are preserved at the top.
 * - Page content remains markdown AST nodes, so markdown is still parsed.
 */
export function remarkStoryPages() {
  return (tree) => {
    if (!tree || tree.type !== "root" || !Array.isArray(tree.children)) {
      return;
    }

    const children = tree.children;

    let firstBodyIndex = children.findIndex(
      (node) => node.type !== "yaml" && node.type !== "mdxjsEsm",
    );

    if (firstBodyIndex === -1) {
      return;
    }

    const headerNodes = children.slice(0, firstBodyIndex);
    const bodyNodes = children.slice(firstBodyIndex);

    const hasSeparator = bodyNodes.some((node) => node.type === "thematicBreak");
    if (!hasSeparator) {
      return;
    }

    const pages = [];
    let currentPage = [];

    for (const node of bodyNodes) {
      if (node.type === "thematicBreak") {
        if (currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [];
        }
        continue;
      }

      currentPage.push(node);
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    if (pages.length === 0) {
      return;
    }

    const pageNodes = pages.map((pageChildren, index) => {
      const isLast = index === pages.length - 1;

      return {
        type: "mdxJsxFlowElement",
        name: "Story",
        attributes: [
          {
            type: "mdxJsxAttribute",
            name: "page",
            value: String(index + 1),
          },
          ...(isLast
            ? [
                {
                  type: "mdxJsxAttribute",
                  name: "isLast",
                  value: null,
                },
              ]
            : []),
        ],
        children: pageChildren,
      };
    });

    tree.children = [...headerNodes, ...pageNodes];
  };
}
