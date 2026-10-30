import Image from "next/image";
import Link from "next/link";

const NAV_GROUPS = [
  {
    title: "Reviews",
    links: [
      { href: "/category/audio", label: "Audio" },
      { href: "/category/home-office", label: "Home & Office" },
      { href: "/category/pets-outdoors", label: "Outdoors" },
    ],
  },
  {
    title: "About Us",
    links: [
      { href: "/about-us", label: "Our story" },
      { href: "/about-us/#how-we-research", label: "How we test" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy-policy", label: "Privacy" },
      { href: "/affiliate-disclosure", label: "Affiliate disclosure" },
    ],
  },
];

const SOCIAL_LINKS = [
  {
    href: "https://twitter.com",
    label: "X",
    path: "M11.3 3h2.3l-5 5.7 5.9 7.8h-4.6l-3.6-4.7-4.1 4.7H.4l5.4-6.1L.1 3h4.7l3.2 4.3L11.3 3Zm-.8 12h1.3L4.5 4.4H3.1L10.5 15Z",
  },
  {
    href: "https://instagram.com",
    label: "Instagram",
    path: "M8 1.5c2.1 0 2.4 0 3.2.1.8 0 1.3.2 1.6.3.4.2.7.4 1 .7.3.3.5.6.7 1 .1.3.2.8.3 1.6.1.8.1 1.1.1 3.2s0 2.4-.1 3.2c0 .8-.2 1.3-.3 1.6-.2.4-.4.7-.7 1-.3.3-.6.5-1 .7-.3.1-.8.2-1.6.3-.8.1-1.1.1-3.2.1H4.8c-.8 0-1.3-.2-1.6-.3-.4-.2-.7-.4-1-.7-.3-.3-.5-.6-.7-1-.1-.3-.2-.8-.3-1.6C1.1 10.4 1.1 10.1 1.1 8s0-2.4.1-3.2c0-.8.2-1.3.3-1.6.2-.4.4-.7.7-1 .3-.3.6-.5 1-.7.3-.1.8-.2 1.6-.3.8-.1 1.1-.1 3.2-.1Zm0 3.6a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm0 4.8a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8Zm3.7-4.9a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0Z",
  },
  {
    href: "https://youtube.com",
    label: "YouTube",
    path: "M15.2 4.6c-.2-.7-.7-1.2-1.4-1.4C12.6 3 8 3 8 3s-4.6 0-5.8.2c-.7.2-1.2.7-1.4 1.4C.6 5.8.6 8 .6 8s0 2.2.2 3.4c.2.7.7 1.2 1.4 1.4C3.4 13 8 13 8 13s4.6 0 5.8-.2c.7-.2 1.2-.7 1.4-1.4.2-1.2.2-3.4.2-3.4s0-2.2-.2-3.4ZM6.5 10.3V5.7L10.4 8 6.5 10.3Z",
  },
];

export default function Footer() {
  return (
    <footer className="mt-20 bg-gray-900 text-gray-400">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="md:flex md:items-start md:justify-between md:gap-12">
          <div className="md:max-w-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-base font-black uppercase tracking-tight text-white"
            >
              <Image src="/logo-mark.png" alt="" width={112} height={112} aria-hidden="true" className="h-6 w-6 rounded" />
              WorthSprout
            </Link>
            <p className="mt-2 hidden text-xs leading-relaxed text-gray-400 sm:block">
              Independent, hands-on product reviews. No sponsored placements, no paid scores.
            </p>
          </div>

          {/* 桌面端与品牌块并成一行，移动端仍是三列并排，避免页脚过高 */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-8 md:mt-0 md:gap-16">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white">{group.title}</h2>
                <ul className="mt-3 space-y-1.5">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <Link href={link.href} className="text-xs leading-relaxed transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-row items-center justify-between gap-3 border-t border-gray-800 pt-4">
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} WorthSprout. All rights reserved.</p>

          <ul className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
                    <path d={social.path} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
