import React from 'react';

export default function Pagination({ page, pages, total, limit, onPage }) {
  if (!pages || pages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', padding: '16px 0' }}>
      <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => onPage(1)}>«</button>
      <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
      <span style={{ fontSize: 13, color: '#666', padding: '0 8px' }}>
        Page {page} of {pages} · {from}–{to} of {total}
      </span>
      <button className="btn btn-sm btn-secondary" disabled={page === pages} onClick={() => onPage(page + 1)}>Next ›</button>
      <button className="btn btn-sm btn-secondary" disabled={page === pages} onClick={() => onPage(pages)}>»</button>
    </div>
  );
}
