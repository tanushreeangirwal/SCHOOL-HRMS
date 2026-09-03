import React from 'react';

/**
 * Official St. Vincent's High School Crest & Logo Component
 * Faithfully represents the St. Vincent's School crest:
 * - Shield with red upper field and sunburst + IHS emblem
 * - Deep navy lower field with golden olive wreath
 * - Scroll ribbon with school motto: "VINCENTI DABITUR"
 * - Official St. Vincent's typography in deep navy / white
 */
export function StVincentsLogo({ 
  variant = 'full', // 'full' | 'shield' | 'horizontal' | 'compact'
  size = 'lg',      // 'sm' | 'md' | 'lg' | 'xl' | number
  title = "St. Vincent's High School",
  subtitle = 'Human Resource System',
  theme = 'dark',   // 'dark' (for dark sidebar) | 'light' (for white pages)
  className = ''
}) {
  const getDimensions = () => {
    if (typeof size === 'number') {
      const w = size;
      const h = Math.round(size * 1.2);
      return { 
        shieldW: w, 
        shieldH: h, 
        fontSize: w >= 50 ? '1.25rem' : (w >= 40 ? '1.08rem' : '0.95rem'), 
        subSize: w >= 50 ? '0.74rem' : (w >= 40 ? '0.68rem' : '0.62rem') 
      };
    }

    switch (size) {
      case 'sm': return { shieldW: 34, shieldH: 41, fontSize: '0.96rem', subSize: '0.64rem' };
      case 'md': return { shieldW: 46, shieldH: 55, fontSize: '1.12rem', subSize: '0.70rem' };
      case 'xl': return { shieldW: 70, shieldH: 84, fontSize: '1.65rem', subSize: '0.90rem' };
      case 'lg':
      default:   return { shieldW: 52, shieldH: 63, fontSize: '1.24rem', subSize: '0.75rem' };
    }
  };

  const dim = getDimensions();

  // High-fidelity vector rendition of the St. Vincent's crest
  const ShieldSVG = (
    <svg 
      width={dim.shieldW} 
      height={dim.shieldH} 
      viewBox="0 0 100 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="st-vincents-shield-svg"
      style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 5px rgba(0, 0, 0, 0.25))' }}
      aria-label="St. Vincent's Crest"
    >
      <defs>
        {/* Crest Clip Path */}
        <clipPath id="crestShieldClip">
          <path d="M 10,8 L 90,8 C 90,8 90,70 90,74 C 90,92 50,112 50,112 C 50,112 10,92 10,74 C 10,70 10,8 10,8 Z" />
        </clipPath>

        {/* Laurel Wreath Gold Gradient */}
        <linearGradient id="laurelGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>

        {/* Sunburst Gold */}
        <linearGradient id="sunGold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      {/* Main Outer Shield Shadow & Contour */}
      <path 
        d="M 8,6 L 92,6 C 92,6 92,72 92,76 C 92,95 50,116 50,116 C 50,116 8,95 8,76 C 8,72 8,6 8,6 Z" 
        fill="#071527" 
      />

      {/* Clipped Crest Interior */}
      <g clipPath="url(#crestShieldClip)">
        {/* UPPER DIVISION: Crimson Red Field */}
        <rect x="0" y="0" width="100" height="52" fill="#be123c" />

        {/* Sunburst Rays radiating from IHS */}
        <g stroke="#ffffff" strokeWidth="1.3" opacity="0.9">
          <line x1="50" y1="36" x2="22" y2="16" />
          <line x1="50" y1="36" x2="30" y2="12" />
          <line x1="50" y1="36" x2="40" y2="10" />
          <line x1="50" y1="36" x2="50" y2="9" />
          <line x1="50" y1="36" x2="60" y2="10" />
          <line x1="50" y1="36" x2="70" y2="12" />
          <line x1="50" y1="36" x2="78" y2="16" />
          <line x1="50" y1="36" x2="18" y2="24" />
          <line x1="50" y1="36" x2="82" y2="24" />
        </g>

        {/* Semi-circular Sun Dome with IHS */}
        <path d="M 32,46 C 32,26 68,26 68,46 Z" fill="url(#sunGold)" stroke="#be123c" strokeWidth="1.2" />
        <text 
          x="50" 
          y="43" 
          textAnchor="middle" 
          fill="#0f172a" 
          fontSize="9" 
          fontWeight="900" 
          fontFamily="Georgia, serif"
          letterSpacing="0.8"
        >
          IHS
        </text>

        {/* LOWER DIVISION: Deep Royal Navy Field */}
        <rect x="0" y="48" width="100" height="72" fill="#0369a1" />

        {/* Divider Line */}
        <line x1="0" y1="48" x2="100" y2="48" stroke="#071527" strokeWidth="2.5" />

        {/* Laurel Wreath in Green & Gold */}
        <g transform="translate(50, 78) scale(0.95)">
          {/* Left Laurel Branch */}
          <path 
            d="M -6,14 C -22,12 -28,-14 -12,-20 C -22,-8 -12,4 -6,12 Z" 
            fill="url(#laurelGold)" 
            stroke="#854d0e" 
            strokeWidth="0.8"
          />
          {/* Right Laurel Branch */}
          <path 
            d="M 6,14 C 22,12 28,-14 12,-20 C 22,-8 12,4 6,12 Z" 
            fill="url(#laurelGold)" 
            stroke="#854d0e" 
            strokeWidth="0.8"
          />
          {/* Laurel Leaves Nodes */}
          <circle cx="-16" cy="-14" r="3.2" fill="#fde047" />
          <circle cx="-22" cy="-4" r="3.4" fill="#fde047" />
          <circle cx="-20" cy="6" r="3.2" fill="#fde047" />
          <circle cx="16" cy="-14" r="3.2" fill="#fde047" />
          <circle cx="22" cy="-4" r="3.4" fill="#fde047" />
          <circle cx="20" cy="6" r="3.2" fill="#fde047" />
          {/* Ribbon Tie at bottom */}
          <path d="M -8,12 Q 0,16 8,12 Q 0,18 -8,12 Z" fill="#ffffff" stroke="#071527" strokeWidth="0.8" />
        </g>
      </g>

      {/* Outer Border Stroke */}
      <path 
        d="M 10,8 L 90,8 C 90,8 90,70 90,74 C 90,92 50,112 50,112 C 50,112 10,92 10,74 C 10,70 10,8 10,8 Z" 
        fill="none" 
        stroke="#071527" 
        strokeWidth="3.5" 
      />

      {/* Scroll Banner Ribbon at Bottom: "VINCENTI DABITUR" */}
      <g transform="translate(0, 104)">
        <path 
          d="M 6,6 L 16,0 L 84,0 L 94,6 L 86,14 L 14,14 Z" 
          fill="#fef08a" 
          stroke="#071527" 
          strokeWidth="1.2"
        />
        <text 
          x="50" 
          y="10.5" 
          textAnchor="middle" 
          fill="#071527" 
          fontSize="6.5" 
          fontWeight="900" 
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.6"
        >
          VINCENTI DABITUR
        </text>
      </g>
    </svg>
  );

  if (variant === 'shield') {
    return (
      <div className={`st-vincents-logo-shield-only ${className}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
        {ShieldSVG}
      </div>
    );
  }

  const primaryTextColor = theme === 'dark' ? '#ffffff' : '#172033';
  const secondaryTextColor = theme === 'dark' ? '#94a3b8' : '#64748b';

  return (
    <div className={`st-vincents-brand-lockup ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      {ShieldSVG}
      <div className="brand-text-stack" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 0 }}>
        <span 
          className="brand-primary-name" 
          style={{ 
            fontSize: dim.fontSize, 
            fontWeight: 800, 
            color: primaryTextColor,
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
            fontFamily: "'Outfit', 'Plus Jakarta Sans', -apple-system, sans-serif",
            whiteSpace: 'nowrap'
          }}
        >
          {title}
        </span>
        {subtitle && (
          <span 
            className="brand-secondary-name" 
            style={{ 
              fontSize: dim.subSize, 
              color: secondaryTextColor,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginTop: '3px',
              lineHeight: 1.2,
              whiteSpace: 'nowrap'
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default StVincentsLogo;
