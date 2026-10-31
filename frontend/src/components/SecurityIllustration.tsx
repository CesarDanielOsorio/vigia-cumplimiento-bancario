// Ilustración vectorial: escudo con banco al centro, circuitos y un haz de escaneo.
export default function SecurityIllustration({ className = '' }: { className?: string }) {
  const shield = 'M240 80 L340 115 V215 C340 285 297 342 240 370 C183 342 140 285 140 215 V115 Z'

  return (
    <svg viewBox="0 0 480 440" className={className} role="img" aria-label="Escudo de seguridad protegiendo un banco">
      <defs>
        <linearGradient id="si-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4fe0a5" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="si-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#18396d" stopOpacity="0.95" />
          <stop offset="1" stopColor="#0a1e3f" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="si-glow">
          <stop offset="0" stopColor="#4fe0a5" stopOpacity="0.28" />
          <stop offset="1" stopColor="#4fe0a5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="si-scan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4fe0a5" stopOpacity="0" />
          <stop offset="1" stopColor="#4fe0a5" stopOpacity="0.45" />
        </linearGradient>
        <clipPath id="si-clip">
          <path d={shield} />
        </clipPath>
      </defs>

      <circle cx="240" cy="225" r="215" fill="url(#si-glow)" />
      <circle cx="240" cy="225" r="205" fill="none" stroke="#4fe0a5" strokeOpacity="0.08" />
      <circle cx="240" cy="225" r="168" fill="none" stroke="#4fe0a5" strokeOpacity="0.18" strokeDasharray="3 9">
        <animateTransform attributeName="transform" type="rotate" from="0 240 225" to="360 240 225" dur="60s" repeatCount="indefinite" />
      </circle>
      <circle cx="240" cy="225" r="132" fill="none" stroke="#22d3ee" strokeOpacity="0.15" />

      {/* Circuitos */}
      <g fill="none" stroke="#4fe0a5" strokeOpacity="0.55" strokeWidth="1.5">
        <path d="M140 160 H78 V104" />
        <path d="M140 250 H96 V326" />
        <path d="M340 165 H404 V116" />
        <path d="M340 262 H414 V334" />
        <path d="M240 80 V40 H300" />
      </g>
      <g fill="#050f24" stroke="#4fe0a5" strokeWidth="2">
        <circle cx="78" cy="104" r="5" />
        <circle cx="96" cy="326" r="5" />
        <circle cx="404" cy="116" r="5" />
        <circle cx="414" cy="334" r="5" />
        <circle cx="300" cy="40" r="5" />
      </g>

      {/* Escudo */}
      <path d={shield} fill="url(#si-fill)" stroke="url(#si-stroke)" strokeWidth="3.5" strokeLinejoin="round" />
      <g clipPath="url(#si-clip)">
        <rect x="140" y="80" width="200" height="34" fill="url(#si-scan)">
          <animate attributeName="y" values="46;350;46" dur="5s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* Banco */}
      <g fill="none" stroke="#e2f7ef" strokeWidth="3" strokeLinejoin="round">
        <path d="M188 192 L240 160 L292 192 Z" />
        <rect x="192" y="196" width="96" height="8" rx="1" />
        <rect x="186" y="258" width="108" height="8" rx="1" />
        <rect x="178" y="270" width="124" height="8" rx="1" />
      </g>
      <g fill="#4fe0a5">
        <rect x="200" y="208" width="11" height="46" rx="2" />
        <rect x="222" y="208" width="11" height="46" rx="2" />
        <rect x="247" y="208" width="11" height="46" rx="2" />
        <rect x="269" y="208" width="11" height="46" rx="2" />
      </g>
      <circle cx="240" cy="180" r="4" fill="#22d3ee" />

      {/* Candado */}
      <g transform="translate(302 318)">
        <circle r="30" fill="#050f24" stroke="url(#si-stroke)" strokeWidth="3" />
        <path d="M-9 -3 V-9 a9 9 0 0 1 18 0 V-3" fill="none" stroke="#4fe0a5" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="-13" y="-3" width="26" height="20" rx="4" fill="#4fe0a5" />
        <circle cy="5" r="3" fill="#050f24" />
        <rect x="-1.25" y="6" width="2.5" height="6" rx="1" fill="#050f24" />
      </g>
    </svg>
  )
}
