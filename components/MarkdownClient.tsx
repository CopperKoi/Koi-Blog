"use client";

import { useEffect, useMemo, useRef } from "react";
import DOMPurify from "dompurify";
import katex from "katex";
import { Marked, Renderer } from "marked";
import hljs from "highlight.js/lib/common";

export type MarkdownHeading = {
  id: string;
  level: number;
  text: string;
};

type MathToken = {
  type: "inlineMath" | "blockMath";
  raw: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeLatexText(value: string) {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}$&#_%])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

function transformMathSource(value: string) {
  return value.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    return `\\texttt{${escapeLatexText(code)}}`;
  });
}

function renderMath(value: string, displayMode: boolean) {
  const source = transformMathSource(value.trim());
  const className = displayMode ? "math-block" : "math-inline";
  try {
    const html = katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
      output: "html"
    });
    return displayMode
      ? `<div class="${className}">${html}</div>`
      : `<span class="${className}">${html}</span>`;
  } catch {
    const escaped = escapeHtml(source);
    return displayMode
      ? `<div class="${className}">$$${escaped}$$</div>`
      : `<span class="${className}">$${escaped}$</span>`;
  }
}

function findMathEnd(src: string, start: number, delimiter: "$" | "$$") {
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === "\\") {
      i += 1;
      continue;
    }
    if (delimiter === "$$") {
      if (src[i] === "$" && src[i + 1] === "$") return i;
    } else if (src[i] === "$") {
      return i;
    }
  }
  return -1;
}

function normalizeHeadingText(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toHeadingSlug(value: string) {
  const normalized = normalizeHeadingText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return normalized || "section";
}

function createHeadingIdResolver() {
  const counts = new Map<string, number>();
  return (value: string) => {
    const base = toHeadingSlug(value);
    const next = (counts.get(base) || 0) + 1;
    counts.set(base, next);
    return next === 1 ? base : `${base}-${next}`;
  };
}

function createMarkdownRenderer(resolveHeadingId: (value: string) => string) {
  const renderer = new Renderer();

  renderer.code = ({ text, lang }) => {
    const safeLanguage =
      lang && /^[a-z0-9+-]+$/i.test(lang) && hljs.getLanguage(lang)
        ? lang
        : "";
    const highlighted = safeLanguage
      ? hljs.highlight(text, { language: safeLanguage }).value
      : hljs.highlightAuto(text).value;
    return `
      <div class="code-block">
        <div class="code-header">
          <div class="dots">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <button class="code-copy" type="button">复制</button>
        </div>
        <pre><code class="hljs ${safeLanguage ? `language-${safeLanguage}` : ""}">${highlighted}</code></pre>
      </div>
    `;
  };

  renderer.link = (token) => {
    const href = token.href || "";
    const title = token.title;
    const text = token.text || href;
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  renderer.heading = (token) => {
    const depth = token.depth;
    const text = token.text || "";
    const id = resolveHeadingId(text);
    const inlineHtml = markdown.parseInline(text, { renderer, async: false }) as string;
    return `<h${depth} id="${id}">${inlineHtml}</h${depth}>`;
  };

  return renderer;
}

const markdown = new Marked({
  gfm: true,
  breaks: true
});

markdown.use({
  extensions: [
    {
      name: "blockMath",
      level: "block",
      start(src: string) {
        return src.indexOf("$$");
      },
      tokenizer(src: string): MathToken | undefined {
        if (!src.startsWith("$$")) return undefined;
        const end = findMathEnd(src, 2, "$$");
        if (end < 0) return undefined;
        const text = src.slice(2, end);
        if (!text.trim()) return undefined;
        const rawEnd = end + 2;
        const lineBreak = src.startsWith("\r\n", rawEnd) ? "\r\n" : src[rawEnd] === "\n" ? "\n" : "";
        return {
          type: "blockMath",
          raw: src.slice(0, rawEnd) + lineBreak,
          text
        };
      },
      renderer(token: unknown) {
        return renderMath((token as MathToken).text, true);
      }
    },
    {
      name: "inlineMath",
      level: "inline",
      start(src: string) {
        return src.indexOf("$");
      },
      tokenizer(src: string): MathToken | undefined {
        if (!src.startsWith("$") || src.startsWith("$$")) return undefined;
        const end = findMathEnd(src, 1, "$");
        if (end < 0) return undefined;
        const text = src.slice(1, end);
        if (!text.trim() || /\n/.test(text) || /^\s|\s$/.test(text)) return undefined;
        return {
          type: "inlineMath",
          raw: src.slice(0, end + 1),
          text
        };
      },
      renderer(token: unknown) {
        return renderMath((token as MathToken).text, false);
      }
    }
  ]
});

export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
  const tokens = markdown.lexer(content || "");
  const resolveHeadingId = createHeadingIdResolver();
  const headings: MarkdownHeading[] = [];

  for (const token of tokens) {
    if (token.type !== "heading") continue;
    const depth = Number((token as { depth?: number }).depth || 0);
    if (!Number.isInteger(depth) || depth < 1 || depth > 6) continue;
    const rawText = String((token as { text?: string }).text || "");
    const text = normalizeHeadingText(rawText) || `H${depth}`;
    headings.push({
      level: depth,
      text,
      id: resolveHeadingId(text)
    });
  }

  return headings;
}

export function MarkdownClient({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => {
    const resolveHeadingId = createHeadingIdResolver();
    const renderer = createMarkdownRenderer(resolveHeadingId);
    const raw = markdown.parse(content || "", { renderer, async: false }) as string;

    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
        const rel = (node.getAttribute("rel") || "").split(" ");
        if (!rel.includes("noopener")) rel.push("noopener");
        if (!rel.includes("noreferrer")) rel.push("noreferrer");
        node.setAttribute("rel", rel.filter(Boolean).join(" "));
      }
    });

    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    DOMPurify.removeAllHooks();
    return clean;
  }, [content]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const button = target.closest(".code-copy") as HTMLElement | null;
      if (!button) return;
      const block = button.closest(".code-block");
      if (!block) return;
      const code = block.querySelector("code");
      if (!code) return;
      const text = code.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        const original = button.textContent;
        button.textContent = "已复制";
        window.setTimeout(() => {
          button.textContent = original || "复制";
        }, 1500);
      });
    };
    container.addEventListener("click", onClick);
    return () => container.removeEventListener("click", onClick);
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
