import Image from "next/image";
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
        className="group inline-flex items-baseline gap-2 text-sm text-gray-900 transition-colors hover:text-gray-600"
      >
        {link.price ? <span className="font-bold">${link.price}</span> : null}
        {link.price ? <span className="text-gray-500">from</span> : null}
        <span className="underline underline-offset-2">{link.merchant}</span>
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
          →
        </span>
      </a>
    </li>
  );
}

export default function WirecutterProductCard({ pick, summary, label = "Top pick" }: WirecutterProductCardProps) {
  return (
    <section aria-labelledby="top-pick-heading" className="mx-auto max-w-2xl px-6">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="md:col-span-4">
          {pick.image ? (
            <Image
              src={pick.image.src}
              alt={pick.image.alt}
              width={400}
              height={400}
              sizes="(min-width: 768px) 200px, 100vw"
              className="h-auto w-full rounded-lg bg-white object-contain"
            />
          ) : (
            <div aria-hidden="true" className="aspect-square w-full rounded-lg bg-gray-50" />
          )}
        </div>

        <div className="md:col-span-8">
          <p className="text-sm text-gray-500">{label}</p>

          <h2 id="top-pick-heading" className="mt-2 text-xl font-bold text-gray-900">
            {pick.name}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-gray-600">{summary ?? pick.summary}</p>

          {pick.merchantLinks.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {pick.merchantLinks.map((link) => (
                <RetailerLink key={link.url} link={link} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-gray-400">Price unavailable right now.</p>
          )}
        </div>
      </div>
    </section>
  );
}
