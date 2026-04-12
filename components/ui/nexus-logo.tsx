'use client';

import { cn } from '@/lib/utils';

interface NexusLogoProps {
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function NexusLogo({ showText = true, size = 'md', className }: NexusLogoProps) {
  const sizes = {
    sm: { icon: 24, height: 28 },
    md: { icon: 36, height: 40 },
    lg: { icon: 48, height: 56 },
  };

  const { icon: iconSize, height } = sizes[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 50 50" 
        width={iconSize} 
        height={iconSize}
        className="shrink-0"
      >
        <circle 
          cx="25" 
          cy="25" 
          r="22" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeDasharray="4 4"
          className="text-primary/50"
        />
        <path 
          d="M25,5 Q25,25 45,25 Q25,25 25,45 Q25,25 5,25 Q25,25 25,5 Z" 
          className="fill-primary"
        />
      </svg>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-bold tracking-wider text-foreground" style={{ fontSize: size === 'sm' ? '14px' : size === 'md' ? '18px' : '24px' }}>
            NEXUS<span className="text-primary">PRIME</span>
          </span>
          <span className="text-muted-foreground font-medium tracking-widest" style={{ fontSize: size === 'sm' ? '8px' : size === 'md' ? '10px' : '12px' }}>
            AI 门户
          </span>
        </div>
      )}
    </div>
  );
}

export function NexusLogoSVG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" width="100%" height="100%">
      <g transform="translate(15, 15)">
        <circle cx="25" cy="25" r="22" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="4 4" className="text-primary/50" style={{ stroke: 'oklch(0.55 0.2 250)' }} />
        <path d="M25,5 Q25,25 45,25 Q25,25 25,45 Q25,25 5,25 Q25,25 25,5 Z" fill="oklch(0.55 0.2 250)" />
      </g>
      <text x="80" y="42" fontFamily="system-ui, sans-serif" fontWeight="600" fontSize="26" fill="oklch(0.15 0 0)" letterSpacing="1">
        NEXUS<tspan fill="oklch(0.55 0.2 250)">PRIME</tspan>
      </text>
      <text x="83" y="62" fontFamily="system-ui, sans-serif" fontWeight="700" fontSize="12" fill="oklch(0.5 0 0)" opacity="0.6" letterSpacing="4">
        AI 门户
      </text>
    </svg>
  );
}

/** 与 `app/icon.tsx`、暗色主题下的 `NexusLogo`（primary）一致 */
export function NexusFavicon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="32" height="32">
      <rect width="50" height="50" rx="11" fill="#212121" />
      <circle cx="25" cy="25" r="22" fill="none" stroke="rgba(236, 236, 236, 0.45)" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M25,5 Q25,25 45,25 Q25,25 25,45 Q25,25 5,25 Q25,25 25,5 Z" fill="#ececec" />
    </svg>
  );
}
