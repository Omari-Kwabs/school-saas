import React, { useState, useRef, useMemo } from 'react';
import { useBrand } from '../context/BrandContext';
import { derivePalette } from '../utils/brandColors';

// 48 curated presets across 6 colour families
const PRESET_GROUPS = [
  {
    label: 'Blues & Indigos',
    colors: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#4f46e5', '#6366f1', '#818cf8', '#a5b4fc'],
  },
  {
    label: 'Teals & Greens',
    colors: ['#065f46', '#059669', '#10b981', '#34d399', '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf'],
  },
  {
    label: 'Sky & Cyan',
    colors: ['#0c4a6e', '#0369a1', '#0ea5e9', '#38bdf8', '#155e75', '#0891b2', '#06b6d4', '#67e8f9'],
  },
  {
    label: 'Reds & Oranges',
    colors: ['#991b1b', '#dc2626', '#ef4444', '#f87171', '#9a3412', '#ea580c', '#f97316', '#fb923c'],
  },
  {
    label: 'Purples & Pinks',
    colors: ['#581c87', '#7e22ce', '#9333ea', '#a855f7', '#86198f', '#c026d3', '#d946ef', '#ec4899'],
  },
  {
    label: 'Ambers & Neutrals',
    colors: ['#92400e', '#b45309', '#d97706', '#f59e0b', '#1e293b', '#334155', '#475569', '#64748b'],
  },
];

export default function BrandSettings() {
  const { brand, updateBrand } = useBrand();
  const [form, setForm]        = useState({ ...brand });
  const [saved, setSaved]      = useState(false);
  const [preview, setPreview]  = useState(brand.logoUrl || '');
  const fileRef                = useRef(null);
  const synced                 = useRef(false);

  // Sync form once when backend data arrives
  React.useEffect(() => {
    if (!synced.current && (brand.schoolName || brand.motto || brand.logoUrl)) {
      setForm({ ...brand });
      setPreview(brand.logoUrl || '');
      synced.current = true;
    }
  }, [brand]);

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target.result;
      setPreview(url);
      setForm(f => ({ ...f, logoUrl: url }));
    };
    reader.readAsDataURL(file);
  }

  function save(e) {
    e.preventDefault();
    updateBrand(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Recomputes whenever the user picks a new colour — direct import, no require()
  const livePalette = useMemo(() => derivePalette(form.primaryColor), [form.primaryColor]);

  const swatchData = [
    { label: 'Primary',        color: livePalette.primary,       note: 'Top bar' },
    { label: 'Primary Dark',   color: livePalette.primaryDark,   note: 'Hover states' },
    { label: 'Primary Light',  color: livePalette.primaryLight,  note: 'Backgrounds' },
    { label: 'Primary Muted',  color: livePalette.primaryMuted,  note: 'Subtle fills' },
    { label: 'Sidebar',        color: livePalette.sidebarBg,     note: 'Nav background' },
    { label: 'Accent (warm)',  color: livePalette.accent,        note: 'Highlights / badges' },
    { label: 'Accent (split)', color: livePalette.accentSplit,   note: 'Secondary actions' },
  ];

  const onColor  = livePalette.textOnPrimary;
  const dimColor = onColor === '#ffffff' ? 'rgba(255,255,255,0.65)' : 'rgba(30,41,59,0.55)';

  return (
    <div className="max-w-lg">
      <form onSubmit={save} className="space-y-6">

        {/* Logo */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">School Logo</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 overflow-hidden">
              {preview
                ? <img src={preview} alt="Logo" className="w-full h-full object-contain" />
                : <span className="text-2xl">🏫</span>
              }
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                Upload Image
              </button>
              {preview && (
                <button type="button"
                  onClick={() => { setPreview(''); setForm(f => ({ ...f, logoUrl: '' })); }}
                  className="ml-2 text-xs text-red-500 hover:text-red-700">
                  Remove
                </button>
              )}
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG — max 500 KB</p>
            </div>
          </div>
        </div>

        {/* School name */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">School Name</label>
          <input name="schoolName" value={form.schoolName} onChange={handle}
            placeholder="e.g. Bright Future Academy"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Motto */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Motto / Tagline</label>
          <input name="motto" value={form.motto} onChange={handle}
            placeholder="e.g. Excellence in Education"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Brand colour — grouped presets */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Brand Colour</label>

          <div className="space-y-3 mb-4">
            {PRESET_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">{group.label}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {group.colors.map(color => {
                    const isSelected = form.primaryColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, primaryColor: color }))}
                        title={color}
                        className="w-7 h-7 rounded-full transition-all hover:scale-110 focus:outline-none"
                        style={{
                          background: color,
                          boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : 'none',
                          transform: isSelected ? 'scale(1.15)' : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Custom colour picker + hex input */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input type="color" name="primaryColor" value={form.primaryColor} onChange={handle}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5 shrink-0"
            />
            <div className="flex-1">
              <p className="text-[10px] text-gray-400 mb-1">Custom hex value</p>
              <input type="text" name="primaryColor" value={form.primaryColor} onChange={handle}
                placeholder="#4f46e5"
                className="w-full px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-10 h-10 rounded-lg border border-gray-200 shrink-0" style={{ background: form.primaryColor }} />
          </div>
        </div>

        {/* Derived palette — updates live as colour is picked */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Derived Colour Palette
          </label>
          <div className="grid grid-cols-2 gap-2">
            {swatchData.map(({ label, color, note }) => (
              <div key={label} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50">
                <div className="w-8 h-8 rounded-md shrink-0 border border-gray-200" style={{ background: color }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{label}</p>
                  <p className="text-[10px] text-gray-400 truncate">{note}</p>
                  <p className="text-[10px] font-mono text-gray-400">{color}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Top bar */}
          <div className="h-10 flex items-center px-3 gap-2" style={{ background: livePalette.primary }}>
            {preview
              ? <img src={preview} alt="" className="h-6 w-6 object-contain rounded" />
              : (
                <div className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.2)', color: onColor }}>
                  {form.schoolName?.[0] || 'S'}
                </div>
              )
            }
            <div>
              <p className="text-xs font-semibold leading-tight" style={{ color: onColor }}>
                {form.schoolName || 'Your School'}
              </p>
              {form.motto && (
                <p className="text-[9px] italic leading-tight" style={{ color: dimColor }}>
                  {form.motto}
                </p>
              )}
            </div>
          </div>
          {/* Sidebar + content */}
          <div className="flex h-24">
            <div className="w-16 flex flex-col gap-1 p-2" style={{ background: livePalette.sidebarBg }}>
              <div className="h-5 rounded" style={{ background: livePalette.sidebarActive }} />
              <div className="h-5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="h-5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
            <div className="flex-1 p-2 bg-gray-50 flex items-center justify-center">
              <p className="text-[10px] text-gray-400">Page content area</p>
            </div>
          </div>
          {/* Accent strip */}
          <div className="flex h-5 border-t border-gray-100">
            {[livePalette.primaryLight, livePalette.primaryMuted, livePalette.accent, livePalette.accentSplit].map((c, i) => (
              <div key={i} className="flex-1" style={{ background: c }} title={c} />
            ))}
          </div>
        </div>

        <button type="submit"
          className="w-full py-2.5 text-sm font-semibold rounded-xl transition-opacity hover:opacity-90"
          style={{ background: livePalette.primary, color: onColor }}
        >
          {saved ? '✓ Saved!' : 'Save Brand Settings'}
        </button>
      </form>
    </div>
  );
}
