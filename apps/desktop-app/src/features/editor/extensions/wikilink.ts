import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { mergeAttributes, Node, nodeInputRule } from "@tiptap/react";

export interface WikiLinkOptions {
  onLinkClick: (target: string) => void;
  HTMLAttributes: Record<string, unknown>;
}

// Regex to match [[target]] or [[target|alias]]
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/;

export const WikiLink = Node.create<WikiLinkOptions>({
  name: "wikiLink",

  group: "inline",

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      onLinkClick: () => {},
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-target"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-target": attributes.target,
        }),
      },
      alias: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-alias"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-alias": attributes.alias,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wikilink"]',
      },
    ];
  },

  renderHTML({
    node,
    HTMLAttributes,
  }: {
    node: ProseMirrorNode;
    HTMLAttributes: Record<string, unknown>;
  }) {
    const displayText = (node.attrs.alias || node.attrs.target) as string;
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "wikilink",
        class: "wikilink",
      }),
      `[[${displayText}]]`,
    ];
  },

  renderText({ node }: { node: ProseMirrorNode }) {
    const displayText = (node.attrs.alias || node.attrs.target) as string;
    return `[[${displayText}]]`;
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: WIKILINK_REGEX,
        type: this.type,
        getAttributes: (match) => {
          return {
            target: match[1],
            alias: match[2] || null,
          };
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const { onLinkClick } = this.options;

    return [
      new Plugin({
        key: new PluginKey("wikiLinkClick"),
        props: {
          handleClick(view: EditorView, pos: number) {
            const { state } = view;
            const node = state.doc.nodeAt(pos);

            if (node?.type.name === "wikiLink") {
              onLinkClick(node.attrs.target as string);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
