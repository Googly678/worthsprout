import Link from "next/link";

/**
 * 联盟营销告知：固定在文章最顶端（首屏可见），不随滚动吸顶。
 * 这与 FTC 的“披露需出现在推荐内容之前”要求一致，同时不占用滚动时的纵向空间。
 */
export default function AffiliateBar() {
  return (
    <div className="border-b border-gray-200 bg-gray-100 py-3">
      <p className="mx-auto max-w-2xl px-6 text-center text-xs leading-4 text-gray-600">
        <span className="hidden sm:inline">We independently review everything we recommend. </span>
        We may earn a commission.{" "}
        <Link href="/affiliate-disclosure" className="underline underline-offset-2 hover:text-gray-900">
          Learn more
        </Link>
      </p>
    </div>
  );
}
