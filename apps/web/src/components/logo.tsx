import { cn } from "@/lib/utils"

type LogoProps = {
  className?: string
  size?: number
}

/** Marca transparente; a letra acompanha o tema e as folhas mantêm a identidade. */
export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="8 8 48 48"
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size, color: "var(--text)" }}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 42C8 34 11 24 23 17C30 26 28 37 18 45Z" fill="#bdc89d" />
      <path d="M18 47C25 28 38 16 53 13C52 33 39 48 18 51Z" fill="#71865f" />
      <path d="M22 48V20H34C42 20 45 24 45 29C45 35 41 38 34 38H22" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="square" strokeLinejoin="round" />
    </svg>
  )
}
