export function BrandLogo({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-logo-svg ${className}`}
    >
      <defs>
        <linearGradient id="lyftrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10a37f" />
          <stop offset="60%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <filter id="lyftrGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10a37f" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Rounded Hexagonal / Shield Base */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="8"
        fill="url(#lyftrGrad)"
        filter="url(#lyftrGlow)"
      />

      {/* Stylized Modern AI Vortex / 'L' Monogram Spark */}
      <path
        d="M11 9v11a2.5 2.5 0 0 0 2.5 2.5H21"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 11.5l3.5 3.5-3.5 3.5"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="9.5" r="1.6" fill="#ffffff" />
    </svg>
  );
}
