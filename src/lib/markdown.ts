import { marked } from "marked";
import TurndownService from "turndown";

// Configure marked for parsing markdown to HTML
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Configure turndown for converting HTML back to markdown
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Add task list support
turndownService.addRule("taskListItem", {
  filter: (node) => {
    return (
      node.nodeName === "LI" &&
      node.parentNode?.nodeName === "UL" &&
      node.querySelector('input[type="checkbox"]') !== null
    );
  },
  replacement: (_content, node) => {
    const checkbox = (node as HTMLElement).querySelector(
      'input[type="checkbox"]'
    );
    const isChecked = checkbox?.hasAttribute("checked") ?? false;
    const textContent = (node as HTMLElement).textContent?.trim() ?? "";
    return `- [${isChecked ? "x" : " "}] ${textContent}\n`;
  },
});

/**
 * Convert markdown text to HTML for TipTap editor
 */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

/**
 * Convert HTML from TipTap editor back to markdown
 */
export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}
