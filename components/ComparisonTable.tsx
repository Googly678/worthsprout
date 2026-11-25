import type { ComparisonFeatureState, ComparisonRow } from "@/lib/article";

export interface ComparisonTableProps {
  rows: ComparisonRow[];
  title?: string;
  note?: string;
  /** 金字塔结构的开篇表格占满内容区宽度，避免横向滚动 */
  wide?: boolean;
}

/** 纯数字价格补 `$`；`Free`、`From $4.99/mo` 这类保持原样 */
function formatPrice(price: string | null): string | null {
  if (!price) return null;
  return /^\d+(\.\d+)?$/.test(price) ? `$${price}` : price;
}

const FEATURE_MARK: Record<ComparisonFeatureState, { mark: string; label: string; className: string }> = {
  yes: { mark: "✓", label: "Yes", className: "text-emerald-600" },
  no: { mark: "✕", label: "No", className: "text-gray-300" },
  partial: { mark: "~", label: "Partial", className: "text-amber-500" },
};

function ProductImage({ row, size }: { row: ComparisonRow; size: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-12 w-12" : "h-14 w-14";

  if (!row.image) {
    return (
      <span
        aria-hidden="true"
        className={`${dimension} flex shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-400`}
      >
        {row.name.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    // 第三方商品图尺寸不可控，静态导出下用原生 img 更稳妥
    <img
      src={row.image.src}
      alt={row.image.alt}
      width={56}
      height={56}
      loading="lazy"
      decoding="async"
      className={`${dimension} shrink-0 rounded-lg bg-white object-contain ring-1 ring-gray-100`}
    />
  );
}

function Score({ rating }: { rating: number | null }) {
  return (
    <span
      className="inline-flex items-baseline gap-0.5 rounded-md bg-gray-900 px-2 py-0.5 text-white"
      aria-label={rating === null ? "No editorial score" : `WorthSprout score: ${rating} out of 10`}
    >
      <span className="text-sm font-bold tabular-nums">{rating === null ? "N/A" : rating.toFixed(1)}</span>
      {rating === null ? null : <span className="text-[10px] opacity-50">/10</span>}
    </span>
  );
}

function FeatureList({ features }: { features: ComparisonRow["features"] }) {
  if (features.length === 0) return <span className="text-gray-400">—</span>;

  return (
    <ul className="space-y-1">
      {features.map((feature) => {
        const meta = FEATURE_MARK[feature.state];

        return (
          <li key={feature.name} className="flex items-start gap-1.5 leading-snug">
            <span aria-hidden="true" className={`mt-px w-3 shrink-0 text-center font-bold ${meta.className}`}>
              {meta.mark}
            </span>
            <span className={feature.state === "no" ? "text-gray-400" : "text-gray-700"}>
              <span className="sr-only">{meta.label}: </span>
              {feature.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SpecList({ specs }: { specs: ComparisonRow["specs"] }) {
  if (specs.length === 0) return <span className="text-gray-400">—</span>;

  return (
    <dl className="space-y-1">
      {specs.map((spec) => (
        <div key={`${spec.label}-${spec.value}`} className="flex gap-1.5 leading-snug">
          {spec.label ? <dt className="shrink-0 text-gray-500">{spec.label}:</dt> : null}
          <dd className="text-gray-800">{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * best-X 文章的“结论先行”对比表：图片、名称、价格、参数、功能、评分、跳转。
 * 数据全部来自 `ws_sections`，与正文产品卡保持同一来源。
 */
export default function ComparisonTable({
  rows,
  title = "The short answer",
  note = "Prices and features were checked at the time of writing. Scores are editorial, out of 10.",
  wide = false,
}: ComparisonTableProps) {
  if (rows.length === 0) return null;

  const headingId = "at-a-glance";

  return (
    <section aria-labelledby={headingId} className={`my-10 ${wide ? "" : "max-w-2xl"}`}>
      <h2 id={headingId} className="text-2xl font-bold tracking-tight text-gray-900">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{note}</p>

      {/* 桌面端：完整表格 */}
      <div className="mt-4 hidden overflow-x-auto rounded-2xl ring-1 ring-gray-200 lg:block">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
              <th scope="col" className="px-4 py-3 font-semibold">Product</th>
              <th scope="col" className="px-3 py-3 font-semibold">Price</th>
              <th scope="col" className="px-3 py-3 font-semibold">Key specs</th>
              <th scope="col" className="px-3 py-3 font-semibold">Features</th>
              <th scope="col" className="px-3 py-3 font-semibold">Score</th>
              <th scope="col" className="px-3 py-3 font-semibold">
                <span className="sr-only">Jump to the full review</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <ProductImage row={row} size="md" />
                    <div className="min-w-0">
                      <p className="font-bold leading-snug text-gray-900">{row.name}</p>
                      {row.label ? <p className="mt-0.5 text-xs text-gray-500">{row.label}</p> : null}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-4 font-semibold text-gray-900">
                  {formatPrice(row.price) ?? <span className="font-normal text-gray-400">—</span>}
                </td>
                <td className="px-3 py-4 text-xs">
                  <SpecList specs={row.specs} />
                </td>
                <td className="px-3 py-4 text-xs">
                  <FeatureList features={row.features} />
                </td>
                <td className="px-3 py-4">
                  <Score rating={row.rating} />
                </td>
                <td className="px-3 py-4">
                  <a
                    href={row.href}
                    className="whitespace-nowrap font-semibold text-gray-900 underline underline-offset-2 hover:text-gray-600"
                  >
                    Review ↓
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 移动端：同一份数据的卡片列表，避免横向滚动 */}
      <ul className="mt-4 space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl bg-white p-4 ring-1 ring-gray-200">
            <div className="flex items-start gap-3">
              <ProductImage row={row} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold leading-snug text-gray-900">{row.name}</p>
                    {row.label ? <p className="mt-0.5 text-xs text-gray-500">{row.label}</p> : null}
                  </div>
                  <Score rating={row.rating} />
                </div>
                {formatPrice(row.price) ? (
                  <p className="mt-1 text-sm font-semibold text-gray-900">{formatPrice(row.price)}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Key specs</p>
                <SpecList specs={row.specs} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Features</p>
                <FeatureList features={row.features} />
              </div>
            </div>

            <a
              href={row.href}
              className="mt-3 inline-block text-sm font-semibold text-gray-900 underline underline-offset-2"
            >
              Jump to the full review ↓
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
