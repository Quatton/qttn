import type { Element, ElementContent, RootContent as HastRootContent } from "hast";
import type { FootnoteDefinition, FootnoteReference, RootContent } from "mdast";
import { defineHastPlugin, defineMdastPlugin } from "satteri";

/**
 * Use both:
 *
 * mdastPlugins: [satteriStoryPagesMdast]
 * hastPlugins: [satteriStoryPagesFootnotesHast]
 */

export const satteriStoryPagesMdast = () => {
  const done = new WeakSet<object>();

  return defineMdastPlugin({
    name: "story-pages-mdast",

    thematicBreak(node, ctx) {
      const root = ctx.parent(node);

      if (!root || !("children" in root) || done.has(root)) return;
      done.add(root);

      const children = root.children as unknown as RootContent[];

      const firstBodyIndex = children.findIndex((n) => n.type !== "yaml" && n.type !== "mdxjsEsm");

      if (firstBodyIndex === -1) return;

      const headerNodes = children.slice(0, firstBodyIndex);
      const bodyNodes = children.slice(firstBodyIndex);

      if (!bodyNodes.some((n) => n.type === "thematicBreak")) return;

      const footnoteDefinitions = collectFootnoteDefinitions(bodyNodes);
      const pages = splitPages(bodyNodes);

      if (pages.length === 0) return;

      const pageNodes: RootContent[] = pages.map((pageChildren, index) => {
        const pageNumber = index + 1;
        const isLast = index === pages.length - 1;

        const clonedPageChildren = clone(pageChildren);
        const usedFootnoteIds = collectFootnoteReferences(clonedPageChildren);

        scopeFootnoteReferences(clonedPageChildren, pageNumber);

        const pageFootnoteDefinitions = createPageFootnoteDefinitions({
          pageNumber,
          usedFootnoteIds,
          footnoteDefinitions,
        });

        return {
          type: "mdxJsxFlowElement" as const,
          name: "Story",
          attributes: [
            {
              type: "mdxJsxAttribute" as const,
              name: "page",
              value: String(pageNumber),
            },
            ...(isLast
              ? [
                  {
                    type: "mdxJsxAttribute" as const,
                    name: "isLast",
                    value: null,
                  },
                ]
              : []),
            {
              type: "mdxJsxAttribute" as const,
              name: "total",
              value: String(pages.length),
            },
          ],
          children: [...clonedPageChildren, ...pageFootnoteDefinitions],
        } as RootContent;
      });

      ctx.setProperty(root, "children", [...headerNodes, ...pageNodes]);
    },
  });
};

export const satteriStoryPagesFootnotesHast = () => {
  let globalFootnotesSection: Element | undefined;

  return defineHastPlugin({
    name: "story-pages-footnotes-hast",

    element: [
      {
        filter: ["section"],
        visit(node, ctx) {
          if (!isFootnotesSection(node)) return;

          globalFootnotesSection = clone(node);
          ctx.removeNode(node);
        },
      },
      {
        filter: ["li"],
        // oxlint-disable-next-line no-unused-vars
        visit(node, ctx) {
          /**
           * Defensive cleanup:
           * If Sätteri walks into the generated footnote section before the
           * section removal is applied, don't mutate here. We only need the
           * cloned section captured above.
           */
        },
      },
    ],

    mdxJsxFlowElement: {
      filter: ["Story"],
      visit(node, ctx) {
        const pageNumber = getMdxAttributeValue(node.attributes, "page");
        if (!pageNumber || !globalFootnotesSection) return;

        const pageSection = buildPageFootnotesSection(globalFootnotesSection, pageNumber);
        if (!pageSection) return;

        ctx.appendChild(node, pageSection);
      },
    },
  });
};

/* -------------------------------------------------------------------------- */
/* MDAST helpers                                                              */
/* -------------------------------------------------------------------------- */

function splitPages(bodyNodes: RootContent[]): RootContent[][] {
  const pages: RootContent[][] = [];
  let currentPage: RootContent[] = [];

  for (const node of bodyNodes) {
    if (node.type === "thematicBreak") {
      if (currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [];
      }

      continue;
    }

    // Remove document-level footnote definitions from normal page flow.
    // They are copied back only into pages that reference them.
    if (node.type === "footnoteDefinition") continue;

    currentPage.push(node);
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function collectFootnoteDefinitions(bodyNodes: RootContent[]): Map<string, FootnoteDefinition> {
  const definitions = new Map<string, FootnoteDefinition>();

  for (const node of bodyNodes) {
    if (node.type !== "footnoteDefinition") continue;

    // First definition wins.
    if (!definitions.has(node.identifier)) {
      definitions.set(node.identifier, node);
    }
  }

  return definitions;
}

function collectFootnoteReferences(nodes: RootContent[]): Set<string> {
  const references = new Set<string>();

  for (const node of nodes) {
    walk(node, (child) => {
      if (isFootnoteReference(child)) {
        references.add(child.identifier);
      }
    });
  }

  return references;
}

function scopeFootnoteReferences(nodes: RootContent[], pageNumber: number) {
  for (const node of nodes) {
    walk(node, (child) => {
      if (!isFootnoteReference(child)) return;

      child.identifier = scopedFootnoteIdentifier(child.identifier, pageNumber);

      // Keep label unchanged.
    });
  }
}

function createPageFootnoteDefinitions({
  pageNumber,
  usedFootnoteIds,
  footnoteDefinitions,
}: {
  pageNumber: number;
  usedFootnoteIds: Set<string>;
  footnoteDefinitions: Map<string, FootnoteDefinition>;
}): RootContent[] {
  const pageDefinitions: RootContent[] = [];

  for (const originalId of usedFootnoteIds) {
    const originalDefinition = footnoteDefinitions.get(originalId);
    if (!originalDefinition) continue;

    const pageDefinition = clone(originalDefinition);
    pageDefinition.identifier = scopedFootnoteIdentifier(originalId, pageNumber);

    // Keep label unchanged.

    pageDefinitions.push(pageDefinition as RootContent);
  }

  return pageDefinitions;
}

function scopedFootnoteIdentifier(identifier: string, pageNumber: number): string {
  return `${identifier}__page_${pageNumber}`;
}

function isFootnoteReference(node: unknown): node is FootnoteReference {
  return (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    node.type === "footnoteReference" &&
    "identifier" in node &&
    typeof node.identifier === "string"
  );
}

/* -------------------------------------------------------------------------- */
/* HAST helpers                                                               */
/* -------------------------------------------------------------------------- */

function isFootnotesSection(node: Element): boolean {
  const props = node.properties ?? {};

  return (
    node.tagName === "section" &&
    (props.dataFootnotes === true ||
      props.dataFootnotes === "" ||
      props["data-footnotes"] === true ||
      props["data-footnotes"] === "") &&
    hasClassName(props.className, "footnotes")
  );
}

function buildPageFootnotesSection(
  globalSection: Element,
  pageNumber: string,
): Element | undefined {
  const section = clone(globalSection);
  const list = findFirstElement(section.children, "ol");

  if (!list) return undefined;

  const pageSuffix = `__page_${pageNumber}`;

  const filteredListChildren = list.children.filter((child) => {
    if (child.type === "text") return true;
    if (child.type !== "element") return false;
    if (child.tagName !== "li") return true;

    const id = String(child.properties?.id ?? "");
    return id.endsWith(pageSuffix);
  });

  const hasFootnotesForPage = filteredListChildren.some(
    (child) => child.type === "element" && child.tagName === "li",
  );

  if (!hasFootnotesForPage) return undefined;

  list.tagName = "ul";
  list.properties = {
    ...list.properties,
    className: [...toClassList(list.properties?.className), "footnotes-list"],
  };

  list.children = filteredListChildren.map((child) => {
    if (child.type !== "element" || child.tagName !== "li") return child;

    const id = String(child.properties?.id ?? "");
    const label = getFootnoteHandleFromId(id) ?? id;

    child.properties = {
      ...child.properties,
      dataFootnoteLabel: label,
    };

    const bodyChildren = child.children;
    child.children = [createFootnoteLabelNode(label), createFootnoteBodyNode(bodyChildren)];

    return child;
  });

  return section;
}

function createFootnoteLabelNode(label: string): Element {
  return {
    type: "element",
    tagName: "span",
    properties: {
      className: ["footnote-label"],
    },
    children: [{ type: "text", value: label }],
  };
}

function createFootnoteBodyNode(children: ElementContent[]): Element {
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["footnote-body"],
    },
    children,
  };
}

function getFootnoteHandleFromId(id: string): string | undefined {
  const match = /^user-content-fn-(.+?)(?:__page_\d+)?$/.exec(id);

  return match?.[1];
}

function findFirstElement(
  children: Array<ElementContent | HastRootContent>,
  tagName: string,
): Element | undefined {
  for (const child of children) {
    if (child.type === "element" && child.tagName === tagName) {
      return child;
    }
  }

  return undefined;
}

function getMdxAttributeValue(
  attributes: ReadonlyArray<{
    type: string;
    name?: string | null;
    value?: unknown;
  }>,
  name: string,
): string | undefined {
  const attr = attributes.find(
    (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === name,
  );

  if (!attr) return undefined;

  if (attr.value === null || attr.value === undefined) return "";
  return String(attr.value);
}

function hasClassName(value: unknown, className: string): boolean {
  if (Array.isArray(value)) return value.includes(className);
  if (typeof value === "string") return value.split(/\s+/).includes(className);
  return false;
}

function toClassList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "string") return value.split(/\s+/).filter(Boolean);
  return [];
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

function walk(node: unknown, visitor: (node: any) => void) {
  if (!node || typeof node !== "object") return;

  visitor(node);

  if ("children" in node && Array.isArray((node as any).children)) {
    for (const child of (node as any).children) {
      walk(child, visitor);
    }
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
