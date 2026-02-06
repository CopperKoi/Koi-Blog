import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

const statusMap: Record<number, string> = {
  400: "错误请求",
  401: "未授权",
  403: "禁止访问",
  404: "页面不存在",
  429: "请求过多",
  500: "服务器内部错误",
  502: "网关错误",
  503: "服务不可用",
  504: "网关超时"
};

export function StatusPage({ code }: { code: number }) {
  const title = statusMap[code] || "请求异常";
  return (
    <>
      <SiteHeader />
      <main className="container">
        <section className="card">
          <div className="card-body">
            <h1 style={{ marginBottom: "var(--space-2)" }}>{`${code} · ${title}`}</h1>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
