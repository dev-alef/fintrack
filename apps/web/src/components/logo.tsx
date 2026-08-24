import { cn } from "@/lib/utils"

type LogoProps = {
  className?: string
  size?: number
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-primary text-primary-fg shadow",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* base line */}
        <path
          d="M3 20H21"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* ascendant line */}
        <path
          d="M4 16L9 11L13 14L19 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* highlight dot */}
        <circle cx="19" cy="5" r="2.6" fill="currentColor" />
        <circle cx="19" cy="5" r="1" fill="var(--surface)" />
      </svg>
    </div>
  )
}
