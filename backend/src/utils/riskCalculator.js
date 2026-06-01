// Utility functions for risk calculation

function calculateAttendanceRate(attendanceRecords) {
  const totalDays = attendanceRecords.reduce((sum, a) => sum + parseInt(a.count), 0);
  const presentDays = parseInt(attendanceRecords.find(a => a.status === 'present')?.count || 0, 10) +
                     parseInt(attendanceRecords.find(a => a.status === 'late')?.count || 0, 10);
  return totalDays > 0 ? (presentDays / totalDays) * 100 : 100;
}

function detectDecliningPerformance(subjectTrends) {
  let decliningCount = 0;
  Object.values(subjectTrends).forEach(sub => {
    if (sub.scores.length >= 2) {
      const first = parseFloat(sub.scores[0]) || 0;
      const last = parseFloat(sub.scores[sub.scores.length - 1]) || 0;
      if (last <= first - 5) {
        decliningCount++;
      }
    }
  });
  return decliningCount;
}

function countWeakCompetencies(diagnostics) {
  return diagnostics.filter(d => d.level === 'low' || d.level === 'weak').length;
}

function countPendingRemediation(remediationRecords) {
  return parseInt(remediationRecords.find(r => r.status === 'pending')?.count || 0, 10);
}

function calculateRiskLevel(decliningSubjects, attendanceRate, weakCompetencies, pendingRemediation) {
  let riskScore = 0;
  const reasons = [];
  const actions = [];

  if (decliningSubjects >= 2) {
    riskScore++;
    reasons.push(`Performance declining in ${decliningSubjects} subjects`);
    actions.push('Schedule extra tutoring sessions');
  }

  if (attendanceRate < 85) {
    riskScore++;
    reasons.push(`Attendance below 85% (${attendanceRate.toFixed(1)}%)`);
    actions.push('Ensure child arrives before 7:30 AM daily');
  }

  if (weakCompetencies > 3) {
    riskScore++;
    reasons.push(`${weakCompetencies} weak competencies identified`);
    actions.push('Practice targeted skills 20 mins daily');
  }

  if (pendingRemediation > 0) {
    riskScore++;
    reasons.push(`${pendingRemediation} unresolved remediation flags`);
    actions.push('Complete pending interventions');
  }

  let risk_level = 'low';
  if (riskScore >= 4) risk_level = 'high';
  else if (riskScore >= 2) risk_level = 'medium';

  return { risk_level, reasons, actions };
}

module.exports = {
  calculateAttendanceRate,
  detectDecliningPerformance,
  countWeakCompetencies,
  countPendingRemediation,
  calculateRiskLevel
};