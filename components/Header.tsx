"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { decodeName } from "@/lib/format";
import UserMenu from "./UserMenu";

interface ReviewCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
}

interface NavChild {
  id: number;
  label: string;
  href: string;
}

interface NavItem {
  id: number;
  label: string;
  href: string;
  children: NavChild[];
}

const CATEGORY_ENDPOINT = "https://cms.worthsprout.com/wp-json/wp/v2/review_category?per_page=100";

/**
 * SSR 首帧占位（避免导航从无到有造成布局跳动）。
 * 客户端拉取成功后会被实时分类覆盖；接口失败时保持这份兜底，导航不会消失。
 */
const FALLBACK_NAV: NavItem[] = [
  { id: 6, label: "Health & Fitness", href: "/category/health", children: [] },
  { id: 4, label: "Home & Office", href: "/category/home-office", children: [] },
  { id: 5, label: "Kitchen & Dining", href: "/category/kitchen", children: [] },
  { id: 7, label: "Pets & Outdoors", href: "/category/pets-outdoors", children: [] },
  { id: 3, label: "Tech & Gadgets", href: "/category/tech", children: [] },
];

/** 一级分类（parent === 0）做导航项，其余按 parent 归到对应下拉里 */
function buildNavTree(categories: ReviewCategory[]): NavItem[] {
  return categories
    .filter((category) => category.parent === 0)
    .map((root) => ({
      id: root.id,
      label: decodeName(root.name),
      href: `/category/${root.slug}`,
      children: categories
        .filter((child) => child.parent === root.id)
        .map((child) => ({
          id: child.id,
          label: decodeName(child.name),
          href: `/category/${child.slug}`,
        })),
    }));
}

/** 滚动超过这个距离就收起底栏导航，把纵向空间让给正文和目录 */
const CONDENSE_AT = 80;

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-gray-500">
      <path d="M9 2a7 7 0 1 0 4.2 12.6l3.1 3.1a1 1 0 0 0 1.4-1.4l-3.1-3.1A7 7 0 0 0 9 2Zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 9 4Z" />
    </svg>
  );
}

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 1 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 1 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M3 5h14a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2Zm0 4h14a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2Zm0 4h14a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2Z" />
    </svg>
  );
}

export default function Header() {
  const { profile, isReady, openModal } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCondensed, setIsCondensed] = useState(false);
  const [navItems, setNavItems] = useState<NavItem[]>(FALLBACK_NAV);
  const headerRef = useRef<HTMLElement>(null);

  const closeMenu = () => setIsMenuOpen(false);

  // 拉取 WordPress 分类：一级做导航，二级做 Mega Menu
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(CATEGORY_ENDPOINT, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data: unknown = await response.json();
        if (cancelled || !Array.isArray(data)) return;

        const tree = buildNavTree(data as ReviewCategory[]);
        if (tree.length > 0) setNavItems(tree);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        console.error("[header] 分类加载失败，沿用兜底导航:", error);
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // 滚动后收起底栏导航，给正文和目录腾出纵向空间
  useEffect(() => {
    let frame: number | null = null;

    const measure = () => {
      frame = null;
      setIsCondensed(window.scrollY > CONDENSE_AT);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setIsMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mediaQuery.matches) setIsMenuOpen(false);
    };

    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    closeMenu();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const searchField = (
    <form onSubmit={handleSearch} role="search" className="relative w-full">
      <label htmlFor="site-search" className="sr-only">
        Search reviews
      </label>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
        <SearchIcon />
      </span>
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search reviews and products"
        className="w-full rounded-full bg-gray-100 py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
    </form>
  );

  return (
    <header ref={headerRef} className="sticky top-0 z-50 bg-white">
      {/* 顶栏 */}
      <div className="border-b border-gray-100">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6 md:gap-6">
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMenuOpen((previous) => !previous)}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 md:hidden"
            >
              <MenuIcon isOpen={isMenuOpen} />
            </button>

            <Link
              href="/"
              onClick={closeMenu}
              className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-gray-900 transition-colors hover:text-gray-500"
            >
              <Image
                src="/logo-mark.png"
                alt=""
                width={112}
                height={112}
                aria-hidden="true"
                className="h-7 w-7 rounded-md"
              />
              WorthSprout
            </Link>
          </div>

          <div className="hidden min-w-0 flex-1 md:block">{searchField}</div>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0 md:gap-3">
            {!isReady ? (
              <span aria-hidden="true" className="h-9 w-24 rounded-full bg-gray-100" />
            ) : profile ? (
              <UserMenu />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openModal("login")}
                  className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 md:px-4"
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => openModal("register")}
                  className="hidden rounded-lg px-2 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 sm:inline-flex"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 底栏：水平导航 + Mega Menu —— 滚动后整条收起 */}
      {!isCondensed ? (
        <div className="relative hidden border-b border-gray-100 md:block">
          <nav aria-label="Categories" className="mx-auto max-w-6xl overflow-x-auto px-6">
            <ul className="flex items-center gap-6">
              {navItems.map((item) => (
                <li key={item.id} className="group">
                  <Link
                    href={item.href}
                    className="flex h-11 items-center gap-1 whitespace-nowrap text-sm font-medium text-gray-700 transition-colors group-hover:text-gray-900"
                    aria-haspopup="true"
                  >
                    {item.label}
                    {item.children.length > 0 ? (
                      <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        className="h-3.5 w-3.5 fill-gray-400 transition-transform group-hover:rotate-180"
                      >
                        <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
                      </svg>
                    ) : null}
                  </Link>

                  {item.children.length > 0 ? (
                    <div className="invisible absolute inset-x-0 top-full z-40 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                      <div className="bg-white">
                        <div className="mx-auto max-w-6xl px-6 py-6">
                          <ul className="flex flex-wrap gap-x-10 gap-y-3">
                            {item.children.map((child) => (
                              <Link
                                key={child.id}
                                href={child.href}
                                className="text-sm leading-snug text-gray-700 transition-colors hover:text-gray-900 hover:underline hover:underline-offset-2"
                              >
                                {child.label}
                              </Link>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}

      {/* 移动端抽屉 */}
      {isMenuOpen ? (
        <div id="mobile-menu" className="border-b border-gray-100 bg-white md:hidden">
          <div className="px-6 py-4">{searchField}</div>

          <nav aria-label="Mobile categories" className="mx-auto max-w-6xl px-6 pb-2">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={closeMenu}
                className="block py-3 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}

            <div className="mt-2 border-t border-gray-100 pt-2">
              {profile ? (
                <>
                  <p className="truncate py-2 text-xs text-gray-400">
                    Signed in as {profile.name || profile.username}
                  </p>
                  <Link
                    href="/account"
                    onClick={closeMenu}
                    className="block py-3 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
                  >
                    My profile
                  </Link>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      openModal("login");
                      closeMenu();
                    }}
                    className="block w-full py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
                  >
                    Log In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openModal("register");
                      closeMenu();
                    }}
                    className="block w-full py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
