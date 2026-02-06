"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { apiFetch } from "@/lib/api";

export const dynamic = "force-dynamic";

export default function EntryPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const user = form.get("user");
    const password = form.get("password");

    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: user, password })
      });
      router.push("/studio");
    } catch {
      setError("账号或密码不正确。");
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="form-card" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1 style={{ marginTop: 0 }}>管理员登录</h1>
          <p className="meta">仅供站点维护使用。</p>
          <form className="grid" onSubmit={onSubmit} style={{ marginTop: "var(--space-4)" }}>
            <label>
              账号
              <input name="user" autoComplete="username" required />
            </label>
            <label>
              密码
              <input type="password" name="password" autoComplete="current-password" required />
            </label>
            <button className="button" type="submit">进入后台</button>
          </form>
          {error && <p className="error" style={{ marginTop: "var(--space-3)" }}>{error}</p>}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
