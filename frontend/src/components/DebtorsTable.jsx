import React from 'react';

function fmt(n) {
  if (n == null) return '—';
  return 'GH₵' + Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 });
}

export default function DebtorsTable({ debtors = [] }) {
  if (!debtors.length) {
    return <p style={{ color: '#888', fontSize: 13 }}>No outstanding debtors.</p>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Class</th>
            <th>Total Paid</th>
            <th>Balance</th>
            <th>Overdue</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>
          {debtors.map((d, i) => (
            <tr key={d.plan_id || d.student_id || i}>
              <td>{d.student_name}</td>
              <td>{d.class_name || '—'}</td>
              <td>{fmt(d.total_paid)}</td>
              <td style={{ color: '#c0392b', fontWeight: 600 }}>{fmt(d.balance)}</td>
              <td style={{ color: d.overdue_amount > 0 ? '#e74c3c' : '#888' }}>{fmt(d.overdue_amount)}</td>
              <td style={{ color: '#666' }}>{d.parent_phone || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
