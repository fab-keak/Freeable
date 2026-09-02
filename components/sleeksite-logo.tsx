type FreeableLogoProps = {
  className?: string;
};

export function FreeableLogo({ className }: FreeableLogoProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      style={{ display: 'block', width: '100%', height: '100%' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="7" fill="#071013" />
      <g transform="translate(0.5 1.5)">
        <path d="M4 7.5 27 1.5v8L11.5 14 4 11.25V7.5Z" fill="#D8FF00" />
        <path d="m11.5 14 15.5-4.5v10L11.5 14Z" fill="#718700" />
        <path d="m11.5 14 15.5 5.5L4 27.5v-8l7.5-5.5Z" fill="#D8FF00" />
      </g>
    </svg>
  );
}

// Keep the previous export available while older deployments finish updating.
export const SleekSiteLogo = FreeableLogo;
