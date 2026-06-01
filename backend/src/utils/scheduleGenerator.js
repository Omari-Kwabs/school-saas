// Generates a payment installment schedule from a plan type and date range.
// Returns an array of { installment_num, due_date (YYYY-MM-DD), amount_due }.
// The sum of all amount_due values is guaranteed to equal total_amount exactly.

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}

// Truncate to 2 decimal places (floor, not round) to avoid exceeding total.
function trunc2(n) {
  return Math.floor(n * 100) / 100;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Distribute total into `count` instalments, each `base` amount,
// with any rounding remainder added to the last one.
function buildInstallments(total, count, startDate, dateFn) {
  const base = trunc2(total / count);
  const remainder = round2(total - base * count);
  const items = [];
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? round2(base + remainder) : base;
    items.push({
      installment_num: i + 1,
      due_date: toDateStr(dateFn(startDate, i)),
      amount_due: amount
    });
  }
  return items;
}

function generateSchedule(plan_type, total_amount, start_date, end_date) {
  const total = round2(parseFloat(total_amount));
  const start = new Date(start_date);
  const end   = new Date(end_date);

  switch (plan_type) {
    case 'full':
      return [{ installment_num: 1, due_date: toDateStr(start), amount_due: total }];

    case '50_50': {
      const first = trunc2(total * 0.5);
      return [
        { installment_num: 1, due_date: toDateStr(start),              amount_due: first },
        { installment_num: 2, due_date: toDateStr(addDays(start, 30)), amount_due: round2(total - first) }
      ];
    }

    case '60_40': {
      const first = trunc2(total * 0.6);
      return [
        { installment_num: 1, due_date: toDateStr(start),              amount_due: first },
        { installment_num: 2, due_date: toDateStr(addDays(start, 30)), amount_due: round2(total - first) }
      ];
    }

    case 'daily': {
      const days = Math.round((end - start) / 86400000) + 1;
      return buildInstallments(total, Math.max(1, days), start, (d, i) => addDays(d, i));
    }

    case 'weekly': {
      const days  = Math.round((end - start) / 86400000);
      const weeks = Math.max(1, Math.ceil(days / 7));
      return buildInstallments(total, weeks, start, (d, i) => addDays(d, i * 7));
    }

    case 'monthly': {
      const months = Math.max(
        1,
        (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (end.getUTCMonth()    - start.getUTCMonth()) + 1
      );
      return buildInstallments(total, months, start, (d, i) => addMonths(d, i));
    }

    default:
      throw new Error(`Unknown plan_type: ${plan_type}`);
  }
}

module.exports = { generateSchedule };
