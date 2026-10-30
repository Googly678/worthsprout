import Image from "next/image";
import RatingBadge from "./RatingBadge";
import type { MerchantLink, PickItem } from "@/lib/article";

export interface WirecutterProductCardProps {
  pick: PickItem;
  /** 一句话总结；缺省时回退到优点首句 */
  summary?: string;
  label?: string;
}

function RetailerLink({ link }: { link: MerchantLink }) {
  return (
    <li>
      <a
        href={link.url}
        target="_blank"
        rel="nofollow sponsored noopener noreferrer"
        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 transition-colors hover:border-gray-900 hover:bg-gray-50"
      >
        <span className="flex items-baseline gap-2">
          {link.price ? <span className="font-bold">${link.price}</span> : null}
          {link.price ? <span className="text-gray-500">from</span> : null}
          <span className="font-medium underline underline-offset-2">{link.merchant}</span>
        </span>
        <span aria-hidden="true" className="text-gray-400">
          →
        </span>
      </a>
    </li>
  );
}

export default function WirecutterProductCard({ pick, summary, label = "Top pick" }: WirecutterProductCardProps) {
  return (
    <section aria-labelledby="top-pick-heading" className="max-w-2xl">
      <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-gray-100 md:p-8">
        {/* 移动端：小缩略图 + 紧凑文字，CTA 独占整行；桌面端恢复 5/7 分栏 */}
        <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-4 gap-y-4 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5 md:row-span-2">
            <div className="overflow-hidden rounded-lg bg-gray-50 md:rounded-xl">
              {pick.image ? (
                <Image
                  src={pick.image.src}
                  alt={pick.image.alt}
                  width={400}
                  height={400}
                  sizes="(min-width: 768px) 280px, 80px"
                  className="aspect-square h-auto w-full object-contain p-1 md:p-2"
                />
              ) : (
                <div aria-hidden="true" className="aspect-square w-full" />
              )}
            </div>
          </div>

          <div className="min-w-0 md:col-span-7">
            <div className="flex items-center justify-between gap-2 md:gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</p>
              <RatingBadge rating={pick.rating} className="px-2 py-0.5 md:px-3 md:py-1" />
            </div>

            <h2
              id="top-pick-heading"
              className="mt-1 line-clamp-2 text-base font-bold leading-snug text-gray-900 md:mt-3 md:text-2xl md:leading-tight"
            >
              {pick.name}
            </h2>

            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-600 md:mt-2 md:line-clamp-none md:text-sm">
              {summary ?? pick.summary}
            </p>
          </div>

          <div className="col-span-2 md:col-span-7">
            {pick.merchantLinks.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {pick.merchantLinks.map((link) => (
                  <RetailerLink key={link.url} link={link} />
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-400">Price unavailable right now.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
