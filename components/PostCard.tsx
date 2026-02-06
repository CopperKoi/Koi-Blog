import Link from "next/link";
import { formatDate } from "@/lib/posts";

export type PostItem = {
  id: string;
  title: string;
  summary?: string;
  tags?: string[];
  publishAt?: string;
  createdAt?: string;
};

export function PostCard({ post }: { post: PostItem }) {
  return (
    <article className="card">
      <div className="card-body">
        <div className="row space-between">
          <h3 style={{ margin: 0 }}>{post.title}</h3>
          <span className="meta">{formatDate(post.publishAt || post.createdAt)}</span>
        </div>
        <p>{post.summary || ""}</p>
        <div className="row">
          {(post.tags || []).map((tag) => (
            <span className="badge" key={tag}>
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
  );
}
