"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiFetch } from "@/lib/api";
import { formatDate, normalizePost } from "@/lib/posts";

type SearchHit = {
  id: string;
  title: string;
  tags: string[];
  publishAt?: string;
  createdAt?: string;
  snippet: string;
  score: number;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenizeQuery(value: string) {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (!map.has(key)) map.set(key, token);
  }
  return Array.from(map.values());
}

function normalizeMarkdownToText(value: string) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findFirstMatch(text: string, keywords: string[]) {
  const lowerText = text.toLowerCase();
  let firstIndex = -1;
  let firstKeyword = "";
  for (const keyword of keywords) {
    const index = lowerText.indexOf(keyword.toLowerCase());
    if (index === -1) continue;
    if (firstIndex === -1 || index < firstIndex) {
      firstIndex = index;
      firstKeyword = keyword;
    }
  }
  return { index: firstIndex, keyword: firstKeyword };
}

function buildSnippet(text: string, matchIndex: number, matchKeyword: string) {
  if (!text) return "";
  if (matchIndex < 0) {
    return text.length > 140 ? `${text.slice(0, 140).trim()}...` : text;
  }
  const left = Math.max(0, matchIndex - 56);
  const right = Math.min(text.length, matchIndex + matchKeyword.length + 84);
  const prefix = left > 0 ? "..." : "";
  const suffix = right < text.length ? "..." : "";
  return `${prefix}${text.slice(left, right).trim()}${suffix}`;
}

function renderHighlightedText(text: string, keywords: string[]): ReactNode {
  if (!keywords.length || !text) return text;
  const pattern = keywords
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((keyword) => escapeRegExp(keyword))
    .join("|");
  if (!pattern) return text;
  const matcher = new RegExp(`(${pattern})`, "gi");
  const lowerKeywords = new Set(keywords.map((keyword) => keyword.toLowerCase()));
  return text.split(matcher).map((chunk, index) => {
    if (!chunk) return null;
    if (lowerKeywords.has(chunk.toLowerCase())) {
      return (
        <mark className="search-highlight" key={`hit-${index}`}>
          {chunk}
        </mark>
      );
    }
    return <span key={`txt-${index}`}>{chunk}</span>;
  });
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<any[]>([]);
  const [status, setStatus] = useState("加载中...");

  useEffect(() => {
    apiFetch("/posts")
      .then((data) => {
        setPosts((data.items || []).map(normalizePost));
        setStatus("");
      })
      .catch(() => setStatus("暂时无法加载文章"));
  }, []);

  const keywords = useMemo(() => tokenizeQuery(query.trim()), [query]);

  const filtered = useMemo<SearchHit[]>(() => {
    if (!keywords.length) return [];
    const hits: SearchHit[] = [];
    for (const post of posts) {
      const title = String(post.title || "");
      const contentText = normalizeMarkdownToText(String(post.content || ""));
      const titleMatched = keywords.some((keyword) => title.toLowerCase().includes(keyword.toLowerCase()));
      const bodyMatch = findFirstMatch(contentText, keywords);
      const bodyMatched = bodyMatch.index >= 0;
      if (!titleMatched && !bodyMatched) continue;
      hits.push({
        id: String(post.id || ""),
        title,
        tags: (post.tags as string[]) || [],
        publishAt: post.publishAt,
        createdAt: post.createdAt,
        snippet: buildSnippet(contentText, bodyMatch.index, bodyMatch.keyword),
        score: (titleMatched ? 2 : 0) + (bodyMatched ? 1 : 0)
      });
    }
    return hits.sort((left, right) => right.score - left.score);
  }, [keywords, posts]);

  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="form-card">
          <h1 style={{ marginTop: 0 }}>检索文章</h1>
          <p className="meta">支持标题与正文内容检索，结果会展示命中正文片段。</p>
          <label>
            <input
              type="search"
              placeholder="输入关键词后立即检索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </section>

        <section style={{ marginTop: "var(--space-6)" }}>
          <div className="row space-between">
            <h2 style={{ margin: 0 }}>检索结果</h2>
            <span className="meta">
              {query ? `共 ${filtered.length} 篇` : `共 ${posts.length} 篇公开文章`}
            </span>
          </div>
          <div className="post-list" style={{ marginTop: "var(--space-4)" }}>
            {status && <div className="notice">{status}</div>}
            {!status && !query && <div className="notice">请输入关键词以开始检索。</div>}
            {!status && query && filtered.length === 0 && (
              <div className="notice">没有找到匹配的文章，请换个关键词试试。</div>
            )}
            {!status &&
              query &&
              filtered.map((post) => (
                <article className="card" key={post.id}>
                  <div className="card-body">
                    <div className="row space-between">
                      <h3 className="search-result-title">
                        <Link href={`/post/${post.id}`}>
                          {renderHighlightedText(post.title, keywords)}
                        </Link>
                      </h3>
                      <span className="meta">{formatDate(post.publishAt || post.createdAt)}</span>
                    </div>
                    <p className="search-result-snippet">
                      {renderHighlightedText(post.snippet || "正文暂无可检索内容。", keywords)}
                    </p>
                    <div className="row">
                      {post.tags.map((tag) => (
                        <span className="badge" key={`${post.id}-${tag}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="card-actions">
                      <Link className="link-button" href={`/post/${post.id}`}>
                        阅读全文
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
