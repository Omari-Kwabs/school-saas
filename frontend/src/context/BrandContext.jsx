import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import client from '../api/client';
import { derivePalette } from '../utils/brandColors';

const defaults = {
  schoolName:   '',
  motto:        '',
  primaryColor: '#4f46e5',
  logoUrl:      '',
};

const BrandContext = createContext({
  brand:        defaults,
  palette:      derivePalette('#4f46e5'),
  updateBrand:  () => {},
});

export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(() => {
    try {
      const stored = localStorage.getItem('schoolBrand');
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  });

  // Fetch live branding from backend on mount (cookie carries auth)
  useEffect(() => {
    client.get('/school/branding')
      .then(({ data }) => {
        const remote = {
          schoolName:   data.name          || '',
          motto:        data.motto         || '',
          primaryColor: data.primary_color || '#4f46e5',
          logoUrl:      data.logo_url      || '',
        };
        setBrand(remote);
        localStorage.setItem('schoolBrand', JSON.stringify(remote));
      })
      .catch(() => {});
  }, []);

  const palette = useMemo(() => derivePalette(brand.primaryColor), [brand.primaryColor]);

  // Apply full palette as CSS custom properties whenever the primary changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary',         palette.primary);
    root.style.setProperty('--brand-primary-dark',    palette.primaryDark);
    root.style.setProperty('--brand-primary-light',   palette.primaryLight);
    root.style.setProperty('--brand-primary-muted',   palette.primaryMuted);
    root.style.setProperty('--brand-sidebar-bg',      palette.sidebarBg);
    root.style.setProperty('--brand-sidebar-hover',   palette.sidebarHover);
    root.style.setProperty('--brand-sidebar-active',  palette.sidebarActive);
    root.style.setProperty('--brand-accent',          palette.accent);
    root.style.setProperty('--brand-accent-split',    palette.accentSplit);
    root.style.setProperty('--brand-text-on-primary', palette.textOnPrimary);
  }, [palette]);

  async function updateBrand(updates) {
    const next = { ...brand, ...updates };
    setBrand(next);
    localStorage.setItem('schoolBrand', JSON.stringify(next));
    try {
      await client.put('/school/branding', {
        name:          next.schoolName   || null,
        logo_url:      next.logoUrl      || null,
        motto:         next.motto        || null,
        primary_color: next.primaryColor || null,
      });
    } catch {
      // local state is updated; backend sync is non-blocking
    }
  }

  return (
    <BrandContext.Provider value={{ brand, palette, updateBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
