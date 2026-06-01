import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import client from '../api/client';
import { getCached } from '../utils/refCache';
import { useAuth } from '../context/AuthContext';
import { hasPrivilege } from '../utils/access';
import SearchableSelect from '../components/SearchableSelect';

// ── Grade helpers ─────────────────────────────────────────────────────────────
function gradeInfo(total) {
  if (total == null || total === '' || isNaN(parseFloat(total))) return { grade: '—', meaning: '—' };
  const t = parseFloat(total);
  if (t >= 80) return { grade: 'A1', meaning: 'Excellent' };
  if (t >= 75) return { grade: 'B2', meaning: 'Very Good' };
  if (t >= 70) return { grade: 'B3', meaning: 'Good' };
  if (t >= 65) return { grade: 'C4', meaning: 'Credit' };
  if (t >= 60) return { grade: 'C5', meaning: 'Credit' };
  if (t >= 55) return { grade: 'C6', meaning: 'Credit' };
  if (t >= 50) return { grade: 'D7', meaning: 'Approaching Proficiency' };
  if (t >= 45) return { grade: 'E8', meaning: 'Pass' };
  return { grade: 'F9', meaning: 'Fail' };
}
function gradeColor(grade) {
  if (!grade || grade === '—') return '#9ca3af';
  if (grade.startsWith('A')) return '#16a34a';
  if (grade.startsWith('B')) return '#15803d';
  if (grade.startsWith('C')) return '#d97706';
  if (grade.startsWith('D')) return '#ea580c';
  return '#dc2626';
}
function gradeBg(grade) {
  if (!grade || grade === '—') return '#f3f4f6';
  if (grade.startsWith('A')) return '#dcfce7';
  if (grade.startsWith('B')) return '#d1fae5';
  if (grade.startsWith('C')) return '#fef3c7';
  if (grade.startsWith('D')) return '#ffedd5';
  return '#fee2e2';
}
function gradeRowTint(grade) {
  if (!grade || grade === '—') return 'transparent';
  if (grade.startsWith('A') || grade.startsWith('B')) return '#f0fdf4';
  if (grade.startsWith('C')) return '#fffbeb';
  if (grade.startsWith('D')) return '#fff7ed';
  return '#fef2f2';
}

// ── Print HTML builder ────────────────────────────────────────────────────────
const REMARK_FIELDS = [
  { key: 'interest',             label: 'INTEREST' },
  { key: 'conduct',              label: 'CONDUCT' },
  { key: 'attitude',             label: 'ATTITUDE' },
  { key: 'class_teacher_remark', label: "CLASS TEACHER'S REMARK" },
  { key: 'academic_remark',      label: 'ACADEMIC REMARK' },
];

function buildPrintHTML({ studentName, studentCode, className, termName, subjects, remarks, branding, fees, signatories = [], approvals = [] }) {
  const schoolName   = branding?.name         || 'School Name';
  const logoUrl      = branding?.logo_url     || null;
  const motto        = branding?.motto        || '';
  const primaryColor = branding?.primary_color || '#1e3a5f';

  const scored   = subjects.filter(s => s.class_score != null || s.exam_score != null);
  const aggTotal = scored.reduce((s, sub) => s + (parseFloat(sub.class_score) || 0) + (parseFloat(sub.exam_score) || 0), 0);
  const avgPct   = scored.length > 0 ? (aggTotal / scored.length).toFixed(1) : '—';
  const overallGI = gradeInfo(avgPct !== '—' ? parseFloat(avgPct) : null);
  const gcOverall  = gradeColor(overallGI.grade);

  function pillHtml(grade) {
    if (!grade) return '';
    const c = grade.startsWith('A') || grade.startsWith('B') ? { fg:'#166534', bg:'#dcfce7' }
            : grade.startsWith('C') ? { fg:'#92400e', bg:'#fef9c3' }
            : grade.startsWith('D') ? { fg:'#9a3412', bg:'#ffedd5' }
            : { fg:'#991b1b', bg:'#fee2e2' };
    return `<span style="display:inline-block;padding:2px 11px;border-radius:20px;font-weight:800;font-size:12px;background:${c.bg};color:${c.fg};letter-spacing:.3px">${grade}</span>`;
  }

  const subjectRows = subjects.map((sub, i) => {
    const cw  = sub.classwork_score  != null ? parseFloat(sub.classwork_score)  : null;
    const ct  = sub.class_test_score != null ? parseFloat(sub.class_test_score) : null;
    const cs  = sub.class_score      != null ? parseFloat(sub.class_score)      : null;
    const es  = sub.exam_score       != null ? parseFloat(sub.exam_score)       : null;
    const tot = (cs ?? 0) + (es ?? 0);
    const has = cs != null || es != null;
    const grade   = has ? (sub.grade        || gradeInfo(tot).grade)   : '';
    const meaning = has ? (sub.grade_meaning || gradeInfo(tot).meaning) : '';
    const gc   = gradeColor(grade || '—');
    const even = i % 2 === 0;
    const fmt  = (v, fallback = '—') => v != null ? v.toFixed(1) : fallback;

    return `<tr style="background:${even ? '#fff' : '#fafafa'};border-bottom:1px solid #f0f0f0">
      <td style="padding:8px 12px;font-weight:600;font-size:12px;color:#1a1a2e">${sub.subject || ''}</td>
      <td style="text-align:center;padding:8px 6px;font-size:12px;color:#374151">${fmt(cw)}</td>
      <td style="text-align:center;padding:8px 6px;font-size:12px;color:#374151">${fmt(ct)}</td>
      <td style="text-align:center;padding:8px 6px;font-size:12px;color:#374151">${fmt(cs)}</td>
      <td style="text-align:center;padding:8px 6px;font-size:12px;color:#374151">${fmt(es)}</td>
      <td style="text-align:center;padding:8px 10px;vertical-align:middle">
        ${has
          ? `<div style="font-weight:800;font-size:13px;color:${gc};margin-bottom:3px">${tot.toFixed(1)}</div>
             <div style="width:60px;height:4px;background:#e9ecef;border-radius:2px;margin:0 auto">
               <div style="width:${Math.min(tot,100)}%;height:4px;background:${gc};border-radius:2px"></div>
             </div>`
          : '<span style="color:#ccc">—</span>'}
      </td>
      <td style="text-align:center;padding:8px 6px">${pillHtml(grade)}</td>
      <td style="padding:8px 10px;font-size:11px;color:#666">${meaning}</td>
      <td style="text-align:center;padding:8px 6px;font-size:11px;color:#9ca3af">${has && sub.subj_pos_class != null ? sub.subj_pos_class : '—'}</td>
      <td style="padding:8px 10px;font-size:11px;color:#9ca3af;text-align:center">${sub.teacher_name || ''}</td>
    </tr>`;
  }).join('');

  const remarkItems = REMARK_FIELDS
    .filter(({ key }) => remarks[key])
    .map(({ key, label }) =>
      `<div style="display:flex;gap:0;border-bottom:1px solid #f3f4f6;padding:9px 0;align-items:baseline">
         <div style="min-width:190px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;flex-shrink:0;padding-top:1px">${label}</div>
         <div style="font-size:12px;color:#1a1a2e;line-height:1.5;flex:1">${remarks[key]}</div>
       </div>`
    ).join('');

  const blankRemarks = REMARK_FIELDS
    .filter(({ key }) => !remarks[key])
    .map(({ key, label }) =>
      `<div style="display:flex;gap:0;border-bottom:1px solid #f3f4f6;padding:9px 0;align-items:center">
         <div style="min-width:190px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;flex-shrink:0">${label}</div>
         <div style="flex:1;border-bottom:1px dotted #d1d5db;height:18px"></div>
       </div>`
    ).join('');

  let feesHTML = '<p style="color:#9ca3af;font-size:13px;padding:20px 0;text-align:center">No fee payment records found for this student.</p>';
  if (fees && fees.length > 0) {
    const totBilled = fees.reduce((s, f) => s + parseFloat(f.total_amount || 0), 0);
    const totPaid   = fees.reduce((s, f) => s + parseFloat(f.total_paid   || 0), 0);
    const totBal    = totBilled - totPaid;
    const totOver   = fees.reduce((s, f) => s + parseFloat(f.overdue_amount || 0), 0);
    const paidPct   = totBilled > 0 ? Math.round((totPaid / totBilled) * 100) : 0;

    const feeRows = fees.map((f, i) => {
      const bal = parseFloat(f.balance || 0);
      const ov  = parseFloat(f.overdue_amount || 0);
      const even = i % 2 === 0;
      return `<tr style="background:${even ? '#fff' : '#fafafa'};border-bottom:1px solid #f0f0f0">
        <td style="padding:9px 12px;font-size:12px;font-weight:600;color:#1a1a2e">${f.term_name || '—'}</td>
        <td style="padding:9px 12px;font-size:12px;color:#555;text-transform:capitalize">${(f.plan_type || '').replace(/_/g,' ')}</td>
        <td style="text-align:right;padding:9px 12px;font-size:12px;font-weight:600;color:#374151">GH₵ ${parseFloat(f.total_amount||0).toFixed(2)}</td>
        <td style="text-align:right;padding:9px 12px;font-size:12px;font-weight:600;color:#166534">GH₵ ${parseFloat(f.total_paid||0).toFixed(2)}</td>
        <td style="text-align:right;padding:9px 12px;font-size:12px;font-weight:700;color:${bal > 0 ? '#991b1b' : '#166534'}">GH₵ ${bal.toFixed(2)}</td>
        <td style="text-align:right;padding:9px 12px;font-size:12px;color:${ov > 0 ? '#c2410c' : '#9ca3af'}">GH₵ ${ov.toFixed(2)}</td>
      </tr>`;
    }).join('');

    feesHTML = `
      <div style="display:flex;gap:16px;margin-bottom:24px">
        <div style="flex:1;background:#f8faff;border-top:3px solid ${primaryColor};border-radius:6px;padding:14px 16px">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;font-weight:700;margin-bottom:4px">Total Billed</div>
          <div style="font-size:22px;font-weight:900;color:#1a1a2e">GH₵ ${totBilled.toFixed(2)}</div>
        </div>
        <div style="flex:1;background:#f0fdf4;border-top:3px solid #16a34a;border-radius:6px;padding:14px 16px">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;font-weight:700;margin-bottom:4px">Total Paid</div>
          <div style="font-size:22px;font-weight:900;color:#166534">GH₵ ${totPaid.toFixed(2)}</div>
          <div style="font-size:10px;color:#16a34a;margin-top:2px">${paidPct}% settled</div>
        </div>
        <div style="flex:1;background:${totBal > 0 ? '#fff8f8' : '#f0fdf4'};border-top:3px solid ${totBal > 0 ? '#ef4444' : '#16a34a'};border-radius:6px;padding:14px 16px">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;font-weight:700;margin-bottom:4px">Balance Due</div>
          <div style="font-size:22px;font-weight:900;color:${totBal > 0 ? '#991b1b' : '#166534'}">GH₵ ${totBal.toFixed(2)}</div>
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div style="height:8px;background:#e9ecef;border-radius:4px;overflow:hidden">
          <div style="height:8px;background:#16a34a;border-radius:4px;width:${paidPct}%"></div>
        </div>
        <div style="font-size:10px;color:#9ca3af;margin-top:5px;text-align:right">${paidPct}% of total fees paid</div>
      </div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e9ecef">Payment Breakdown</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:${primaryColor}">
            <th style="text-align:left;padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Term</th>
            <th style="text-align:left;padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Plan</th>
            <th style="text-align:right;padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Billed</th>
            <th style="text-align:right;padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Paid</th>
            <th style="text-align:right;padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Balance</th>
            <th style="text-align:right;padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Overdue</th>
          </tr>
        </thead>
        <tbody>${feeRows}</tbody>
        <tfoot>
          <tr style="border-top:2px solid #e9ecef;background:#f8f9fa">
            <td colspan="2" style="padding:10px 12px;font-weight:700;font-size:12px;color:#374151">TOTALS</td>
            <td style="text-align:right;padding:10px 12px;font-weight:700;font-size:12px;color:#374151">GH₵ ${totBilled.toFixed(2)}</td>
            <td style="text-align:right;padding:10px 12px;font-weight:700;font-size:12px;color:#166534">GH₵ ${totPaid.toFixed(2)}</td>
            <td style="text-align:right;padding:10px 12px;font-weight:700;font-size:12px;color:${totBal > 0 ? '#991b1b' : '#166534'}">GH₵ ${totBal.toFixed(2)}</td>
            <td style="text-align:right;padding:10px 12px;font-weight:700;font-size:12px;color:${totOver > 0 ? '#c2410c' : '#9ca3af'}">GH₵ ${totOver.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      ${totBal > 0
        ? `<div style="border-left:4px solid #ef4444;background:#fff8f8;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:16px">
             <div style="font-size:13px;font-weight:700;color:#991b1b;margin-bottom:3px">Outstanding Balance: GH₵ ${totBal.toFixed(2)}</div>
             <div style="font-size:11px;color:#7f1d1d;line-height:1.5">Please settle this balance before the start of the next term.</div>
           </div>`
        : `<div style="border-left:4px solid #16a34a;background:#f0fdf4;padding:14px 18px;border-radius:0 6px 6px 0;margin-bottom:16px">
             <div style="font-size:13px;font-weight:700;color:#166534">All fees fully settled — Thank you!</div>
           </div>`
      }`;
  }

  const logoHTML = logoUrl
    ? `<img src="${logoUrl}" style="width:76px;height:76px;object-fit:contain;border-radius:6px;flex-shrink:0" />`
    : `<div style="width:76px;height:76px;background:${primaryColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:900;flex-shrink:0">${schoolName.charAt(0)}</div>`;

  function pageHeader(subtitle) {
    return `<div style="display:flex;align-items:center;gap:20px;padding-bottom:14px;margin-bottom:20px;border-bottom:3px solid ${primaryColor}">
      ${logoHTML}
      <div style="flex:1;text-align:center">
        <div style="font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.5px;color:#1a1a2e">${schoolName}</div>
        ${motto ? `<div style="font-size:11px;color:#888;font-style:italic;margin-top:3px">"${motto}"</div>` : ''}
        <div style="display:inline-block;margin-top:8px;font-size:10px;font-weight:700;letter-spacing:1.8px;color:${primaryColor};text-transform:uppercase;border-top:1px solid #e5e7eb;padding-top:6px">${subtitle}</div>
      </div>
      <div style="width:76px"></div>
    </div>`;
  }

  function studentBand(showStudentNo) {
    return `<div style="display:flex;gap:0;background:linear-gradient(90deg,${primaryColor}18,${primaryColor}08);border-left:4px solid ${primaryColor};border-radius:0 8px 8px 0;padding:12px 20px;margin-bottom:22px;flex-wrap:wrap;gap:32px">
      <div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af">Student Name</div>
        <div style="font-size:15px;font-weight:800;color:#1a1a2e;margin-top:2px">${studentName}</div>
      </div>
      ${showStudentNo ? `<div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af">Student No.</div>
        <div style="font-size:14px;font-weight:700;color:#374151;margin-top:2px">${studentCode || '—'}</div>
      </div>` : ''}
      <div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af">Class</div>
        <div style="font-size:14px;font-weight:700;color:#374151;margin-top:2px">${className}</div>
      </div>
      <div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af">Term</div>
        <div style="font-size:14px;font-weight:700;color:#374151;margin-top:2px">${termName}</div>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Report Card — ${studentName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; }
    @page { size: A4; margin: 14mm 16mm; }
    @media print { .no-print { display: none !important; } }
    .page-break { page-break-before: always; padding-top: 2px; }
    table { width: 100%; border-collapse: collapse; }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()"
    style="display:block;margin:16px 16px 0;padding:9px 28px;background:${primaryColor};color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:700;letter-spacing:.3px">
    Print / Save as PDF
  </button>
  <div style="padding:18px">
    ${pageHeader('Terminal Report Card')}
    ${studentBand(true)}
    <div style="display:flex;align-items:center;gap:0;background:#f8f9fa;border-radius:8px;padding:14px 20px;margin-bottom:20px;border:1px solid #e9ecef">
      <div style="flex:0;text-align:center;min-width:100px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af;font-weight:700;margin-bottom:4px">Overall Grade</div>
        <div style="font-size:48px;font-weight:900;line-height:1;color:${gcOverall}">${overallGI.grade || '—'}</div>
        <div style="font-size:11px;font-weight:600;color:${gcOverall};margin-top:3px">${overallGI.meaning || ''}</div>
      </div>
      <div style="width:1px;background:#e5e7eb;align-self:stretch;margin:0 24px"></div>
      <div style="flex:1;display:flex;gap:32px;flex-wrap:wrap">
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af;font-weight:700;margin-bottom:4px">Average Score</div>
          <div style="font-size:22px;font-weight:800;color:#1a1a2e">${avgPct}%</div>
        </div>
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af;font-weight:700;margin-bottom:4px">Aggregate Total</div>
          <div style="font-size:22px;font-weight:800;color:#1a1a2e">${aggTotal.toFixed(1)} <span style="font-size:14px;color:#9ca3af;font-weight:600">/ ${scored.length * 100}</span></div>
        </div>
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af;font-weight:700;margin-bottom:4px">Subjects Sat</div>
          <div style="font-size:22px;font-weight:800;color:#1a1a2e">${scored.length}</div>
        </div>
      </div>
    </div>
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e9ecef">Academic Performance</div>
    <table style="margin-bottom:22px">
      <thead>
        <tr style="background:${primaryColor}">
          <th style="text-align:left;padding:9px 12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:22%">Subject</th>
          <th style="text-align:center;padding:9px 6px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:9%">CW+HW<br><span style="font-weight:400;font-size:9px">(20%)</span></th>
          <th style="text-align:center;padding:9px 6px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:9%">Test<br><span style="font-weight:400;font-size:9px">(20%)</span></th>
          <th style="text-align:center;padding:9px 6px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:9%">Class<br><span style="font-weight:400;font-size:9px">(40%)</span></th>
          <th style="text-align:center;padding:9px 6px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:9%">Exam<br><span style="font-weight:400;font-size:9px">(60%)</span></th>
          <th style="text-align:center;padding:9px 10px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:10%">Total</th>
          <th style="text-align:center;padding:9px 8px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:8%">Grade</th>
          <th style="text-align:left;padding:9px 8px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:12%">Remark</th>
          <th style="text-align:center;padding:9px 6px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;width:6%">Pos.</th>
          <th style="text-align:center;padding:9px 8px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Teacher</th>
        </tr>
      </thead>
      <tbody>${subjectRows}</tbody>
      <tfoot>
        <tr style="background:#f8f9fa;border-top:2px solid #e9ecef">
          <td colspan="5" style="padding:9px 12px;font-weight:700;font-size:12px;color:#374151">Aggregate / Average</td>
          <td style="text-align:center;padding:9px 10px">
            <div style="font-weight:900;font-size:14px;color:${gcOverall}">${aggTotal.toFixed(1)}</div>
            <div style="font-size:10px;color:#9ca3af">${avgPct}%</div>
          </td>
          <td style="text-align:center;padding:9px 8px">${pillHtml(overallGI.grade)}</td>
          <td colspan="3" style="padding:9px 10px;font-size:11px;color:#6b7280">${overallGI.meaning || ''} &nbsp;·&nbsp; ${scored.length} subject${scored.length !== 1 ? 's' : ''}</td>
        </tr>
      </tfoot>
    </table>
    ${(remarkItems || blankRemarks) ? `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e9ecef">Terminal Remarks</div>
      ${remarkItems}${blankRemarks}
    </div>` : ''}
    <div style="margin-bottom:18px;background:#f8f9fa;border-radius:6px;padding:10px 14px">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af;font-weight:700;margin-bottom:8px">Grade Scale</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${[['A1','80–100','Excellent','#166534','#dcfce7'],['B2','75–79','Very Good','#166534','#d1fae5'],['B3','70–74','Good','#166534','#d1fae5'],
           ['C4','65–69','Credit','#92400e','#fef9c3'],['C5','60–64','Credit','#92400e','#fef9c3'],['C6','55–59','Credit','#92400e','#fef9c3'],
           ['D7','50–54','Approx.','#9a3412','#ffedd5'],['E8','45–49','Pass','#9a3412','#ffedd5'],['F9','0–44','Fail','#991b1b','#fee2e2']]
          .map(([g,r,l,c,b]) => `<div style="display:flex;align-items:center;gap:5px">
            <span style="display:inline-block;padding:1px 8px;border-radius:10px;background:${b};color:${c};font-weight:800;font-size:10px">${g}</span>
            <span style="font-size:10px;color:#666">${r} · ${l}</span>
          </div>`).join('')}
      </div>
    </div>
    ${(function() {
      const ROLE_LABEL = {
        owner: 'Principal / Proprietor', headmaster_academics: 'Headmaster (Academics)',
        headmaster_admin: 'Headmaster (Admin)', department_head: 'Department Head',
        class_teacher: 'Class Teacher', teacher: 'Teacher',
        accountant: 'Accountant', bursar: 'Bursar',
      };
      const ctApproval   = approvals.find(a => a.approval_tier === 'class_teacher' && a.status === 'approved');
      const headApproval = approvals.find(a => a.approval_tier === 'headmaster'    && a.status === 'approved');
      const anyPending = !ctApproval || !headApproval;
      function stampBlock(tier, fallbackTitle) {
        const approval = tier === 'class_teacher' ? ctApproval : headApproval;
        if (approval) {
          const label = ROLE_LABEL[approval.approver_role] || (approval.approver_role || '').replace(/_/g,' ');
          return `<div style="flex:1;text-align:center;padding:0 8px">
            <div style="min-height:80px;border:1px solid #bbf7d0;border-radius:8px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;margin-bottom:6px;padding:6px">
              <img src="${approval.signature_data}" style="max-height:64px;max-width:160px;object-fit:contain" />
            </div>
            <div style="border-top:1.5px solid #374151;padding-top:5px;margin:0 8px">
              <div style="font-size:11px;font-weight:700;color:#1a1a2e">${approval.approver_name || '&nbsp;'}</div>
              <div style="font-size:10px;color:#6b7280;text-transform:capitalize">${label}</div>
            </div>
          </div>`;
        }
        return `<div style="flex:1;text-align:center;padding:0 8px">
          <div style="min-height:80px;border:1.5px dashed #fca5a5;border-radius:8px;background:#fff8f8;display:flex;align-items:center;justify-content:center;margin-bottom:6px;padding:6px">
            <span style="display:inline-block;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px">Awaiting Approval</span>
          </div>
          <div style="border-top:1.5px solid #374151;padding-top:5px;margin:0 8px">
            <div style="font-size:11px;font-weight:700;color:#1a1a2e">&nbsp;</div>
            <div style="font-size:10px;color:#6b7280;text-transform:capitalize">${fallbackTitle}</div>
          </div>
        </div>`;
      }
      const pendingBanner = anyPending
        ? `<div style="background:#fee2e2;border-left:4px solid #dc2626;border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#991b1b;font-weight:700">&#9888; This document has not been fully approved. Signature(s) pending.</div>`
        : '';
      return `<div style="border-top:1px solid #e9ecef;padding-top:16px">
        ${pendingBanner}
        <div style="display:flex;gap:20px;margin-bottom:14px">
          <div style="flex:1;font-size:11px;color:#555"><strong>Next Term Opens:</strong><div style="border-bottom:1px solid #aaa;margin-top:18px"></div></div>
          <div style="flex:1;font-size:11px;color:#555"><strong>Form Position:</strong><div style="border-bottom:1px solid #aaa;margin-top:18px"></div></div>
          <div style="flex:1;font-size:11px;color:#555"><strong>Promoted To:</strong><div style="border-bottom:1px solid #aaa;margin-top:18px"></div></div>
        </div>
        <div style="display:flex;gap:12px">
          ${stampBlock('headmaster', 'Headteacher')}
          ${stampBlock('class_teacher', 'Class Teacher')}
          <div style="flex:1;text-align:center;padding:0 8px">
            <div style="min-height:80px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;display:flex;align-items:center;justify-content:center;margin-bottom:6px">
              <span style="font-size:12px;font-weight:700;color:#374151">${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</span>
            </div>
            <div style="border-top:1.5px solid #374151;padding-top:5px;margin:0 8px">
              <div style="font-size:10px;color:#6b7280">Date Issued</div>
            </div>
          </div>
        </div>
      </div>`;
    })()}
  </div>
  <div class="page-break" style="padding:18px">
    ${pageHeader('Student Fee Statement')}
    ${studentBand(false)}
    ${feesHTML}
    <div style="display:flex;gap:40px;margin-top:36px;border-top:1px solid #e9ecef;padding-top:18px">
      <div style="flex:1">
        <div style="font-size:11px;color:#555;margin-bottom:20px">Parent / Guardian Signature</div>
        <div style="border-bottom:1px solid #999"></div>
        <div style="font-size:11px;color:#555;margin-top:16px;margin-bottom:20px">Date</div>
        <div style="border-bottom:1px solid #999;width:180px"></div>
      </div>
      <div style="text-align:center">
        <div style="font-size:11px;color:#555;margin-bottom:6px">Accounts Office</div>
        ${(function() {
          const acct = signatories.find(s => s.role === 'accountant' || s.role === 'bursar');
          return acct?.signature_data
            ? `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;background:#fafafa;display:inline-block">
                 <img src="${acct.signature_data}" style="max-height:60px;max-width:140px;object-fit:contain;display:block"/>
                 <div style="border-top:1px solid #374151;margin-top:6px;padding-top:4px;font-size:10px;font-weight:700;color:#1a1a2e">${acct.name}</div>
               </div>`
            : `<div style="border:1.5px dashed #d1d5db;width:140px;height:80px;border-radius:6px"></div>`;
        })()}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const sel = { padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, background: '#fff', minWidth: 150 };

// ── Tab 1: Enter Scores ───────────────────────────────────────────────────────
// Shows assessments for the chosen class/subject/term.
// Click an assessment → inline score grid for all students.
function ScoresTab({ classId, subjectId, termId, students }) {
  const [assessments, setAssessments]   = useState([]);
  const [activeId, setActiveId]         = useState(null);
  const [scores, setScores]             = useState({});   // {studentId: scoreString}
  const [loadingAsm, setLoadingAsm]     = useState(false);
  const [loadingRes, setLoadingRes]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');

  useEffect(() => {
    if (!classId || !subjectId || !termId) { setAssessments([]); setActiveId(null); return; }
    setLoadingAsm(true);
    api.get(`/assessments?class_id=${classId}&subject_id=${subjectId}&term_id=${termId}`)
      .then(d => { setAssessments(Array.isArray(d) ? d : []); setActiveId(null); })
      .catch(() => setAssessments([]))
      .finally(() => setLoadingAsm(false));
  }, [classId, subjectId, termId]);

  function selectAssessment(asm) {
    setActiveId(asm.id);
    setMsg('');
    setLoadingRes(true);
    api.get(`/results/assessment/${asm.id}`)
      .then(results => {
        const map = {};
        results.forEach(r => { map[r.student_id] = r.total_score != null ? String(r.total_score) : ''; });
        setScores(map);
      })
      .catch(() => setScores({}))
      .finally(() => setLoadingRes(false));
  }

  async function saveScores() {
    const asm = assessments.find(a => a.id === activeId);
    if (!asm) return;
    const records = students
      .filter(s => scores[s.id] !== '' && scores[s.id] != null)
      .map(s => ({
        student_id:    s.id,
        assessment_id: asm.id,
        score_theory:  parseFloat(scores[s.id]),
      }));
    if (!records.length) { setMsg('No scores entered.'); return; }
    setSaving(true); setMsg('');
    try {
      await api.post('/results/bulk', { records });
      setMsg(`Saved ${records.length} score${records.length !== 1 ? 's' : ''}.`);
      setTimeout(() => setMsg(''), 3500);
    } catch (err) { setMsg(err.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  const activeAsm = assessments.find(a => a.id === activeId);

  const typeTag = (type) => {
    const colors = {
      exam: ['#1e40af', '#dbeafe'], class_test: ['#92400e', '#fef3c7'],
      classwork: ['#166534', '#dcfce7'], homework: ['#166534', '#dcfce7'],
      AfL: ['#6b21a8', '#f3e8ff'], AaL: ['#6b21a8', '#f3e8ff'], AoL: ['#6b21a8', '#f3e8ff'],
    };
    const [fg, bg] = colors[type] || ['#374151', '#f3f4f6'];
    return <span style={{ background: bg, color: fg, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{type}</span>;
  };

  if (!classId || !subjectId || !termId) return null;

  return (
    <div>
      {loadingAsm && <div style={{ color: '#6b7280', padding: '20px 0' }}>Loading assessments…</div>}

      {!loadingAsm && assessments.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          No assessments found for this class and subject. Create one in the Assessments page first.
        </div>
      )}

      {assessments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 20 }}>
          {assessments.map(a => (
            <button key={a.id} onClick={() => selectAssessment(a)} style={{
              textAlign: 'left', padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
              border: activeId === a.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
              background: activeId === a.id ? '#eff6ff' : '#fff',
              transition: 'all .15s',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 6 }}>{a.title}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {typeTag(a.type)}
                {a.max_score != null && (
                  <span style={{ fontSize: 11, color: '#6b7280' }}>Max: {a.max_score}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {activeAsm && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px', marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{activeAsm.title}</span>
              <span style={{ marginLeft: 10 }}>{typeTag(activeAsm.type)}</span>
              {activeAsm.max_score != null && (
                <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>out of {activeAsm.max_score}</span>
              )}
            </div>
            {msg && (
              <span style={{ fontSize: 13, color: msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                {msg}
              </span>
            )}
          </div>

          {loadingRes && <div style={{ color: '#6b7280' }}>Loading existing scores…</div>}

          {!loadingRes && students.length > 0 && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Student</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#374151', width: 80 }}>Code</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#374151', width: 140 }}>
                        Score {activeAsm.max_score ? `/ ${activeAsm.max_score}` : ''}
                      </th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#374151', width: 80 }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => {
                      const val = scores[s.id] ?? '';
                      const pct = val !== '' && activeAsm.max_score > 0
                        ? (parseFloat(val) / activeAsm.max_score * 100)
                        : null;
                      const gc = pct != null ? (pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626') : '#9ca3af';
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ padding: '7px 12px', fontWeight: 600, fontSize: 13 }}>{s.name}</td>
                          <td style={{ padding: '7px 12px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{s.student_code}</td>
                          <td style={{ padding: '5px 12px', textAlign: 'center' }}>
                            <input
                              type="number" min="0" max={activeAsm.max_score || undefined}
                              step="0.5" value={val}
                              onChange={e => setScores(prev => ({ ...prev, [s.id]: e.target.value }))}
                              style={{ width: 100, padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, textAlign: 'center' }}
                            />
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 700, color: gc, fontSize: 13 }}>
                            {pct != null ? `${pct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={saveScores} disabled={saving}
                style={{ marginTop: 16, padding: '9px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Saving…' : 'Save Scores'}
              </button>
            </>
          )}

          {!loadingRes && students.length === 0 && (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>No active students in this class.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: View Grades ────────────────────────────────────────────────────────
// Computed grade table for the class/subject/term. One button to compute.
function GradesTab({ classId, subjectId, termId }) {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [computing, setComputing] = useState(false);
  const [msg, setMsg]           = useState('');

  function load() {
    if (!classId || !subjectId || !termId) { setRows([]); return; }
    setLoading(true);
    api.get(`/grades?class_id=${classId}&subject_id=${subjectId}&term_id=${termId}`)
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(err => setMsg(err.message || 'Failed to load grades.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [classId, subjectId, termId]);

  async function compute() {
    setComputing(true); setMsg('');
    try {
      const result = await api.post('/grades/compute', { class_id: classId, subject_id: subjectId, term_id: termId });
      setMsg(`Grades computed for ${result.computed} student${result.computed !== 1 ? 's' : ''}.`);
      setTimeout(() => setMsg(''), 4000);
      load();
    } catch (err) { setMsg(err.message || 'Compute failed'); }
    finally { setComputing(false); }
  }

  if (!classId || !subjectId || !termId) return null;

  const completedRows = rows.filter(r => r.class_score != null || r.exam_score != null);
  const classAvg = completedRows.length
    ? (completedRows.reduce((s, r) => s + (parseFloat(r.class_score)||0) + (parseFloat(r.exam_score)||0), 0) / completedRows.length).toFixed(1)
    : null;
  const avgGrade = classAvg ? gradeInfo(parseFloat(classAvg)).grade : null;

  return (
    <div>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1e40af' }}>
        &#9432; Grades are computed from scores: <strong>Classwork + Homework</strong> → /20 &nbsp;+&nbsp; <strong>Class Test</strong> → /20 &nbsp;=&nbsp; Class Score /40 &nbsp;|&nbsp; <strong>Exam</strong> → /60 &nbsp;|&nbsp; Total /100
      </div>

      {msg && (
        <div style={{ marginBottom: 14, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') ? '#fee2e2' : '#dcfce7',
          color: msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') ? '#991b1b' : '#166534' }}>
          {msg}
        </div>
      )}

      {loading && <div style={{ color: '#6b7280', padding: '20px 0' }}>Loading grades…</div>}

      {!loading && rows.length > 0 && (
        <>
          {completedRows.length > 0 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                <div style={{ width: `${(completedRows.length / rows.length) * 100}%`, height: '100%', background: '#2563eb', borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{completedRows.length}/{rows.length} computed</span>
              {classAvg && (
                <span style={{ fontSize: 13, fontWeight: 800, color: gradeColor(avgGrade), marginLeft: 8 }}>
                  Class avg: {classAvg} &nbsp;
                  <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, background: gradeBg(avgGrade), fontSize: 12 }}>{avgGrade}</span>
                </span>
              )}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#fff' }}>
                  {['Student', 'Code', 'CW+HW /20', 'Test /20', 'Class /40', 'Exam /60', 'Total /100', 'Grade', 'Pos.'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 11, textAlign: h === 'Student' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const cw  = r.classwork_score  != null ? parseFloat(r.classwork_score)  : null;
                  const ct  = r.class_test_score != null ? parseFloat(r.class_test_score) : null;
                  const cs  = r.class_score       != null ? parseFloat(r.class_score)       : null;
                  const es  = r.exam_score        != null ? parseFloat(r.exam_score)        : null;
                  const tot = (cs ?? 0) + (es ?? 0);
                  const has = cs != null || es != null;
                  const { grade } = has ? gradeInfo(tot) : { grade: '—' };
                  const gc = gradeColor(grade);
                  const dash = <span style={{ color: '#d1d5db' }}>—</span>;
                  const fmt = v => v != null ? <span style={{ fontWeight: 700, color: '#374151' }}>{v.toFixed(1)}</span> : dash;
                  return (
                    <tr key={r.student_id} style={{ borderBottom: '1px solid #f0f0f0', background: has ? gradeRowTint(grade) : '#fff' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 13 }}>{r.name}</td>
                      <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>{r.student_code}</td>
                      <td style={{ textAlign: 'center', padding: '8px' }}>{fmt(cw)}</td>
                      <td style={{ textAlign: 'center', padding: '8px' }}>{fmt(ct)}</td>
                      <td style={{ textAlign: 'center', padding: '8px' }}>{fmt(cs)}</td>
                      <td style={{ textAlign: 'center', padding: '8px' }}>{fmt(es)}</td>
                      <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                        {has ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: 60, height: 5, background: '#e5e7eb', borderRadius: 3 }}>
                              <div style={{ width: `${Math.min(tot, 100)}%`, height: '100%', background: gc, borderRadius: 3 }} />
                            </div>
                            <strong style={{ fontSize: 13, color: gc }}>{tot.toFixed(1)}</strong>
                          </div>
                        ) : dash}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontWeight: 800, fontSize: 13, background: gradeBg(grade), color: gc }}>
                          {grade}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{has && r.subj_pos_class != null ? r.subj_pos_class : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          No students found. Enter scores first, then compute grades.
        </div>
      )}

      <button onClick={compute} disabled={computing} style={{
        marginTop: 16, padding: '9px 24px', background: '#2563eb', color: '#fff',
        border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
        cursor: computing ? 'not-allowed' : 'pointer', opacity: computing ? 0.7 : 1,
      }}>
        {computing ? 'Computing…' : 'Compute Grades from Scores'}
      </button>
    </div>
  );
}

// ── Tab 3: Student Report ─────────────────────────────────────────────────────
// Pick a student → see their full grade breakdown, enter remarks, print report card.
function ReportTab({ classId, termId, classes, terms, students }) {
  const { user }  = useAuth();
  const canWrite  = hasPrivilege(user, 'academic:write');

  const [studentId, setStudentId]       = useState('');
  const [subjects, setSubjects]         = useState([]);
  const [remarks, setRemarks]           = useState({});
  const [approvalStatus, setApprovalStatus] = useState([]);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [printing, setPrinting]         = useState(false);
  const [requestingSignatures, setRequestingSignatures] = useState(false);
  const [msg, setMsg]                   = useState('');
  const [sigMsg, setSigMsg]             = useState('');

  useEffect(() => { setStudentId(''); setSubjects([]); setRemarks({}); }, [classId]);

  useEffect(() => {
    if (!studentId || !termId) { setSubjects([]); setRemarks({}); setApprovalStatus([]); return; }
    setLoading(true);
    Promise.all([
      api.get(`/grades/report/${studentId}?term_id=${termId}`),
      api.get(`/grades/remarks/${studentId}?term_id=${termId}`),
      api.get(`/approvals/status?student_id=${studentId}&term_id=${termId}`),
    ])
      .then(([subs, rem, approvs]) => {
        setSubjects(Array.isArray(subs) ? subs : []);
        setRemarks(rem || {});
        setApprovalStatus(Array.isArray(approvs) ? approvs : []);
      })
      .catch(err => setMsg(err.message || 'Failed to load record.'))
      .finally(() => setLoading(false));
  }, [studentId, termId]);

  function updateRemark(key, value) { setRemarks(prev => ({ ...prev, [key]: value })); }

  async function saveRemarks() {
    setSaving(true); setMsg('');
    try {
      await api.post('/grades/remarks', { student_id: studentId, term_id: termId, ...remarks });
      setMsg('Remarks saved.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg(err.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function requestSignatures() {
    setRequestingSignatures(true); setSigMsg('');
    try {
      const res = await api.post('/approvals/request-class', { class_id: classId, term_id: termId, document_type: 'report_card' });
      setSigMsg(`Signature request sent. Created: ${res.created}, already existed: ${res.skipped}.`);
      const approvs = await api.get(`/approvals/status?student_id=${studentId}&term_id=${termId}`);
      setApprovalStatus(Array.isArray(approvs) ? approvs : []);
    } catch (err) { setSigMsg(err.message || 'Failed to request signatures.'); }
    finally { setRequestingSignatures(false); }
  }

  async function printReport() {
    setPrinting(true);
    const studentObj = students.find(s => s.id === studentId);
    const className  = classes.find(c => c.id === classId)?.name || '';
    const termName   = terms.find(t => t.id === termId)?.name    || '';
    let branding = {}, fees = [], signatories = [], approvals = approvalStatus;
    try {
      const [brandRes, feesRes, sigRes] = await Promise.all([
        client.get('/school/branding'),
        client.get(`/payments/plans?student_id=${studentId}`),
        client.get('/profile/signatories'),
      ]);
      branding = brandRes.data || {}; fees = feesRes.data || [];
      signatories = Array.isArray(sigRes.data) ? sigRes.data : [];
    } catch {}
    try {
      const approvRes = await api.get(`/approvals/status?student_id=${studentId}&term_id=${termId}`);
      approvals = Array.isArray(approvRes) ? approvRes : approvals;
    } catch {}
    setPrinting(false);
    const win = window.open('', '_blank', 'width=960,height=800');
    if (!win) { setMsg('Pop-up blocked — please allow pop-ups.'); return; }
    win.document.write(buildPrintHTML({
      studentName: studentObj?.name || '', studentCode: studentObj?.student_code || '',
      className, termName, subjects, remarks, branding, fees, signatories, approvals,
    }));
    win.document.close();
  }

  const scored   = subjects.filter(s => s.class_score != null || s.exam_score != null);
  const aggTotal = scored.reduce((s, sub) => s + (parseFloat(sub.class_score)||0) + (parseFloat(sub.exam_score)||0), 0);
  const avgPct   = scored.length > 0 ? aggTotal / scored.length : null;
  const overallGI = gradeInfo(avgPct);
  const strong = scored.filter(s => (parseFloat(s.class_score)||0)+(parseFloat(s.exam_score)||0) >= 70).length;
  const weak   = scored.filter(s => (parseFloat(s.class_score)||0)+(parseFloat(s.exam_score)||0) < 50).length;

  return (
    <>
      {/* Student picker + actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase' }}>Student</div>
          <SearchableSelect
            value={studentId}
            onChange={v => { setStudentId(v); setMsg(''); setSigMsg(''); }}
            options={students.map(s => ({ value: s.id, label: s.name }))}
            placeholder="— Select Student —"
            disabled={!classId}
            style={{ minWidth: 220 }}
          />
        </div>
        {subjects.length > 0 && (
          <button onClick={printReport} disabled={printing} className="btn btn-secondary">
            {printing ? 'Preparing…' : '🖨 Print Report Card'}
          </button>
        )}
        {canWrite && classId && termId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={requestSignatures} disabled={requestingSignatures} style={{
              padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none',
              borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: requestingSignatures ? 'not-allowed' : 'pointer',
              opacity: requestingSignatures ? 0.6 : 1,
            }}>
              {requestingSignatures ? 'Requesting…' : 'Request Signatures for Class'}
            </button>
            {sigMsg && <div style={{ fontSize: 12, color: sigMsg.includes('fail') ? '#dc2626' : '#16a34a' }}>{sigMsg}</div>}
          </div>
        )}
      </div>

      {msg && <div style={{ marginBottom: 14, padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: msg.includes('saved') ? '#dcfce7' : '#fee2e2', color: msg.includes('saved') ? '#166534' : '#991b1b' }}>{msg}</div>}
      {loading && <div style={{ color: '#6b7280', padding: '20px 0' }}>Loading student record…</div>}

      {!loading && subjects.length > 0 && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Overall Grade', value: overallGI.grade, sub: avgPct != null ? `${avgPct.toFixed(1)}% avg` : '', color: gradeColor(overallGI.grade), border: gradeColor(overallGI.grade) },
              { label: 'Strong ≥70',   value: strong, sub: 'subjects', color: '#16a34a', bg: '#f0fdf4', brd: '#bbf7d0' },
              { label: 'Average 50–69', value: scored.length - strong - weak, sub: 'subjects', color: '#d97706', bg: '#fffbeb', brd: '#fde68a' },
              { label: 'Weak <50',     value: weak, sub: 'subjects', color: '#dc2626', bg: '#fef2f2', brd: '#fecaca' },
              { label: 'Aggregate',    value: aggTotal.toFixed(1), sub: `out of ${scored.length * 100}`, color: '#2563eb', bg: '#eff6ff', brd: '#bfdbfe' },
            ].map(({ label, value, sub, color, bg, brd }) => (
              <div key={label} style={{ background: bg || '#fff', border: `1.5px solid ${brd || color}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Subject table */}
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#fff' }}>
                  {['Subject', 'CW+HW', 'Test', 'Class /40', 'Exam /60', 'Total', 'Grade', 'Meaning', 'Pos.', 'Teacher'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 11, textAlign: h === 'Subject' || h === 'Meaning' || h === 'Teacher' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjects.map(sub => {
                  const cw  = sub.classwork_score  != null ? parseFloat(sub.classwork_score)  : null;
                  const ct  = sub.class_test_score != null ? parseFloat(sub.class_test_score) : null;
                  const cs  = sub.class_score       != null ? parseFloat(sub.class_score)       : null;
                  const es  = sub.exam_score        != null ? parseFloat(sub.exam_score)        : null;
                  const tot = (cs ?? 0) + (es ?? 0);
                  const has = cs != null || es != null;
                  const grade   = has ? (sub.grade || gradeInfo(tot).grade) : '—';
                  const meaning = has ? (sub.grade_meaning || gradeInfo(tot).meaning) : '';
                  const gc = gradeColor(grade);
                  const fmt = v => v != null ? v.toFixed(1) : '—';
                  return (
                    <tr key={sub.code || sub.subject} style={{ borderBottom: '1px solid #f0f0f0', background: has ? gradeRowTint(grade) : '#fff' }}>
                      <td style={{ padding: '9px 10px', fontWeight: 600, fontSize: 13 }}>{sub.subject}</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px', fontSize: 13 }}>{fmt(cw)}</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px', fontSize: 13 }}>{fmt(ct)}</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px', fontSize: 13 }}>{fmt(cs)}</td>
                      <td style={{ textAlign: 'center', padding: '9px 8px', fontSize: 13 }}>{fmt(es)}</td>
                      <td style={{ textAlign: 'center', padding: '9px 10px' }}>
                        {has ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: 56, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
                              <div style={{ width: `${Math.min(tot, 100)}%`, height: '100%', background: gc, borderRadius: 2 }} />
                            </div>
                            <strong style={{ fontSize: 13, color: gc }}>{tot.toFixed(1)}</strong>
                          </div>
                        ) : <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '9px 8px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, fontWeight: 800, fontSize: 13, background: gradeBg(grade), color: gc }}>{grade}</span>
                      </td>
                      <td style={{ padding: '9px 8px', fontSize: 12, color: '#555' }}>{meaning}</td>
                      <td style={{ textAlign: 'center', color: '#6b7280', fontSize: 12 }}>{has && sub.subj_pos_class != null ? sub.subj_pos_class : '—'}</td>
                      <td style={{ padding: '9px 8px', fontSize: 12, color: '#555' }}>{sub.teacher_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Remarks */}
          <div style={{ background: '#f8f9fa', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '10px 16px', background: '#1e293b', color: '#fff', fontSize: 13, fontWeight: 700 }}>Terminal Remarks</div>
            {[
              { key: 'interest',             label: 'Interest',               multiline: false },
              { key: 'conduct',              label: 'Conduct',                multiline: false },
              { key: 'attitude',             label: 'Attitude',               multiline: false },
              { key: 'class_teacher_remark', label: "Class Teacher's Remark", multiline: true  },
              { key: 'academic_remark',      label: 'Academic Remark',        multiline: true  },
            ].map(({ key, label, multiline }) => (
              <div key={key} style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ width: 200, padding: '10px 14px', fontWeight: 600, fontSize: 13, background: '#f3f4f6', flexShrink: 0, color: '#374151' }}>{label}</div>
                <div style={{ flex: 1 }}>
                  {multiline
                    ? <textarea value={remarks[key] || ''} onChange={e => updateRemark(key, e.target.value)} style={{ width: '100%', border: 'none', resize: 'vertical', padding: '10px 14px', minHeight: 60, fontSize: 13, outline: 'none', background: 'transparent', boxSizing: 'border-box' }} />
                    : <input type="text" value={remarks[key] || ''} onChange={e => updateRemark(key, e.target.value)} style={{ width: '100%', border: 'none', padding: '11px 14px', fontSize: 13, outline: 'none', background: 'transparent', boxSizing: 'border-box' }} />}
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" onClick={saveRemarks} disabled={saving}>
            {saving ? 'Saving…' : 'Save Remarks'}
          </button>

          {/* Approval status */}
          {canWrite && (
            <div style={{ marginTop: 20, background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: '#1e293b', color: '#fff', fontSize: 13, fontWeight: 700 }}>Approval Status</div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[{ tier: 'class_teacher', label: 'Class Teacher' }, { tier: 'headmaster', label: 'Headmaster' }].map(({ tier, label }) => {
                    const record     = approvalStatus.find(a => a.approval_tier === tier);
                    const isApproved = record?.status === 'approved';
                    const isPending  = record?.status === 'pending';
                    return (
                      <div key={tier} style={{ flex: '1 1 160px', background: '#fff', border: `1px solid ${isApproved ? '#bbf7d0' : isPending ? '#fde68a' : '#e5e7eb'}`, borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                        {isApproved ? (
                          <>
                            <div style={{ color: '#16a34a', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>✓ Approved</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{record.approver_name}</div>
                          </>
                        ) : isPending ? (
                          <div style={{ color: '#d97706', fontWeight: 600, fontSize: 13 }}>⏱ Awaiting Approval</div>
                        ) : (
                          <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Not requested</div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>Use "Request Signatures for Class" above to send approval requests.</div>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && studentId && subjects.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>No grade records for this student and term yet.</div>
      )}
      {!studentId && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>Select a student above to view their full academic record.</div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'scores', label: '1 · Enter Scores' },
  { id: 'grades', label: '2 · View Grades'  },
  { id: 'report', label: '3 · Student Report' },
];

export default function Grades() {
  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms]       = useState([]);
  const [classId, setClassId]   = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [termId, setTermId]     = useState('');
  const [students, setStudents] = useState([]);
  const [tab, setTab]           = useState('scores');
  const [initErr, setInitErr]   = useState('');

  useEffect(() => {
    document.title = 'Academic Records — SchoolSaaS';
    Promise.all([
      getCached('/classes',  'classes'),
      getCached('/subjects', 'subjects'),
      getCached('/terms',    'terms'),
    ])
      .then(([cls, sub, trm]) => {
        setClasses(Array.isArray(cls) ? cls : []);
        setSubjects(Array.isArray(sub) ? sub : []);
        const termList = Array.isArray(trm) ? trm : [];
        setTerms(termList);
        const cur = termList.find(t => t.is_current) || termList[0];
        if (cur) setTermId(cur.id);
      })
      .catch(err => setInitErr(err.message || 'Failed to load data.'));
  }, []);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    api.get(`/students?class_id=${classId}`)
      .then(d => setStudents(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setStudents([]));
  }, [classId]);

  const ready = classId && termId && subjectId;

  return (
    <div className="page">
      <div className="page-title">Academic Records</div>

      {initErr && <div className="alert alert-error" style={{ marginBottom: 14 }}>{initErr}</div>}

      {/* Shared filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end', background: '#f8f9fa', padding: '14px 16px', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase' }}>Class</div>
          <SearchableSelect
            value={classId}
            onChange={v => { setClassId(v); setStudents([]); }}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
            placeholder="— Select Class —"
            style={{ minWidth: 160 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase' }}>Subject</div>
          <SearchableSelect
            value={subjectId}
            onChange={v => setSubjectId(v)}
            options={subjects.map(s => ({ value: s.id, label: s.name }))}
            placeholder="— Select Subject —"
            style={{ minWidth: 160 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase' }}>Term</div>
          <SearchableSelect
            value={termId}
            onChange={v => setTermId(v)}
            options={terms.map(t => ({ value: t.id, label: t.name + (t.is_current ? ' ✓' : '') }))}
            placeholder="— Select Term —"
            style={{ minWidth: 160 }}
          />
        </div>
        {classId && students.length > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
            {students.length} student{students.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {!ready && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 14 }}>
          Select a class, subject, and term to get started.
        </div>
      )}

      {ready && (
        <>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f3f4f6', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: '9px 22px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                cursor: 'pointer', border: 'none', transition: 'all .15s',
                background: tab === id ? '#fff' : 'transparent',
                color: tab === id ? '#1e293b' : '#6b7280',
                boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
              }}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'scores' && <ScoresTab classId={classId} subjectId={subjectId} termId={termId} students={students} />}
          {tab === 'grades' && <GradesTab classId={classId} subjectId={subjectId} termId={termId} />}
          {tab === 'report' && <ReportTab classId={classId} termId={termId} classes={classes} terms={terms} students={students} />}
        </>
      )}
    </div>
  );
}
