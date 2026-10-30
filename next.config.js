/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 全量静态导出（Cloudflare Pages 托管）
  output: "export",

  // 2. 静态导出没有 Node 运行时，必须关闭 Next 图片优化服务
  images: {
    unoptimized: true,
  },

  // 3. 生成 /reviews/xxx/index.html，避免 Cloudflare Pages 的目录 308 跳转
  trailingSlash: true,

  // 4. 本项目位于父级仓库内（父级也有 package-lock.json），显式指定根目录以消除推断告警
  outputFileTracingRoot: __dirname,

  reactStrictMode: true,
};

module.exports = nextConfig;
