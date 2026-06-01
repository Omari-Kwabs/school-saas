import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Archive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [years, setYears] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [termsByYear, setTermsByYear] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unarchiving, setUnarchiving] = useState(null);

  useEffect(() => { document.title = 'Archive — SchoolSaaS'; }, []);

  const loadYears = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/terms/archived');
      setYears(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load archive.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadYears(); }, [loadYears]);

  async function loadTermsForYear(year) {
    if (termsByYear[year]) return; // already loaded
    try {
      const all = await api.get('/terms?include_archived=true');
      const yearTerms = (Array.isArray(all) ? all : []).filter(t => t.academic_year === year && t.is_archived);
      setTermsByYear(prev => ({ ...prev, [year]: yearTerms }));
    } catch {}
  }

  function toggleYear(year) {
    if (expanded === year) { setExpanded(null); return; }
    setExpanded(year);
    loadTermsForYear(year);
  }

  const canManage = ['owner', 'headmaster_academics', 'headmaster_admin'].includes(user.role);

  async function unarchiveYear(academic_year) {
    if (!confirm(`Restore ${academic_year} to active terms? All its terms will become visible again.`)) return;
    setUnarchiving(academic_year);
    try {
      await api.post('/terms/unarchive-year', { academic_year });
      setTermsByYear(prev => { const n = { ...prev }; delete n[academic_year]; return n; });
      loadYears();
      if (expanded === academic_year) setExpanded(null);
    } catch (err) {
      setError(err.message || 'Failed to restore year.');
    }
    setUnarchiving(null);
  }

  async function unarchiveTerm(termId, year) {
    setUnarchiving(termId);
    try {
      await api.post(`/terms/${termId}/unarchive`);
      setTermsByYear(prev => ({
        ...prev,
        [year]: (prev[year] || []).filter(t => t.id !== termId),
      }));
      // Refresh year list in case the year is now empty
      loadYears();
    } catch (err) {
      setError(err.message || 'Failed to restore term.');
    }
    setUnarchiving(null);
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>Academic Archive</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            Archived years — <a onClick={() => navigate('/terms')} style={{ color: '#3b82f6', cursor: 'pointer' }}>manage active terms</a>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {loading && <p style={{ color: '#888', fontSize: 13 }}>Loading…</p>}

      {!loading && years.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No archived years yet</div>
          <div style={{ fontSize: 13 }}>
            Go to <a onClick={() => navigate('/terms')} style={{ color: '#3b82f6', cursor: 'pointer' }}>Terms</a> to archive previous academic years.
          </div>
        </div>
      )}

      {!loading && years.map(y => {
        const isOpen = expanded === y.academic_year;
        const termList = termsByYear[y.academic_year];

        return (
          <div key={y.academic_year} className="panel" style={{ marginBottom: 12 }}>
            {/* Year header row */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 16px' }}
              onClick={() => toggleYear(y.academic_year)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                  {y.academic_year}
                </span>
                <span style={{
                  background: '#f1f5f9', color: '#64748b',
                  borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 500
                }}>
                  {y.term_count} term{y.term_count !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  {y.from_date ? new Date(y.from_date).toLocaleDateString() : ''} –{' '}
                  {y.to_date   ? new Date(y.to_date).toLocaleDateString()   : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                {canManage && (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => unarchiveYear(y.academic_year)}
                    disabled={unarchiving === y.academic_year}
                    style={{ fontSize: 11 }}
                  >
                    {unarchiving === y.academic_year ? 'Restoring…' : 'Restore year'}
                  </button>
                )}
                <span style={{ color: '#94a3b8', fontSize: 18 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded terms list */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #f1f5f9' }}>
                {!termList && (
                  <div style={{ padding: '12px 16px', color: '#888', fontSize: 13 }}>Loading terms…</div>
                )}
                {termList && termList.length === 0 && (
                  <div style={{ padding: '12px 16px', color: '#888', fontSize: 13 }}>No terms in this year.</div>
                )}
                {termList && termList.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th>Term</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        {canManage && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {termList.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 500 }}>{t.name}</td>
                          <td>{t.start_date ? new Date(t.start_date).toLocaleDateString() : '—'}</td>
                          <td>{t.end_date   ? new Date(t.end_date).toLocaleDateString()   : '—'}</td>
                          {canManage && (
                            <td>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => unarchiveTerm(t.id, y.academic_year)}
                                disabled={unarchiving === t.id}
                                style={{ fontSize: 11 }}
                              >
                                {unarchiving === t.id ? '…' : 'Restore term'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Info box */}
      {years.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#64748b' }}>
          Archived terms are hidden from active dropdowns (attendance, results, fees, reports) but all their data is preserved. Restoring a year makes its terms visible again.
        </div>
      )}
    </div>
  );
}
