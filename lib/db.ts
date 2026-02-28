import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      slug TEXT,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'draft',
      visibility TEXT NOT NULL DEFAULT 'public',
      publish_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS posts_publish_idx ON posts (publish_at)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS posts_status_idx ON posts (status, visibility)"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS about (
      id INT PRIMARY KEY DEFAULT 1,
      content TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    "INSERT INTO about (id, content) VALUES (1, '# 关于我\\n\\n这里是你的自我介绍，可以在后台进行编辑。') ON CONFLICT (id) DO NOTHING"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS friend_links (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      note TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    "CREATE INDEX IF NOT EXISTS friend_links_order_idx ON friend_links (sort_order DESC, created_at DESC)"
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS travel_marks (
      adcode INT PRIMARY KEY,
      name TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
