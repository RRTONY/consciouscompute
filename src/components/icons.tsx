const base = "inline-block shrink-0";

type IconProps = { className?: string };

export function DiamondIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={`${base} size-[0.7em] fill-violet align-[0.05em] ${className}`}>
      <path d="M5 0 10 5 5 10 0 5Z" />
    </svg>
  );
}

export function SparkleIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={`${base} size-[0.75em] fill-current align-[0.02em] ${className}`}>
      <path d="M5 0C5.6 3.4 6.6 4.4 10 5 6.6 5.6 5.6 6.6 5 10 4.4 6.6 3.4 5.6 0 5 3.4 4.4 4.4 3.4 5 0Z" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 12" aria-hidden="true" className={`${base} h-[0.6em] w-[1.2em] fill-none stroke-current stroke-[1.6] align-[0.1em] ${className}`}>
      <path d="M1 6h21M17 1.5 22 6l-5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WavyArrowIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 24 12" aria-hidden="true" className={`${base} h-[0.6em] w-[1.2em] fill-none stroke-current stroke-[1.6] align-[0.1em] ${className}`}>
      <path d="M1 6c2.5-4 5-4 7.5 0s5 4 7.5 0H22M17.5 2 22 6l-4.5 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReferenceMarkIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={`${base} size-[0.75em] fill-current stroke-current align-[0.02em] ${className}`}>
      <path d="M2.2 2.2 7.8 7.8M7.8 2.2 2.2 7.8" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="5" cy="0.9" r="0.85" />
      <circle cx="5" cy="9.1" r="0.85" />
      <circle cx="0.9" cy="5" r="0.85" />
      <circle cx="9.1" cy="5" r="0.85" />
    </svg>
  );
}

export function AsterismIcon({ className = "" }: IconProps) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className={`${base} size-[0.8em] fill-none stroke-current align-[0.02em] ${className}`}>
      <path d="M5.00 0.90 5.00 3.90M6.30 1.65 3.70 3.15M3.70 1.65 6.30 3.15M2.30 5.90 2.30 8.90M3.60 6.65 1.00 8.15M1.00 6.65 3.60 8.15M7.70 5.90 7.70 8.90M9.00 6.65 6.40 8.15M6.40 6.65 9.00 8.15" strokeWidth="0.75" strokeLinecap="round" />
    </svg>
  );
}
