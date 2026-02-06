"use client";

import Image from "next/image";
import { MinimalFrameLines } from "@/components/MinimalFrameLines";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="container home-main">
        <section className="home-hero">
          <a href="https://github.com/CopperKoi" target="_blank" rel="noreferrer">
            <Image className="home-avatar" src="/avatar.jpg" alt="CopperKoi avatar" width={240} height={240}
              unoptimized
            />
          </a>
          <div className="home-title">CopperKoi's Blog</div>
        </section>
        <div className="home-quote" aria-label="C’est par l’espoir de te rejoindre que le sentier le plus ardu m’apparaîtra toujours le meilleur.">
          <span className="home-quote-line line-1">
            <span className="home-quote-ghost">C’est par l’espoir de te rejoindre</span>
            <span className="home-quote-typed">
              <span className="home-quote-mask">
                <span className="home-quote-text">C’est par l’espoir de te rejoindre</span>
              </span>
              <span className="home-quote-caret" aria-hidden="true">▌</span>
            </span>
          </span>
          <span className="home-quote-line line-2">
            <span className="home-quote-ghost">que le sentier le plus ardu m’apparaîtra toujours le meilleur.</span>
            <span className="home-quote-typed">
              <span className="home-quote-mask">
                <span className="home-quote-text">que le sentier le plus ardu m’apparaîtra toujours le meilleur.</span>
              </span>
              <span className="home-quote-caret" aria-hidden="true">▌</span>
            </span>
          </span>
        </div>
        <MinimalFrameLines />
      </main>
      <SiteFooter />
    </>
  );
}
