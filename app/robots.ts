import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://worthsprout.com").replace(/\/+$/, "");

/** `output: "export"` 下 metadata 路由必须是静态的 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 账户页是纯客户端页面，登录前没有内容可索引
        disallow: ["/account/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
