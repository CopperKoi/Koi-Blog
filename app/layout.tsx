import "./globals.css";
import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "CopperKoi Blog",
  description: "CopperKoi 的个人博客"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/logo.ico" />
      </head>
      <body>
        <Script id="copperkoi-body-comment" strategy="beforeInteractive">
          {`(() => {
  const insertComment = () => {
    const body = document.body;
    if (!body) return;
    const first = body.firstChild;
    if (first && first.nodeType === 8 && first.nodeValue === " CopperKoi ") return;
    body.insertBefore(document.createComment(" CopperKoi "), body.firstChild);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", insertComment, { once: true });
  } else {
    insertComment();
  }
})();`}
        </Script>
        <Script src="/config.js" strategy="beforeInteractive" />
        <Script id="copperkoi-console-art" strategy="afterInteractive">
          {`(() => {
  if (window.__COPPERKOI_ART_PRINTED__) return;
  window.__COPPERKOI_ART_PRINTED__ = true;
  const art = String.raw\`
   ______                            __ __      _
  / ____/___  ____  ____  ___  _____/ //_/___  (_)
 / /   / __ \\/ __ \\/ __ \\/ _ \\/ ___/ ,< / __ \\/ /
/ /___/ /_/ / /_/ / /_/ /  __/ /  / /| / /_/ / /
\\____/\\____/ .___/ .___/\\___/_/  /_/ |_\\____/_/
          /_/   /_/
\`;
  console.log(art);
})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
