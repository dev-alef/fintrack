import { cn } from "@/lib/utils"

type LogoProps = {
  className?: string
  size?: number
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <img
      src="/icon.svg"
      alt=""
      width={size}
      height={size}
      className={cn("inline-block shrink-0 rounded-[25%] shadow", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}
