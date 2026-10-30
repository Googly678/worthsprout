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
      <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-100 md:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <div className="overflow-hidden rounded-xl bg-gray-50">
              {pick.image ? (
                <Image
                  src={pick.image.src}
                  alt={pick.image.alt}
                  width={400}
                  height={400}
                  sizes="(min-width: 768px) 280px, 100vw"
                  className="aspect-square h-auto w-full object-contain p-2"
                />
              ) : (
                <div aria-hidden="true" className="aspect-square w-full" />
              )}
            </div>
          </div>

          <div className="md:col-span-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</p>
              <RatingBadge rating={pick.rating} />
            </div>

            <h2 id="top-pick-heading" className="mt-3 text-2xl font-bold leading-tight text-gray-900">
              {pick.name}
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-gray-600">{summary ?? pick.summary}</p>

            {pick.merchantLinks.length > 0 ? (
              <ul className="mt-5 flex flex-col gap-2">
                {pick.merchantLinks.map((link) => (
                  <RetailerLink key={link.url} link={link} />
                ))}
              </ul>
            ) : (
              <p className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-400">
                Price unavailable right now.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
