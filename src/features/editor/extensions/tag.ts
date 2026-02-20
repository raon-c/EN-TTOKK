import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { mergeAttributes, Node, nodeInputRule } from "@tiptap/react";

export interface TagOptions {
  onTagClick: (tag: string) => void;
  HTMLAttributes: Record<string, unknown>;
}

// Regex to match #tag followed by space
const TAG_REGEX = /(?:^|\s)#([a-zA-Z0-9_-]+)\s$/;

export const Tag = Node.create<TagOptions>({
  name: "tag",

  group: "inline",

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      onTagClick: () => {},
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-tag"),
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-tag": attributes.tag,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="tag"]',
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
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "tag",
        class: "tag",
      }),
      `#${node.attrs.tag as string}`,
    ];
  },

  renderText({ node }: { node: ProseMirrorNode }) {
    return `#${node.attrs.tag as string}`;
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: TAG_REGEX,
        type: this.type,
        getAttributes: (match) => {
          return {
            tag: match[1],
          };
        },
      }),
    ];
  },
});
