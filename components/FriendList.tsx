export type Friend = {
  id: string;
  title: string;
  url: string;
  note?: string;
  sort_order?: number;
};

export function FriendList({
  items,
  admin,
  onDelete,
  onMove,
  onEdit
}: {
  items: Friend[];
  admin?: boolean;
  onDelete?: (id: string) => void;
  onMove?: (id: string, direction: "up" | "down") => void;
  onEdit?: (id: string) => void;
}) {
  if (!items.length) {
    return <div className="notice">暂无友链，欢迎添加～</div>;
  }

  return (
    <div className="post-list">
      {items.map((item, index) => (
        <article className="card" key={item.id}>
          <div className="card-body">
            <div className="row space-between">
              <div>
                <p className="meta">{item.note || " "}</p>
                <a className="link-button" href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </div>
              {admin && (
                <div className="row">
                  <button className="link-button" type="button" onClick={() => onEdit?.(item.id)}>
                    编辑
                  </button>
                  <button className="link-button" type="button" onClick={() => onMove?.(item.id, "up")}>
                    上移
                  </button>
                  <button className="link-button" type="button" onClick={() => onMove?.(item.id, "down")}>
                    下移
                  </button>
                  <button className="link-button" type="button" onClick={() => onDelete?.(item.id)}>
                    删除
                  </button>
                </div>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
