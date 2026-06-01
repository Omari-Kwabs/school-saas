export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtCurrency(value, symbol = 'GH₵') {
  const n = parseFloat(value);
  if (isNaN(n)) return `${symbol}0.00`;
  return `${symbol}${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
