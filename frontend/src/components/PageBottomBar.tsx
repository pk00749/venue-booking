// PageBottomBar — 每个页面的固定底部信息操作栏
// 设计目标：让每个页面（无论长短）都有一条轻量的"上下文 + 主操作"信息条
// - leading: 左侧（通常是返回链接）
// - info: 中右区域（页面关键摘要/计数）
// - trailing: 最右（主 CTA / 工具按钮）
// 至少传入一个 slot 才会渲染整条 bar；纯空时直接返回 null
import clsx from "clsx";
import type { ReactNode } from "react";

export interface PageBottomBarProps {
  leading?: ReactNode;
  info?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function PageBottomBar({ leading, info, trailing, className }: PageBottomBarProps) {
  if (leading === undefined && info === undefined && trailing === undefined) return null;
  return (
    <div
      className={clsx(
        "fixed inset-x-0 bottom-0 z-20 border-t border-canvas-200 bg-white/95",
        "shadow-[0_-2px_18px_rgba(0,0,0,0.06)] backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        {leading !== undefined && <div className="flex shrink-0 items-center">{leading}</div>}
        {info !== undefined && (
          <div className="ml-auto flex min-w-0 items-center gap-2 text-right text-[12px] text-ink-600">
            {info}
          </div>
        )}
        {info === undefined && trailing !== undefined && (
          <div className="ml-auto flex items-center gap-2">{trailing}</div>
        )}
        {info !== undefined && trailing !== undefined && (
          <div className="flex shrink-0 items-center gap-2">{trailing}</div>
        )}
      </div>
    </div>
  );
}
