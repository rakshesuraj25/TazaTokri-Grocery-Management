import { cn } from '@/lib/utils'

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const MARK_SIZE_CLASSES: Record<LogoSize, string> = {
  xs: 'size-5',
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-12',
  xl: 'size-16',
}

export interface LogoMarkProps {
  size?: LogoSize
  className?: string
  /** Set true when paired beside visible wordmark text */
  decorative?: boolean
  label?: string
}

/**
 * Handcrafted woven tokri (basket) with a fresh sprouting leaf.
 * Uses brand leaf-green and warm woven wicker tones that adapt to light/dark themes.
 */
export function LogoMark({
  size = 'md',
  className,
  decorative = false,
  label = 'TazaTokri',
}: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', MARK_SIZE_CLASSES[size], className)}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      data-testid="tazatokri-logo-mark"
    >
      {/* Sprouting fresh leaf rising above the basket */}
      <path
        d="M32 30C32 19 38.5 11 49.5 9.5C50.5 20.5 43 29.5 32 30Z"
        fill="#2d7a4f"
        className="dark:fill-[#4caf7a]"
      />
      <path
        d="M32 30C27 22 21.5 17 15 16.5C15.5 24 22.5 29.5 32 30Z"
        fill="#3d9964"
        className="dark:fill-[#68c793]"
      />
      <path
        d="M32 30C35.5 24 41 18.5 47 13.5"
        stroke="#e8f5ee"
        strokeWidth="2"
        strokeLinecap="round"
        className="dark:stroke-[#0f1a12]"
      />

      {/* Woven tokri basket body (soil/wicker brown wash + woven lattice) */}
      <path
        d="M11 32H53L47.5 52C46.8 54.4 44.6 56 42.1 56H21.9C19.4 56 17.2 54.4 16.5 52L11 32Z"
        fill="#f3eae2"
        stroke="#7c4a2d"
        strokeWidth="2.8"
        strokeLinejoin="round"
        className="dark:fill-[#2c1e16] dark:stroke-[#c28561]"
      />

      {/* Horizontal woven bands */}
      <path
        d="M13.5 40H50.5M16 48H48"
        stroke="#7c4a2d"
        strokeOpacity="0.55"
        strokeWidth="2.1"
        strokeLinecap="round"
        className="dark:stroke-[#c28561]"
      />

      {/* Diagonal / vertical basket ribs */}
      <path
        d="M23 32L25.5 56M32 32V56M41 32L38.5 56"
        stroke="#7c4a2d"
        strokeOpacity="0.6"
        strokeWidth="2.1"
        strokeLinecap="round"
        className="dark:stroke-[#c28561]"
      />

      {/* Sturdy braided top rim of the tokri */}
      <rect
        x="8"
        y="27"
        width="48"
        height="6.5"
        rx="3.25"
        fill="#e6a817"
        stroke="#7c4a2d"
        strokeWidth="2.4"
        className="dark:fill-[#d9a232] dark:stroke-[#c28561]"
      />
    </svg>
  )
}

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  /** Shows Devanagari wordmark "ताजा टोकरी" alongside or below "TazaTokri" */
  showDevanagari?: boolean
  layout?: 'inline' | 'stacked'
  className?: string
  wordmarkClassName?: string
}

const WORDMARK_SIZE: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
}

/**
 * Full TazaTokri brand lockup: woven tokri mark + wordmark ("TazaTokri" / "ताजा टोकरी").
 */
export function Logo({
  size = 'md',
  showDevanagari = false,
  layout = 'inline',
  className,
  wordmarkClassName,
}: LogoProps) {
  const markSize: LogoSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 select-none',
        layout === 'stacked' && 'flex-col gap-1.5 text-center',
        className
      )}
      data-testid="tazatokri-logo"
    >
      <LogoMark size={markSize} decorative />
      <span
        className={cn(
          'flex flex-col leading-none',
          layout === 'inline' ? 'items-start' : 'items-center'
        )}
      >
        <span
          className={cn(
            'font-display text-primary font-extrabold tracking-tight',
            WORDMARK_SIZE[size],
            wordmarkClassName
          )}
        >
          TazaTokri
        </span>
        {showDevanagari && (
          <span
            lang="mr"
            className="text-muted-foreground mt-0.5 text-[11px] font-semibold tracking-normal"
          >
            ताजा टोकरी
          </span>
        )}
      </span>
    </span>
  )
}
