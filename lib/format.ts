/**
 * 纯函数格式化工具：服务端 / 客户端共用，无副作用。
 * 所有函数都必须能安全处理 null / undefined / 空字符串。
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  times: "×",
  middot: "·",
  deg: "°",
  trade: "™",
  copy: "©",
  reg: "®",
};

/** WordPress 的 `rendered` 字段带 HTML 实体，标题需要解码后展示 */
export function decodeHtmlEntities(input: string | null | undefined): string {
  if (!input) return "";

  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    try {
      if (entity[0] === "#") {
        const isHex = entity[1] === "x" || entity[1] === "X";
        const code = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
        if (!Number.isFinite(code) || code <= 0) return match;
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES[entity] ?? match;
    } catch {
      return match;
    }
  });
}

/** 去掉标签 + 解码实体，用于 excerpt / 纯文本场景 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  return decodeHtmlEntities(input.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** 空值统一降级为 N/A */
export function orFallback(value: string | null | undefined, fallback = "N/A"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** WordPress 分类名里的实体会原样返回（如 "Health &amp; Fitness"），展示前需解码 */
export function decodeName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

/**
 * ACF 的 rating 可能是 number 也可能是 "9.5" 字符串，
 * 非法值一律返回 null，由 UI 显示 N/A。
 */
export function parseRating(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value.replace(",", "."))
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) return null;

  const clamped = Math.min(parsed, 10);
  return Math.round(clamped * 10) / 10;
}

const BULLET_SEPARATORS = /\r?\n|•|;|\|/;

/**
 * ACF 的 pros / cons 是“一段文字”，运营侧可能用换行、分号或逗号分隔，
 * 这里统一拆成列表，交给 UI 渲染成 ✓ / ✕ 列表。
 */
export function toBulletList(value: string | null | undefined): string[] {
  const text = stripHtml(value);
  if (!text) return [];

  const normalize = (parts: string[]): string[] =>
    parts
      .map((part) => part.replace(/^[-–—*·]\s*/, "").trim())
      .filter((part) => part.length > 0);

  let parts = normalize(text.split(BULLET_SEPARATORS));

  // 只有一项且含逗号时，说明运营用的是逗号分隔
  if (parts.length === 1 && text.includes(",")) {
    parts = normalize(text.split(","));
  }

  return parts;
}

/** 只允许 http/https，防止 ACF 被写入 javascript: 之类的伪协议 */
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** 固定 locale + UTC，保证构建产物与浏览器渲染结果一致（避免 hydration 警告） */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
