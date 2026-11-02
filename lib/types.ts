/**
 * Headless WordPress (`wp/v2/reviews` + ACF) 的数据结构。
 * 只声明实际消费的字段，避免 `any`。
 */

export interface WPRenderedField {
  rendered: string;
  protected?: boolean;
}

export interface WPFeaturedMedia {
  id?: number;
  source_url?: string;
  alt_text?: string;
  media_type?: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url?: string; width?: number; height?: number }>;
  };
}

export interface WPTerm {
  id?: number;
  taxonomy?: string;
  name?: string;
  slug?: string;
}

export interface WPEmbedded {
  "wp:featuredmedia"?: WPFeaturedMedia[];
  author?: { id?: number; name?: string; slug?: string }[];
  "wp:term"?: WPTerm[][];
}

/** ACF 字段：全部可能缺失或为 null，UI 必须降级而不是报错 */
export interface ACFData {
  product_name?: string | null;
  rating?: number | string | null;
  pros?: string | null;
  cons?: string | null;
  affiliate_link?: string | null;
  /** 预留：若 ACF 增加价格字段，卡片会直接显示 "$139 from Chewy" */
  price?: string | number | null;
}

/** 一篇文章里的一个产品段：由 `_ws_sections` meta 提供 */
export interface ProductSection {
  /** 对应正文 H2 的文本，用于卡片标签和默认锚点 */
  section_heading?: string | null;
  /** 可选：H2 的自定义 id；为空时前端用 section_heading 生成 */
  anchor?: string | null;
  /** 卡片左上角标签，例如 Best overall */
  label?: string | null;
  product_name?: string | null;
  rating?: number | string | null;
  pros?: string | null;
  cons?: string | null;
  image?: string | null;
  price?: string | number | null;
  affiliate_link?: string | null;
  /** 预留多商家；当前插件先存单个 affiliate_link */
  offers?: Array<{
    merchant?: string | null;
    url?: string | null;
    price?: string | number | null;
  }> | null;
}

export interface ReviewPost {
  id: number;
  slug: string;
  date: string;
  modified?: string;
  status?: string;
  type?: string;
  link?: string;
  title: WPRenderedField;
  content: WPRenderedField;
  excerpt?: WPRenderedField;
  featured_media?: number;
  /** 旧 ACF 单产品字段，作为没有 ws_sections 时的 fallback */
  acf?: ACFData | null;
  /** 新多段产品字段，来自 register_rest_field */
  ws_sections?: ProductSection[] | null;
  _embedded?: WPEmbedded;
}

/**
 * 普通 WP 文章（`wp/v2/posts`），承载 About / Privacy / Affiliate Disclosure 等内容页。
 * 字段是 `ReviewPost` 的子集，`lib/present.ts` 的取字段助手可直接复用。
 */
export interface ContentPost {
  id: number;
  slug: string;
  date: string;
  modified?: string;
  title: WPRenderedField;
  content: WPRenderedField;
  excerpt?: WPRenderedField;
  featured_media?: number;
  _embedded?: WPEmbedded;
}

/** 归一化后的封面图，供组件消费 */
export interface FeaturedImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}
