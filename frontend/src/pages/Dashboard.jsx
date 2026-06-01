import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import DebtorsTable from '../components/DebtorsTable';
import AlertPanel from '../components/AlertPanel';
import QuickActions from '../components/QuickActions';
import AttentionList from '../components/AttentionList';
import OwnerDashboard from './OwnerDashboard';
import { hasPrivilege, PRIVILEGES } from '../utils/access';
import { fmtCurrency } from '../utils/format';

const sectionCard = { background: '#fff', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 0 };
const sectionTitle = { fontSize: 15, fontWeight: 600, marginBottom: 14 };

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [attention, setAttention] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const isFinance = hasPrivilege(user, PRIVILEGES.FINANCE_READ);

  useEffect(() => {
    document.title = 'Dashboard — SchoolSaaS';
    async function load() {
      setLoadError('');
      try {
        const [studentsRes, paymentsRes, remediationRes, diagnosisRes, debtorsRes] = await Promise.all([
          api.get('/students').catch(() => []),
          isFinance ? api.get('/payments').catch(() => []) : Promise.resolve([]),
          api.get('/remediation').catch(() => []),
          api.get('/diagnosis').catch(() => []),
          isFinance ? api.get('/payments/debtors').catch(() => []) : Promise.resolve([])
        ]);

        const totalStudents = Array.isArray(studentsRes) ? studentsRes.length : 0;
        const totalCollected = Array.isArray(paymentsRes)
          ? paymentsRes.reduce((s, p) => s + parseFloat(p.amount || 0), 0) : 0;

        setStats({ totalStudents, totalCollected });
        if (Array.isArray(debtorsRes)) setDebtors(debtorsRes);

        // Remediation flags → alerts
        const pending = Array.isArray(remediationRes)
          ? remediationRes.filter(r => r.status === 'pending' || r.status === 'in_progress')
          : [];
        setAlerts(pending.slice(0, 8).map(r => ({
          type: r.status === 'in_progress' ? 'warning' : 'danger',
          title: `${r.student_name || 'Student'} needs remediation`,
          message: `${r.competency_name || '—'} — ${r.reason || ''}`
        })));

        // Low diagnostic results → attention list
        const low = Array.isArray(diagnosisRes)
          ? diagnosisRes.filter(d => d.level === 'low')
          : [];
        setAttention(low.slice(0, 6).map(d => ({
          student_id: d.student_id,
          student_name: d.student_name,
          competency_name: d.competency_name,
          level: 'low'
        })));
      } catch (e) {
        setLoadError('Some dashboard data could not be loaded. Please refresh.');
        console.error('Dashboard load error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const OWNER_DASHBOARD_ROLES = new Set(['owner', 'headmaster_admin', 'headmaster_academics']);
  if (OWNER_DASHBOARD_ROLES.has(user?.role)) return <OwnerDashboard />;

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 60, color: '#888' }}>Loading dashboard…</div>
  );

  return (
    <div className="page">
      {loadError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{loadError}</div>}
      <div className="page-title">Welcome, {user.name}</div>

      {/* Stat Cards */}
      <div className="cards-row">
        <StatCard title="Total Students"  value={stats?.totalStudents ?? '—'}  color="#1a73e8" icon="👥" />
        {isFinance && <StatCard title="Fees Collected" value={stats ? fmtCurrency(stats.totalCollected) : '—'} color="#27ae60" icon="💰" />}
        <StatCard title="Pending Alerts"  value={alerts.length}  color="#e74c3c" icon="⚠️" />
        <StatCard title="Low Performers"  value={attention.length} color="#e67e22" icon="📉" sub="Needs attention" />
      </div>

      {/* Quick Actions */}
      <div style={{ ...sectionCard, marginBottom: 20 }}>
        <div style={sectionTitle}>Quick Actions</div>
        <QuickActions />
      </div>

      {/* Two-column grid: Alerts + Attention */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, marginBottom: 20 }}>
        <div style={sectionCard}>
          <div style={sectionTitle}>Alerts</div>
          <AlertPanel alerts={alerts} />
        </div>
        <div style={sectionCard}>
          <div style={sectionTitle}>Students Needing Attention</div>
          <AttentionList items={attention} />
        </div>
      </div>

      {/* Debtors — only visible to finance roles */}
      {isFinance && (
        <div style={sectionCard}>
          <div style={sectionTitle}>Outstanding Debtors</div>
          <DebtorsTable debtors={debtors} />
        </div>
      )}
    </div>
  );
}
