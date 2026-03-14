/**
 * INSANE Premium Aura Effects - Ultimate Edition
 * 
 * Features:
 * - Multi-layered rotating rings with different speeds
 * - Holographic shimmer effect
 * - Particle burst animation
 * - 3D depth with multiple shadows
 * - Prismatic color shifts
 * - Pulsing glow effects
 * - Metallic shine with rainbow spectrum
 * - Liquid metal text effect
 */

const DEFAULT_PREMIUM_COLOR = '#f59e0b'; // Gold

// CSS Animation Keyframes - INSANE MODE
const AURA_KEYFRAMES = `
/* Multi-speed Rotating Rings */
@keyframes auraRotateFast {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes auraRotateSlow {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

@keyframes auraRotatePulse {
  0%, 100% { 
    transform: rotate(0deg) scale(1); 
  }
  50% { 
    transform: rotate(180deg) scale(1.05); 
  }
}

/* Holographic Shimmer */
@keyframes holographicShift {
  0% { 
    filter: hue-rotate(0deg) brightness(1);
  }
  25% {
    filter: hue-rotate(90deg) brightness(1.2);
  }
  50% {
    filter: hue-rotate(180deg) brightness(1);
  }
  75% {
    filter: hue-rotate(270deg) brightness(1.2);
  }
  100% {
    filter: hue-rotate(360deg) brightness(1);
  }
}

/* Particle Burst */
@keyframes particleBurst {
  0% {
    transform: scale(0) rotate(0deg);
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: scale(2) rotate(360deg);
    opacity: 0;
  }
}

/* Pulsing Glow - DISABLED */
@keyframes glowPulse {
  0%, 100% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.3);
  }
}

/* Liquid Metal Text Effect - NO GLOW */
@keyframes liquidMetal {
  0% { 
    background-position: 0% 50%;
    filter: saturate(1.2);
  }
  25% {
    filter: saturate(1.5);
  }
  50% { 
    background-position: 100% 50%;
    filter: saturate(1.2);
  }
  75% {
    filter: saturate(1.5);
  }
  100% { 
    background-position: 0% 50%;
    filter: saturate(1.2);
  }
}

/* Prismatic Rainbow Shift */
@keyframes prismaticShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Electric Arc Effect */
@keyframes electricArc {
  0%, 100% {
    opacity: 0;
    transform: scaleX(0.5);
  }
  20%, 80% {
    opacity: 1;
    transform: scaleX(1);
  }
  50% {
    opacity: 0.6;
  }
}

/* Orbit Animation for Particles */
@keyframes orbit {
  from {
    transform: rotate(0deg) translateX(var(--orbit-radius)) rotate(0deg);
  }
  to {
    transform: rotate(360deg) translateX(var(--orbit-radius)) rotate(-360deg);
  }
}

/* Sparkle Effect */
@keyframes sparkle {
  0%, 100% {
    opacity: 0;
    transform: scale(0) rotate(0deg);
  }
  50% {
    opacity: 1;
    transform: scale(1) rotate(180deg);
  }
}

/* Wave Distortion */
@keyframes waveDistort {
  0%, 100% {
    border-radius: 48% 52% 50% 50% / 50% 50% 52% 48%;
  }
  25% {
    border-radius: 52% 48% 48% 52% / 52% 48% 50% 50%;
  }
  50% {
    border-radius: 50% 50% 52% 48% / 48% 52% 48% 52%;
  }
  75% {
    border-radius: 48% 52% 50% 50% / 52% 48% 52% 48%;
  }
}
`;

let animationsInjected = false;

export const injectAuraAnimations = () => {
  if (animationsInjected) return;
  const styleElement = document.createElement('style');
  styleElement.id = 'premium-aura-animations';
  styleElement.textContent = AURA_KEYFRAMES;
  document.head.appendChild(styleElement);
  animationsInjected = true;
};

// Helper to adjust color brightness
const adjustBrightness = (hex, percent) => {
  if (!hex) return DEFAULT_PREMIUM_COLOR;
  hex = hex.replace(/^\#/, '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];

  let num = parseInt(hex, 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00FF) + percent;
  let b = (num & 0x0000FF) + percent;

  return '#' + (
    0x1000000 +
    (r < 255 ? (r < 1 ? 0 : r) : 255) * 0x10000 +
    (g < 255 ? (g < 1 ? 0 : g) : 255) * 0x100 +
    (b < 255 ? (b < 1 ? 0 : b) : 255)
  ).toString(16).slice(1);
};

// Helper to convert hex to rgba
const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(245, 158, 11, ${alpha})`;
  hex = hex.replace(/^\#/, '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Generate complementary color
const getComplementaryColor = (hex) => {
  hex = hex.replace(/^\#/, '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const compR = (255 - r).toString(16).padStart(2, '0');
  const compG = (255 - g).toString(16).padStart(2, '0');
  const compB = (255 - b).toString(16).padStart(2, '0');

  return `#${compR}${compG}${compB}`;
};

/**
 * CONTAINER STYLE - Wrapper around avatar for positioning effects
 */
export const getAuraContainerStyle = (isPremium) => {
  if (!isPremium) return {};

  return {
    position: 'relative',
    display: 'inline-block',
  };
};

/**
 * PRIMARY RING - Outer rotating gradient ring
 */
export const getAuraRingStyle = (isPremium, accentColor, options = {}) => {
  if (!isPremium) return { display: 'none' };

  const baseColor = accentColor || DEFAULT_PREMIUM_COLOR;
  const darkColor = adjustBrightness(baseColor, -60);
  const lightColor = adjustBrightness(baseColor, 60);
  const brightColor = adjustBrightness(baseColor, 100);
  const complementary = getComplementaryColor(baseColor);

  const sizeOffset = options.size === 'small' ? '-4px' : options.size === 'large' ? '-8px' : '-6px';

  return {
    position: 'absolute',
    top: sizeOffset,
    left: sizeOffset,
    right: sizeOffset,
    bottom: sizeOffset,
    borderRadius: '50%',
    zIndex: 0,
    backgroundImage: `conic-gradient(
      from 0deg,
      ${darkColor},
      ${baseColor} 15%,
      ${lightColor} 25%,
      ${brightColor} 30%,
      ${lightColor} 35%,
      ${baseColor} 45%,
      ${complementary} 50%,
      ${baseColor} 55%,
      ${lightColor} 65%,
      ${brightColor} 70%,
      ${lightColor} 75%,
      ${baseColor} 85%,
      ${darkColor} 100%
    )`,
    animation: 'auraRotateFast 3s linear infinite',
    /* Glow removed */
  };
};

/**
 * SECONDARY RING - Inner counter-rotating ring
 */
export const getAuraRingSecondaryStyle = (isPremium, accentColor, options = {}) => {
  if (!isPremium) return { display: 'none' };

  const baseColor = accentColor || DEFAULT_PREMIUM_COLOR;
  const darkColor = adjustBrightness(baseColor, -40);
  const lightColor = adjustBrightness(baseColor, 80);

  const sizeOffset = options.size === 'small' ? '-2px' : options.size === 'large' ? '-4px' : '-3px';

  return {
    position: 'absolute',
    top: sizeOffset,
    left: sizeOffset,
    right: sizeOffset,
    bottom: sizeOffset,
    borderRadius: '50%',
    zIndex: 1,
    background: `conic-gradient(
      from 180deg,
      transparent 40%,
      ${hexToRgba(lightColor, 0.8)} 45%,
      ${hexToRgba(lightColor, 0.4)} 55%,
      transparent 60%
    )`,
    animation: 'auraRotateSlow 4s linear infinite',
  };
};

/**
 * PULSING GLOW LAYER - Behind everything
 */
export const getAuraPulseStyle = (isPremium, accentColor, options = {}) => {
  if (!isPremium) return { display: 'none' };

  const baseColor = accentColor || DEFAULT_PREMIUM_COLOR;
  const sizeOffset = options.size === 'small' ? '-6px' : options.size === 'large' ? '-12px' : '-9px';

  // Pulsing glow layer disabled
  return { display: 'none' };
};

/**
 * HOLOGRAPHIC OVERLAY - Adds shimmer effect
 */
export const getAuraHolographicStyle = (isPremium, accentColor, options = {}) => {
  if (!isPremium) return { display: 'none' };

  const sizeOffset = options.size === 'small' ? '-3px' : options.size === 'large' ? '-6px' : '-4px';

  return {
    position: 'absolute',
    top: sizeOffset,
    left: sizeOffset,
    right: sizeOffset,
    bottom: sizeOffset,
    borderRadius: '50%',
    zIndex: 2,
    background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
    animation: 'holographicShift 3s ease-in-out infinite',
    pointerEvents: 'none',
  };
};

/**
 * PARTICLE SYSTEM - Orbiting particles
 */
export const getAuraParticleStyle = (isPremium, accentColor, particleIndex = 0) => {
  if (!isPremium) return { display: 'none' };

  const baseColor = accentColor || DEFAULT_PREMIUM_COLOR;
  const radius = 45 + (particleIndex % 3) * 10; // Different orbit radii
  const duration = 3 + (particleIndex % 3) * 0.5; // Different speeds
  const delay = particleIndex * 0.3; // Stagger start times
  const size = 4 + (particleIndex % 2) * 2; // Different sizes

  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `radial-gradient(circle, ${baseColor}, ${hexToRgba(baseColor, 0.6)})`,
    borderRadius: '50%',
    '--orbit-radius': `${radius}px`,
    animation: `orbit ${duration}s linear infinite`,
    animationDelay: `${delay}s`,
    /* Glow removed */
    zIndex: 3,
    pointerEvents: 'none',
  };
};

/**
 * ELECTRIC ARC EFFECT - Lightning-like arcs
 */
export const getAuraElectricArcStyle = (isPremium, accentColor, arcIndex = 0) => {
  if (!isPremium) return { display: 'none' };

  const baseColor = accentColor || DEFAULT_PREMIUM_COLOR;
  const rotation = arcIndex * 60; // Position arcs around circle
  const delay = arcIndex * 0.4;

  return {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100%',
    height: '2px',
    backgroundImage: `linear-gradient(90deg, transparent, ${baseColor}, transparent)`,
    transformOrigin: 'center center',
    transform: `rotate(${rotation}deg)`,
    animation: `electricArc 2s ease-in-out infinite`,
    animationDelay: `${delay}s`,
    zIndex: 2,
    pointerEvents: 'none',
    opacity: 0,
    filter: `blur(1px)`, /* Glow removed */
  };
};

/**
 * SPARKLE EFFECTS - Random twinkling stars
 */
export const getAuraSparkleStyle = (isPremium, accentColor, sparkleIndex = 0) => {
  if (!isPremium) return { display: 'none' };

  const baseColor = accentColor || DEFAULT_PREMIUM_COLOR;
  const angle = sparkleIndex * 45;
  const distance = 35 + (sparkleIndex % 3) * 8;
  const delay = sparkleIndex * 0.5;
  const duration = 2 + (sparkleIndex % 2) * 0.5;

  const x = Math.cos((angle * Math.PI) / 180) * distance;
  const y = Math.sin((angle * Math.PI) / 180) * distance;

  return {
    position: 'absolute',
    top: `calc(50% + ${y}px)`,
    left: `calc(50% + ${x}px)`,
    width: '6px',
    height: '6px',
    backgroundColor: baseColor,
    clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', // Star shape
    animation: `sparkle ${duration}s ease-in-out infinite`,
    animationDelay: `${delay}s`,
    zIndex: 4,
    pointerEvents: 'none',
    /* Glow removed */
  };
};

/**
 * LIQUID METAL TEXT EFFECT - Insane name styling
 */
export const getAuraNameStyle = (isPremium, accentColor) => {
  if (!isPremium) return {};

  const baseColor = accentColor || DEFAULT_PREMIUM_COLOR;
  const lightColor = adjustBrightness(baseColor, 80);
  const brightColor = adjustBrightness(baseColor, 120);
  const darkColor = adjustBrightness(baseColor, -40);
  const complementary = getComplementaryColor(baseColor);

  return {
    fontWeight: '800',
    backgroundImage: `linear-gradient(
      110deg, 
      ${darkColor} 0%,
      ${baseColor} 20%,
      ${lightColor} 35%,
      ${brightColor} 45%,
      rgba(255, 255, 255, 1) 50%,
      ${brightColor} 55%,
      ${lightColor} 65%,
      ${baseColor} 80%,
      ${darkColor} 100%
    )`,
    backgroundSize: '300% 100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    animation: 'liquidMetal 4s ease-in-out infinite',
    /* Text shadow glow removed */
    display: 'inline-block',
    letterSpacing: '0.5px',
    position: 'relative',
  };
};

/**
 * AVATAR CONTAINER EFFECT - Wave distortion border
 */
export const getAuraAvatarContainerStyle = (isPremium, accentColor) => {
  if (!isPremium) return {};

  const baseColor = accentColor || DEFAULT_PREMIUM_COLOR;

  return {
    position: 'relative',
    border: `3px solid ${baseColor}`,
    borderRadius: '50%',
    animation: 'waveDistort 4s ease-in-out infinite',
    boxShadow: 'none',
    zIndex: 10,
  };
};

/**
 * PRISMATIC BACKGROUND - Rainbow overlay on avatar
 */
export const getAuraPrismaticStyle = (isPremium, accentColor) => {
  if (!isPremium) return { display: 'none' };

  return {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: '50%',
    backgroundImage: 'linear-gradient(45deg, rgba(255,0,255,0.2), rgba(0,255,255,0.2), rgba(255,255,0,0.2))',
    backgroundSize: '200% 200%',
    animation: 'prismaticShift 6s ease-in-out infinite',
    mixBlendMode: 'overlay',
    zIndex: 5,
    pointerEvents: 'none',
  };
};

/**
 * Generate all particle styles at once
 */
export const generateParticleStyles = (isPremium, accentColor, count = 8) => {
  if (!isPremium) return [];
  return Array.from({ length: count }, (_, i) =>
    getAuraParticleStyle(isPremium, accentColor, i)
  );
};

/**
 * Generate all sparkle styles at once
 */
export const generateSparkleStyles = (isPremium, accentColor, count = 8) => {
  if (!isPremium) return [];
  return Array.from({ length: count }, (_, i) =>
    getAuraSparkleStyle(isPremium, accentColor, i)
  );
};

/**
 * Generate all electric arc styles
 */
export const generateElectricArcStyles = (isPremium, accentColor, count = 6) => {
  if (!isPremium) return [];
  return Array.from({ length: count }, (_, i) =>
    getAuraElectricArcStyle(isPremium, accentColor, i)
  );
};

// Backward compatibility
export const getAuraAvatarStyle = (isPremium, accentColor, options) => {
  return getAuraAvatarContainerStyle(isPremium, accentColor);
};