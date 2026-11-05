import Image from "next/image";
import { getMerchantLogo, merchantInitials } from "@/lib/merchants";

export interface MerchantLogoProps {
  merchant: string;
  size?: "sm" | "md";
  className?: string;
}

const SIZES = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-[11px]",
} as const;

/** 商家圆形图标：有 logo 文件时用图片，否则回退成首字母徽标 */
export default function MerchantLogo({ merchant, size = "md", className = "" }: MerchantLogoProps) {
  const logo = getMerchantLogo(merchant);
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-gray-200 ${SIZES[size]} ${className}`;

  if (!logo) {
    return (
      <span aria-hidden="true" className={`${base} bg-gray-100 font-bold text-gray-600`}>
        {merchantInitials(merchant)}
      </span>
    );
  }

  return (
    <span aria-hidden="true" className={`${base} bg-white`}>
      <Image src={logo} alt="" width={24} height={24} className="h-full w-full object-contain" />
    </span>
  );
}
