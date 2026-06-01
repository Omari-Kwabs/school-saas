function hexToHsl(hex) {
  // Expand 3-char shorthand to 6-char
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Derives a full UI palette from a single brand hex colour.
 * Returns primary tints, sidebar shades, and complementary accents.
 */
export function derivePalette(primaryHex) {
  if (!primaryHex || !/^#[0-9a-fA-F]{3,6}$/.test(primaryHex)) {
    primaryHex = '#4f46e5';
  }

  const [h, s, l] = hexToHsl(primaryHex);

  return {
    // ── Core brand ─────────────────────────────────────────────────────────
    primary:      primaryHex,
    primaryDark:  hslToHex(h, s,                       Math.max(l - 12, 5)),
    primaryLight: hslToHex(h, Math.max(s - 15, 20),   Math.min(l + 28, 93)),
    primaryMuted: hslToHex(h, Math.max(s - 38, 8),    Math.min(l + 44, 96)),

    // ── Sidebar — always dark, hue-tinted for brand feel ──────────────────
    sidebarBg:     hslToHex(h, Math.min(s + 8, 72),  13),
    sidebarHover:  hslToHex(h, Math.min(s + 5, 65),  21),
    sidebarActive: hslToHex(h, Math.min(s + 5, 65),  28),

    // ── Complementary accent colours ──────────────────────────────────────
    // Warm analogous (+35°): great for highlights, badges, alerts
    accent:        hslToHex((h + 35)  % 360, s, l),
    // Split-complementary (+150°): good for secondary actions, callouts
    accentSplit:   hslToHex((h + 150) % 360, s, l),

    // ── Readable text on coloured backgrounds ─────────────────────────────
    // Switch to dark text when the primary is light (L > 55%)
    textOnPrimary: l > 55 ? '#1e293b' : '#ffffff',
    textOnSidebar: '#ffffff',
  };
}
