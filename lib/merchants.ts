/**
 * 商家圆形图标。
 * 图片放在 `public/merchants/<slug>.svg`，slug 由商家名 slug 化得到。
 * 现有文件是首字母占位图，直接覆盖成真实 logo 即可，无需要改代码；
 * 新增商家时把对应文件名加进 `MERCHANT_LOGO_SLUGS`，没有文件的商家回退成首字母徽标。
 */

const MERCHANT_LOGO_SLUGS = new Set(["amazon", "chewy", "walmart", "target", "best-buy", "home-depot", "lowes"]);

/** `Lowe's` → `lowes`，`B&H Photo` → `b-h-photo` */
export function merchantSlug(merchant: string): string {
  return (
    merchant
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "retailer"
  );
}

export function getMerchantLogo(merchant: string): string | null {
  const slug = merchantSlug(merchant);
  return MERCHANT_LOGO_SLUGS.has(slug) ? `/merchants/${slug}.svg` : null;
}

/** 回退徽标使用的首字母：多词取前两个词的首字母 */
export function merchantInitials(merchant: string): string {
  const words = merchant.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();

  return (words[0][0] + words[1][0]).toUpperCase();
}
