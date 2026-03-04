"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  let out = "";
  for (const ch of value) {
    if (ch === "\\") out += "\\textbackslash{}";
    else if (ch === "{") out += "\\{";
    else if (ch === "}") out += "\\}";
    else if (ch === "$") out += "\\$";
    else if (ch === "&") out += "\\&";
    else if (ch === "#") out += "\\#";
    else if (ch === "_") out += "\\_";
    else if (ch === "%") out += "\\%";
    else if (ch === "^") out += "\\textasciicircum{}";
    else if (ch === "~") out += "\\textasciitilde{}";
    else out += ch;
  }
  return out;
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
    .replace(/[<>]/g, " ")
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
  const fallbackRenderer = new Renderer();

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

  renderer.list = (token) => {
    const html = fallbackRenderer.list.call(renderer, token);
    if (!token.items?.some((item) => item.task)) return html;
    return html.replace(/^<(ul|ol)>/, "<$1 class=\"task-list\">");
  };

  renderer.listitem = (item) => {
    if (!item.task) return fallbackRenderer.listitem.call(renderer, item);
    const checkedAttr = item.checked ? " checked=\"\"" : "";
    const inlineHtml = markdown.parseInline(item.text || "", { renderer, async: false }) as string;
    return `<li class="task-list-item"><input type="checkbox" disabled=""${checkedAttr}><span class="task-list-text">${inlineHtml}</span></li>`;
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
  const previewImgRef = useRef<HTMLImageElement>(null);
  const previewZoomFrameRef = useRef<number | null>(null);
  const previewOffsetRef = useRef({ x: 0, y: 0 });
  const previewDragStartRef = useRef<{ pointerX: number; pointerY: number; originX: number; originY: number } | null>(null);
  const previewDraggedRef = useRef(false);
  const previewScaleRef = useRef(1);
  const previewTargetScaleRef = useRef(1);
  const [canPortal, setCanPortal] = useState(false);
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [preview, setPreview] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const applyPreviewTransform = useCallback((scale: number) => {
    const image = previewImgRef.current;
    if (!image) return;
    const { x, y } = previewOffsetRef.current;
    image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  const stopPreviewZoomAnimation = useCallback(() => {
    if (previewZoomFrameRef.current === null) return;
    window.cancelAnimationFrame(previewZoomFrameRef.current);
    previewZoomFrameRef.current = null;
  }, []);

  const startPreviewZoomAnimation = useCallback(() => {
    if (previewZoomFrameRef.current !== null) return;
    const tick = () => {
      const current = previewScaleRef.current;
      const target = previewTargetScaleRef.current;
      const next = current + (target - current) * 0.24;
      if (Math.abs(target - next) < 0.0015) {
        previewScaleRef.current = target;
        applyPreviewTransform(target);
        previewZoomFrameRef.current = null;
        return;
      }
      previewScaleRef.current = next;
      applyPreviewTransform(next);
      previewZoomFrameRef.current = window.requestAnimationFrame(tick);
    };
    previewZoomFrameRef.current = window.requestAnimationFrame(tick);
  }, [applyPreviewTransform]);

  const closePreview = useCallback(() => {
    stopPreviewZoomAnimation();
    previewDragStartRef.current = null;
    previewDraggedRef.current = false;
    previewOffsetRef.current = { x: 0, y: 0 };
    setIsPreviewDragging(false);
    setPreview(null);
  }, [stopPreviewZoomAnimation]);
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
    setCanPortal(true);
  }, []);

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
      return;
    };

    const onImageClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const image = target.closest("img") as HTMLImageElement | null;
      if (!image || !container.contains(image)) return;
      event.preventDefault();
      const src = image.currentSrc || image.src || "";
      if (!src) return;
      setPreview({
        src,
        alt: image.alt || ""
      });
    };

    container.addEventListener("click", onClick);
    container.addEventListener("click", onImageClick);
    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("click", onImageClick);
    };
  }, [html]);

  useEffect(() => {
    if (!preview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [preview]);

  useEffect(() => {
    if (!preview) return;
    previewScaleRef.current = 1;
    previewTargetScaleRef.current = 1;
    previewOffsetRef.current = { x: 0, y: 0 };
    applyPreviewTransform(1);
    return () => stopPreviewZoomAnimation();
  }, [preview, applyPreviewTransform, stopPreviewZoomAnimation]);

  useEffect(() => {
    if (!preview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview, closePreview]);

  const onPreviewWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!preview) return;
    const clampedDelta = Math.max(-120, Math.min(120, event.deltaY));
    const factor = Math.exp(-clampedDelta * 0.0025);
    const nextTarget = Math.min(
      5,
      Math.max(0.6, Number((previewTargetScaleRef.current * factor).toFixed(4)))
    );
    previewTargetScaleRef.current = nextTarget;
    if (nextTarget <= 1.02) {
      previewOffsetRef.current = { x: 0, y: 0 };
      previewDragStartRef.current = null;
      setIsPreviewDragging(false);
    }
    startPreviewZoomAnimation();
  }, [preview, startPreviewZoomAnimation]);

  const onPreviewPointerDown = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    event.preventDefault();
    event.stopPropagation();
    previewDraggedRef.current = false;
    previewDragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: previewOffsetRef.current.x,
      originY: previewOffsetRef.current.y
    };
    setIsPreviewDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPreviewPointerMove = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    const start = previewDragStartRef.current;
    if (!start) return;
    event.preventDefault();
    const deltaX = event.clientX - start.pointerX;
    const deltaY = event.clientY - start.pointerY;
    if (!previewDraggedRef.current && Math.hypot(deltaX, deltaY) > 3) {
      previewDraggedRef.current = true;
    }
    previewOffsetRef.current = {
      x: start.originX + deltaX,
      y: start.originY + deltaY
    };
    applyPreviewTransform(previewScaleRef.current);
  }, [applyPreviewTransform]);

  const endPreviewDrag = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    previewDragStartRef.current = null;
    setIsPreviewDragging(false);
  }, []);

  const onLightboxClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (previewDraggedRef.current) {
      previewDraggedRef.current = false;
      return;
    }
    closePreview();
  }, [closePreview]);

  const lightbox = preview ? (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={onLightboxClick}
      onWheel={onPreviewWheel}
    >
      <img
        ref={previewImgRef}
        className={`image-lightbox-img${isPreviewDragging ? " is-dragging" : ""}`}
        src={preview.src}
        alt={preview.alt}
        draggable={false}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={onPreviewPointerDown}
        onPointerMove={onPreviewPointerMove}
        onPointerUp={endPreviewDrag}
        onPointerCancel={endPreviewDrag}
      />
    </div>
  ) : null;

  return (
    <>
      <div
        ref={containerRef}
        className="markdown"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {canPortal && lightbox ? createPortal(lightbox, document.body) : lightbox}
    </>
  );
}
