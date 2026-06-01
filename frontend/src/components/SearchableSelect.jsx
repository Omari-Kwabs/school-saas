import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';

export default memo(function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  style = {},
  menuStyle = {},
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => options.find(o => String(o.value) === String(value)),
    [options, value]
  );

  const filtered = useMemo(
    () => search.trim()
      ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
      : options,
    [search, options]
  );

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') { setOpen(false); setSearch(''); }
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const select = useCallback((val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  }, [onChange]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 6, width: '100%', minWidth: 140,
          border: '1px solid #cbd5e1', borderRadius: 6,
          padding: '6px 10px', fontSize: 14, background: disabled ? '#f8fafc' : '#fff',
          color: selected ? '#1e293b' : '#94a3b8', cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 9999,
          marginTop: 4, minWidth: '100%', maxWidth: 340,
          background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
          display: 'flex', flexDirection: 'column',
          ...menuStyle,
        }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: '100%', border: '1px solid #e2e8f0', borderRadius: 6,
                padding: '5px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {placeholder && (
              <div
                onClick={() => select('')}
                style={{
                  padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                  color: '#94a3b8', background: !value ? '#f0f7ff' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f7ff'}
                onMouseLeave={e => e.currentTarget.style.background = !value ? '#f0f7ff' : 'transparent'}
              >
                {placeholder}
              </div>
            )}
            {filtered.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>No results</div>
            )}
            {filtered.map(o => {
              const isActive = String(o.value) === String(value);
              return (
                <div
                  key={o.value}
                  onClick={() => select(o.value)}
                  style={{
                    padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                    background: isActive ? '#e8f0fe' : 'transparent',
                    color: isActive ? '#1a56db' : '#1e293b',
                    fontWeight: isActive ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {o.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
