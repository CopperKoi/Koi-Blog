"use client";

import { useState } from "react";

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
  onEdit,
  onReorder
}: {
  items: Friend[];
  admin?: boolean;
  onDelete?: (id: string) => void;
  onMove?: (id: string, direction: "up" | "down") => void;
  onEdit?: (id: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  if (!items.length) {
    return <div className="notice">暂无友链，欢迎添加～</div>;
  }

  return (
    <div className="post-list">
      {items.map((item) => {
        const isDragging = draggingId === item.id;
        const isDropTarget = dropTargetId === item.id && draggingId !== item.id;
        return (
          <article
            className={`card${admin ? " friend-card-draggable" : ""}${isDragging ? " is-dragging" : ""}${
              isDropTarget ? " is-drop-target" : ""
            }`}
            key={item.id}
            draggable={Boolean(admin)}
            onDragStart={(event) => {
              if (!admin) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/friend-id", item.id);
              setDraggingId(item.id);
            }}
            onDragOver={(event) => {
              if (!admin) return;
              event.preventDefault();
              if (draggingId && draggingId !== item.id) {
                event.dataTransfer.dropEffect = "move";
                setDropTargetId(item.id);
              }
            }}
            onDrop={(event) => {
              if (!admin) return;
              event.preventDefault();
              const sourceId = event.dataTransfer.getData("text/friend-id") || draggingId;
              setDraggingId(null);
              setDropTargetId(null);
              if (!sourceId || sourceId === item.id) return;
              onReorder?.(sourceId, item.id);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDropTargetId(null);
            }}
          >
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
        );
      })}
    </div>
  );
}
