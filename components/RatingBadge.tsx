import { parseRating } from "@/lib/format";

export interface RatingBadgeProps {
  /** 0–10 分；缺失或非法时显示 N/A */
  rating?: number | string | null;
  className?: string;
}

/**
 * 矩形评分徽章。
 * 层级靠“字重 + 透明度”建立：主分数加粗不放大，/10 缩小并降低不透明度。
 */
export default function RatingBadge({ rating, className = "" }: RatingBadgeProps) {
  const value = parseRating(rating);

  return (
    <span
      role="img"
      aria-label={value === null ? "No rating available" : `Rated ${value} out of 10`}
      className={`inline-flex items-baseline gap-1 rounded-md bg-gray-900 px-3 py-1 text-white ${className}`}
    >
      <span className="text-lg font-bold tabular-nums">{value === null ? "N/A" : value.toFixed(1)}</span>
      {value === null ? null : <span className="text-sm opacity-50">/10</span>}
    </span>
  );
}
