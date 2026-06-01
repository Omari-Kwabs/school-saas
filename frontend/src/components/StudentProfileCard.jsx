import React from 'react';

function RiskBar({ label, value, max = 100, invert = false }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const effectivePct = invert ? 100 - pct : pct;
  const color =
    effectivePct >= 75 ? 'bg-green-500' :
    effectivePct >= 50 ? 'bg-amber-400' :
    'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-gray-600">{label}</span>
        <span className="text-gray-500">{value}{max !== 100 ? `/${max}` : '%'}</span>
      </div>
      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Badge({ label, color = 'gray' }) {
  const COLORS = {
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    amber:  'bg-amber-100 text-amber-700',
    blue:   'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    gray:   'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${COLORS[color] || COLORS.gray}`}>
      {label}
    </span>
  );
}

function CompetencyRow({ name, level }) {
  const STYLE = {
    high:   { bar: 'bg-green-500', width: '100%', label: 'High' },
    medium: { bar: 'bg-amber-400', width: '60%',  label: 'Medium' },
    low:    { bar: 'bg-red-500',   width: '25%',  label: 'Low' },
  };
  const s = STYLE[level] || { bar: 'bg-gray-200', width: '0%', label: 'N/A' };
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{name}</p>
        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
          <div className={`h-full ${s.bar} rounded-full`} style={{ width: s.width }} />
        </div>
      </div>
      <span className="text-[10px] font-semibold text-gray-500 shrink-0 w-12 text-right">{s.label}</span>
    </div>
  );
}

function FeedbackItem({ item }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-1.5 rounded-full bg-indigo-400 shrink-0 self-stretch" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500 mb-1">
          {item.competency_name || item.assessment_title || 'General'}
          {item.action_required && (
            <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Action required</span>
          )}
        </p>
        <p className="text-sm text-gray-800 leading-relaxed">{item.comment}</p>
      </div>
    </div>
  );
}

export default function StudentProfileCard({
  student,
  results = [],
  diagnosis = [],
  feedback = [],
  remediation = [],
  portfolio = [],
  riskLevel,
  attendancePct,
}) {
  if (!student) return null;

  const initials = student.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const weak     = diagnosis.filter(d => d.level === 'low').length;
  const pending  = remediation.filter(r => r.status !== 'resolved').length;

  const risk = riskLevel || (weak >= 3 || attendancePct < 85 ? 'high' : weak >= 1 ? 'medium' : 'low');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-lg shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-bold text-gray-900">{student.name}</h2>
              {student.is_sen && <Badge label="SEN" color="purple" />}
              {student.is_gifted && <Badge label="Gifted" color="blue" />}
              <Badge
                label={`${risk} risk`}
                color={risk === 'high' ? 'red' : risk === 'medium' ? 'amber' : 'green'}
              />
            </div>
            <p className="text-sm text-gray-500">
              {student.class_name && <span className="font-medium text-gray-700">{student.class_name}</span>}
              {student.student_code && <span className="ml-2 text-gray-400">· {student.student_code}</span>}
              {student.status && (
                <span className={`ml-2 text-xs font-semibold ${student.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                  · {student.status}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Risk bars */}
        <div className="mt-4 space-y-3">
          {attendancePct != null && (
            <RiskBar label="Attendance" value={attendancePct} />
          )}
          <RiskBar label="Weak Competencies" value={weak} max={Math.max(diagnosis.length, 1)} invert />
          {pending > 0 && (
            <RiskBar label="Pending Remediation" value={pending} max={Math.max(remediation.length, 1)} invert />
          )}
        </div>
      </div>

      {/* Competency Breakdown */}
      {diagnosis.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Competency Levels</h3>
          <div className="space-y-3">
            {diagnosis.map((d, i) => (
              <CompetencyRow key={i} name={d.competency_name || `Competency ${i + 1}`} level={d.level} />
            ))}
          </div>
        </div>
      )}

      {/* Feedback Timeline */}
      {feedback.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Feedback Timeline</h3>
          <div>
            {feedback.slice(0, 8).map((fb, i) => (
              <FeedbackItem key={i} item={fb} />
            ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Portfolio</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {portfolio.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs font-semibold text-gray-700 truncate">{item.title || `Item ${i + 1}`}</p>
                {item.description && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
