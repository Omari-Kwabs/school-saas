import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../utils/format';

const PRINT_STYLES = `
@media print {
  /* Hide everything that isn't the student record */
  nav, aside, header, .navbar, .sidebar, .app-sidebar,
  .no-print, button, form { display: none !important; }

  /* Remove page chrome */
  body { background: #fff !important; margin: 0; padding: 0; font-size: 11pt; }
  .page { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }

  /* Force all cards to show without shadow/border styling */
  .print-card {
    border: 1px solid #ccc !important;
    box-shadow: none !important;
    break-inside: avoid;
    margin-bottom: 12pt;
  }

  /* Section that is ONLY visible when printing */
  .print-only { display: block !important; }

  /* Ensure history table prints fully */
  .history-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .history-table th, .history-table td {
    border: 1px solid #bbb; padding: 5pt 8pt; text-align: left; vertical-align: top;
  }
  .history-table th { background: #f0f0f0; font-weight: 700; }

  @page { margin: 15mm 20mm; }
}

/* Only show print-only sections when printing */
.print-only { display: none; }
`;

function pct(score, max) {
  return max > 0 ? ((score / max) * 100).toFixed(1) : null;
}
function classify(p) {
  if (p >= 75) return { label: 'Strong',  color: '#1a7340', bg: '#d4edda' };
  if (p >= 50) return { label: 'Average', color: '#7d4e00', bg: '#fff3cd' };
  return         { label: 'Weak',    color: '#721c24', bg: '#f8d7da' };
}

const STATUS_COLORS = { pending: '#e67e22', in_progress: '#1a73e8', resolved: '#27ae60' };
const STATUS_BG     = { pending: '#fff3cd', in_progress: '#e8f0fe', resolved: '#d4edda' };

function InfoRow({ label, value, wide }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8895a8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1a2336' }}>{value}</div>
    </div>
  );
}

function SectionHeader({ label, action }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '2px solid #e0e7f0', paddingBottom: 8, marginBottom: 16
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a6882' }}>
        {label}
      </div>
      {action}
    </div>
  );
}

function ChartSection({ children, style }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #dde3ef', borderRadius: 8,
      padding: '16px 20px', marginBottom: 16, ...style
    }}>
      {children}
    </div>
  );
}

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [student, setStudent]           = useState(null);
  const [results, setResults]           = useState([]);
  const [diagnosis, setDiagnosis]       = useState([]);
  const [feedback, setFeedback]         = useState([]);
  const [remediation, setRemediation]   = useState([]);
  const [assessments, setAssessments]   = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading]           = useState(true);

  const [history, setHistory]           = useState([]);

  const [showFbForm, setShowFbForm]     = useState(false);
  const [showRemForm, setShowRemForm]   = useState(false);
  const [showDiagForm, setShowDiagForm] = useState(false);

  const [fbForm, setFbForm]   = useState({ assessment_id: '', competency_id: '', comment: '', action_required: '' });
  const [fbSaving, setFbSaving] = useState(false);
  const [fbError, setFbError]   = useState('');

  const [remForm, setRemForm]   = useState({ competency_id: '', reason: '' });
  const [remSaving, setRemSaving] = useState(false);
  const [remError, setRemError]   = useState('');

  const [diagForm, setDiagForm]   = useState({ assessment_id: '', competency_id: '', level: 'medium' });
  const [diagSaving, setDiagSaving] = useState(false);
  const [diagError, setDiagError]   = useState('');

  const canEdit = ['owner','teacher','headmaster_academics','department_head','class_teacher'].includes(user?.role);

  async function load() {
    try {
      const [st, res, diag, fb, rem, assmt, comp, hist] = await Promise.all([
        api.get(`/students/${id}`),
        api.get(`/results?student_id=${id}`),
        api.get(`/diagnosis?student_id=${id}`),
        api.get(`/feedback?student_id=${id}`),
        api.get(`/remediation?student_id=${id}`),
        api.get('/assessments').catch(() => []),
        api.get('/competencies').catch(() => []),
        api.get(`/students/${id}/history`).catch(() => []),
      ]);
      setStudent(st);
      setResults(Array.isArray(res) ? res : []);
      setDiagnosis(Array.isArray(diag) ? diag : []);
      setFeedback(Array.isArray(fb) ? fb : []);
      setRemediation(Array.isArray(rem) ? rem : []);
      setAssessments(Array.isArray(assmt) ? assmt : []);
      setCompetencies(Array.isArray(comp) ? comp : []);
      setHistory(Array.isArray(hist) ? hist : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function submitFeedback(e) {
    e.preventDefault();
    setFbSaving(true); setFbError('');
    try {
      await api.post('/feedback', {
        student_id:      id,
        assessment_id:   fbForm.assessment_id   || undefined,
        competency_id:   fbForm.competency_id   || undefined,
        comment:         fbForm.comment         || undefined,
        action_required: fbForm.action_required || undefined,
      });
      setFbForm({ assessment_id: '', competency_id: '', comment: '', action_required: '' });
      setShowFbForm(false);
      const fb = await api.get(`/feedback?student_id=${id}`);
      setFeedback(Array.isArray(fb) ? fb : []);
    } catch (err) { setFbError(err.message); }
    finally { setFbSaving(false); }
  }

  async function deleteFeedback(fbId) {
    if (!confirm('Delete this note?')) return;
    try { await api.delete(`/feedback/${fbId}`); setFeedback(prev => prev.filter(f => f.id !== fbId)); } catch {}
  }

  async function submitRemediation(e) {
    e.preventDefault();
    setRemSaving(true); setRemError('');
    try {
      await api.post('/remediation', {
        student_id:    id,
        competency_id: remForm.competency_id || undefined,
        reason:        remForm.reason        || undefined,
      });
      setRemForm({ competency_id: '', reason: '' });
      setShowRemForm(false);
      const rem = await api.get(`/remediation?student_id=${id}`);
      setRemediation(Array.isArray(rem) ? rem : []);
    } catch (err) { setRemError(err.message); }
    finally { setRemSaving(false); }
  }

  async function updateRemStatus(remId, status) {
    try {
      await api.put(`/remediation/${remId}/status`, { status });
      setRemediation(prev => prev.map(r => r.id === remId ? { ...r, status } : r));
    } catch {}
  }

  async function submitDiagnosis(e) {
    e.preventDefault();
    setDiagSaving(true); setDiagError('');
    try {
      await api.post('/diagnosis', {
        student_id:    id,
        assessment_id: diagForm.assessment_id,
        competency_id: diagForm.competency_id,
        level:         diagForm.level,
      });
      setDiagForm({ assessment_id: '', competency_id: '', level: 'medium' });
      setShowDiagForm(false);
      const diag = await api.get(`/diagnosis?student_id=${id}`);
      setDiagnosis(Array.isArray(diag) ? diag : []);
    } catch (err) { setDiagError(err.message); }
    finally { setDiagSaving(false); }
  }

  if (loading) return <div className="page" style={{ textAlign: 'center', paddingTop: 60, color: '#888' }}>Loading…</div>;
  if (!student) return <div className="page" style={{ textAlign: 'center', paddingTop: 60, color: '#888' }}>Student not found.</div>;

  const weakCount  = diagnosis.filter(d => d.level === 'low').length;
  const pendingRem = remediation.filter(r => r.status !== 'resolved').length;
  const overallRisk = weakCount >= 3 || pendingRem >= 3 ? 'High' : weakCount >= 1 || pendingRem >= 1 ? 'Moderate' : 'Low';
  const riskColor = overallRisk === 'High' ? '#721c24' : overallRisk === 'Moderate' ? '#7d4e00' : '#1a7340';
  const riskBg    = overallRisk === 'High' ? '#f8d7da' : overallRisk === 'Moderate' ? '#fff3cd' : '#d4edda';

  const OUTCOME_META = {
    promoted:    { label: 'Promoted',    color: '#1a7340', bg: '#d4edda' },
    repeated:    { label: 'Repeated',    color: '#721c24', bg: '#f8d7da' },
    graduated:   { label: 'Graduated',   color: '#1a73e8', bg: '#e8f0fe' },
    transferred: { label: 'Transferred', color: '#7d4e00', bg: '#fff3cd' },
  };

  return (
    <div className="page" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Inject print styles once */}
      <style>{PRINT_STYLES}</style>

      {/* Screen-only top bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} className="btn btn-secondary btn-sm">← Back</button>
        <button
          className="btn btn-sm"
          style={{ background: '#1e2a3a', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          onClick={() => window.print()}
        >
          Print Record
        </button>
      </div>

      {/* ── Print-only letterhead — hidden on screen ──────────────────── */}
      <div className="print-only" style={{ borderBottom: '2px solid #1e2a3a', paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#1e2a3a' }}>{user?.school_name}</div>
        <div style={{ fontSize: 13, color: '#5a6882', marginTop: 2 }}>Student Academic Record</div>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
          <div><strong>Name:</strong> {student?.name}</div>
          <div><strong>Student Code:</strong> {student?.student_code || '—'}</div>
          <div><strong>Class:</strong> {student?.class_name || '—'}</div>
          <div><strong>Date of Birth:</strong> {fmtDate(student?.dob)}</div>
          <div><strong>Gender:</strong> {student?.gender || '—'}</div>
          <div><strong>Blood Group:</strong> {student?.blood_group || '—'}</div>
          <div><strong>Nationality:</strong> {student?.nationality || '—'}</div>
          <div><strong>Status:</strong> {student?.status}</div>
          <div><strong>Admission Date:</strong> {student?.admission_date ? fmtDate(student.admission_date) : '—'}</div>
          {student?.address && <div style={{ gridColumn: 'span 3' }}><strong>Home Address:</strong> {student.address}</div>}
          {student?.parent_name && <div><strong>Guardian 1:</strong> {student.parent_name}{student.parent_phone ? ` · ${student.parent_phone}` : ''}</div>}
          {student?.parent2_name && <div><strong>Guardian 2:</strong> {student.parent2_name}{student.parent2_phone ? ` · ${student.parent2_phone}` : ''}</div>}
          {student?.emergency_contact_name && (
            <div style={{ gridColumn: 'span 3', background: '#fef2f2', padding: '4pt 8pt', borderRadius: 3 }}>
              <strong>Emergency Contact:</strong> {student.emergency_contact_name}
              {student.emergency_contact_phone ? ` · ${student.emergency_contact_phone}` : ''}
              {student.emergency_contact_relation ? ` (${student.emergency_contact_relation})` : ''}
            </div>
          )}
          {student?.allergies && <div style={{ gridColumn: 'span 3' }}><strong>Allergies:</strong> {student.allergies}</div>}
          {student?.medical_conditions && <div style={{ gridColumn: 'span 3' }}><strong>Medical Conditions:</strong> {student.medical_conditions}</div>}
          <div><strong>Printed:</strong> {new Date().toLocaleString('en-GH')}</div>
        </div>
      </div>

      {/* ── Student Profile Header ────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #dde3ef', borderRadius: 10,
        overflow: 'hidden', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.07)'
      }}>
        {/* Profile banner */}
        <div style={{
          background: '#1e2a3a', padding: '10px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ color: '#7a9cbf', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Student Record
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: '#a0b4c8', fontSize: 12 }}>Student No.</span>
            <span style={{
              color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
              background: '#2c3e50', padding: '2px 10px', borderRadius: 4
            }}>
              {student.student_code || `#${id}`}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 12,
              background: student.status === 'active' ? '#27ae60' : '#e74c3c',
              color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase'
            }}>
              {student.status || 'Active'}
            </span>
          </div>
        </div>

        {/* Student details */}
        <div style={{ padding: '20px 24px', display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e2a3a, #2c4a6e)',
            color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 24, fontWeight: 800, flexShrink: 0,
            border: '3px solid #dde3ef'
          }}>
            {student.name?.[0]?.toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a2336', letterSpacing: '-0.01em' }}>
              {student.name}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#5a6882' }}>
                <span style={{ fontWeight: 700, color: '#374151' }}>Class:</span> {student.class_name || '—'}
              </span>
              {student.gender && (
                <span style={{ fontSize: 12, color: '#5a6882' }}>
                  <span style={{ fontWeight: 700, color: '#374151' }}>Gender:</span> {student.gender}
                </span>
              )}
              {student.parent_name && (
                <span style={{ fontSize: 12, color: '#5a6882' }}>
                  <span style={{ fontWeight: 700, color: '#374151' }}>Guardian:</span> {student.parent_name}
                  {student.parent_phone ? ` · ${student.parent_phone}` : ''}
                </span>
              )}
            </div>
          </div>

          {/* Attention level indicator */}
          <div style={{
            textAlign: 'center', padding: '12px 20px',
            background: riskBg, borderRadius: 8,
            border: `1px solid ${riskColor}44`, flexShrink: 0
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: riskColor, marginBottom: 4 }}>
              Attention Level
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: riskColor }}>{overallRisk}</div>
          </div>
        </div>

        {/* Quick stats bar */}
        <div style={{
          borderTop: '1px solid #edf0f7', background: '#f8fafd',
          display: 'flex', padding: '10px 24px'
        }}>
          {[
            { label: 'Assessments',    value: results.length },
            { label: 'Skill Profiles', value: diagnosis.length },
            { label: 'Notes',          value: feedback.length },
            { label: 'Active Plans',   value: remediation.filter(r => r.status !== 'resolved').length },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              borderRight: i < 3 ? '1px solid #e0e7f0' : 'none',
              padding: '4px 0'
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1a2336' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#8895a8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Biodata & Emergency Information ──────────────────────────── */}
      <ChartSection style={{ border: '1px solid #fca5a5' }}>
        <SectionHeader label="Biodata & Emergency Information" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '12px 24px' }}>

          {/* Personal */}
          {student.nationality && <InfoRow label="Nationality" value={student.nationality} />}
          {student.religion    && <InfoRow label="Religion"    value={student.religion} />}
          {student.dob         && <InfoRow label="Date of Birth" value={new Date(student.dob + 'T00:00:00').toLocaleDateString('en-GH', { day:'numeric', month:'long', year:'numeric' })} />}
          {student.admission_date && <InfoRow label="Admission Date" value={new Date(student.admission_date + 'T00:00:00').toLocaleDateString('en-GH', { day:'numeric', month:'long', year:'numeric' })} />}
          {student.address && <InfoRow label="Home Address" value={student.address} wide />}

          {/* Parents */}
          {student.parent_name && (
            <InfoRow label="Parent / Guardian 1"
              value={`${student.parent_name}${student.parent_phone ? ' · ' + student.parent_phone : ''}${student.parent_email ? ' · ' + student.parent_email : ''}`} wide />
          )}
          {student.parent2_name && (
            <InfoRow label="Parent / Guardian 2"
              value={`${student.parent2_name}${student.parent2_phone ? ' · ' + student.parent2_phone : ''}`} wide />
          )}

          {/* Emergency Contact — highlighted */}
          {student.emergency_contact_name && (
            <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626', marginBottom: 6 }}>
                Emergency Contact
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                <span><strong>Name:</strong> {student.emergency_contact_name}</span>
                {student.emergency_contact_phone && <span><strong>Phone:</strong> <a href={`tel:${student.emergency_contact_phone}`} style={{ color: '#dc2626', fontWeight: 700 }}>{student.emergency_contact_phone}</a></span>}
                {student.emergency_contact_relation && <span><strong>Relationship:</strong> {student.emergency_contact_relation}</span>}
              </div>
            </div>
          )}

          {/* Medical */}
          {student.blood_group && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#92400e' }}>{student.blood_group}</span>
              <span style={{ fontSize: 11, color: '#78350f', fontWeight: 600 }}>Blood Group</span>
            </div>
          )}
          {student.allergies && (
            <div style={{ gridColumn: student.blood_group ? undefined : '1 / -1', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#c2410c', marginBottom: 4 }}>Allergies</div>
              <div style={{ fontSize: 13, color: '#431407' }}>{student.allergies}</div>
            </div>
          )}
          {student.medical_conditions && (
            <div style={{ gridColumn: '1 / -1', background: '#fef9ee', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#b45309', marginBottom: 4 }}>Medical Conditions</div>
              <div style={{ fontSize: 13, color: '#78350f' }}>{student.medical_conditions}</div>
            </div>
          )}

          {!student.emergency_contact_name && !student.blood_group && !student.allergies && !student.medical_conditions && (
            <p style={{ color: '#aaa', fontSize: 13, gridColumn: '1 / -1' }}>No emergency or medical information recorded. Edit the student to add it.</p>
          )}
        </div>
      </ChartSection>

      {/* ── Assessment Performance ────────────────────────────────────── */}
      <ChartSection>
        <SectionHeader label="Assessment Performance" />
        {results.length === 0
          ? <p style={{ color: '#aaa', fontSize: 13 }}>No results recorded.</p>
          : results.slice(0, 10).map(r => {
              const p   = pct(r.total_score, r.max_score);
              const cls = p != null ? classify(parseFloat(p)) : null;
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #f0f3f8'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2336' }}>{r.assessment_title}</div>
                    <div style={{ fontSize: 11, color: '#8895a8', marginTop: 2 }}>{r.subject_name}</div>
                  </div>
                  <div style={{ width: 160, background: '#eef0f5', borderRadius: 20, height: 8, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${p || 0}%`, background: cls?.color || '#ccc', height: '100%', borderRadius: 20 }} />
                  </div>
                  <div style={{ width: 52, textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: cls?.color || '#aaa' }}>
                      {p != null ? `${p}%` : '—'}
                    </span>
                  </div>
                  {cls && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: cls.bg, color: cls.color, textTransform: 'uppercase',
                      letterSpacing: '0.04em', flexShrink: 0
                    }}>
                      {cls.label}
                    </span>
                  )}
                </div>
              );
            })
        }
      </ChartSection>

      {/* ── Competency Profile ───────────────────────────────────────── */}
      <ChartSection>
        <SectionHeader
          label="Competency Profile"
          action={canEdit && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowDiagForm(v => !v)}>
              {showDiagForm ? 'Cancel' : '+ Add Entry'}
            </button>
          )}
        />

        {showDiagForm && (
          <form onSubmit={submitDiagnosis} style={{ background: '#f8fafd', border: '1px solid #dde3ef', borderRadius: 6, padding: 14, marginBottom: 14 }}>
            {diagError && <div className="alert alert-error" style={{ marginBottom: 8 }}>{diagError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group">
                <label>Assessment *</label>
                <select value={diagForm.assessment_id} onChange={e => setDiagForm(f => ({ ...f, assessment_id: e.target.value }))} required>
                  <option value="">— Select —</option>
                  {assessments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Competency *</label>
                <select value={diagForm.competency_id} onChange={e => setDiagForm(f => ({ ...f, competency_id: e.target.value }))} required>
                  <option value="">— Select —</option>
                  {competencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Level</label>
                <select value={diagForm.level} onChange={e => setDiagForm(f => ({ ...f, level: e.target.value }))}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" type="submit" disabled={diagSaving}>
              {diagSaving ? 'Saving…' : 'Save Entry'}
            </button>
          </form>
        )}

        {diagnosis.length === 0
          ? <p style={{ color: '#aaa', fontSize: 13 }}>No competency entries recorded.</p>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {diagnosis.map(d => {
                const color = d.level === 'high' ? '#1a7340' : d.level === 'medium' ? '#7d4e00' : '#721c24';
                const bg    = d.level === 'high' ? '#d4edda' : d.level === 'medium' ? '#fff3cd' : '#f8d7da';
                const dot   = d.level === 'high' ? '●' : d.level === 'medium' ? '◐' : '○';
                return (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 14px', background: '#f8fafd',
                    border: '1px solid #edf0f7', borderLeft: `4px solid ${color}`,
                    borderRadius: 6
                  }}>
                    <span style={{ fontSize: 14, color }}>{dot}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1a2336' }}>{d.competency_name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                      background: bg, color, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {d.level}
                    </span>
                    {d.assessment_title && (
                      <span style={{ fontSize: 11, color: '#8895a8' }}>{d.assessment_title}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </ChartSection>

      {/* ── Teacher Notes ─────────────────────────────────────────────── */}
      <ChartSection>
        <SectionHeader
          label="Teacher Notes"
          action={canEdit && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowFbForm(v => !v)}>
              {showFbForm ? 'Cancel' : '+ Add Note'}
            </button>
          )}
        />

        {showFbForm && (
          <form onSubmit={submitFeedback} style={{ background: '#f8fafd', border: '1px solid #dde3ef', borderRadius: 6, padding: 14, marginBottom: 14 }}>
            {fbError && <div className="alert alert-error" style={{ marginBottom: 8 }}>{fbError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group">
                <label>Assessment (optional)</label>
                <select value={fbForm.assessment_id} onChange={e => setFbForm(f => ({ ...f, assessment_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {assessments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Competency (optional)</label>
                <select value={fbForm.competency_id} onChange={e => setFbForm(f => ({ ...f, competency_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {competencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Note</label>
              <textarea rows={3} value={fbForm.comment} onChange={e => setFbForm(f => ({ ...f, comment: e.target.value }))}
                style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 13, resize: 'vertical' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Action Required</label>
              <input value={fbForm.action_required} onChange={e => setFbForm(f => ({ ...f, action_required: e.target.value }))}
                placeholder="e.g. extra practice on fractions" />
            </div>
            <button className="btn btn-primary btn-sm" type="submit" disabled={fbSaving}>
              {fbSaving ? 'Saving…' : 'Save Note'}
            </button>
          </form>
        )}

        {feedback.length === 0
          ? <p style={{ color: '#aaa', fontSize: 13 }}>No notes recorded.</p>
          : feedback.slice(0, 8).map(f => (
              <div key={f.id} style={{
                display: 'flex', gap: 16, marginBottom: 14,
                paddingBottom: 14, borderBottom: '1px solid #f0f3f8'
              }}>
                {/* Timeline indicator */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1a73e8', marginTop: 4 }} />
                  <div style={{ width: 1, flex: 1, background: '#dde3ef', marginTop: 4 }} />
                </div>
                {/* Note body */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontSize: 11, color: '#5a6882', fontWeight: 700 }}>
                      {f.recorder_name || 'Teacher'} · {new Date(f.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {f.assessment_title && <span style={{ color: '#8895a8', fontWeight: 400 }}> · {f.assessment_title}</span>}
                    </div>
                    {canEdit && (
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontSize: 11, padding: '0 4px' }}
                        onClick={() => deleteFeedback(f.id)}>✕</button>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#1a2336', margin: '4px 0', lineHeight: 1.6 }}>
                    {f.comment || f.comments || '—'}
                  </p>
                  {f.action_required && (
                    <div style={{ marginTop: 6, padding: '4px 10px', background: '#fff3cd', borderRadius: 4, fontSize: 12, color: '#7d4e00', fontWeight: 600 }}>
                      Action Required: {f.action_required}
                    </div>
                  )}
                </div>
              </div>
            ))
        }
      </ChartSection>

      {/* ── Academic Progression ─────────────────────────────────────── */}
      <ChartSection>
        <SectionHeader label="Academic Progression" />
        {history.length === 0 ? (
          <p style={{ color: '#aaa', fontSize: 13 }}>No promotion or outcome records yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} className="history-table">
              <thead>
                <tr style={{ background: '#f4f6fb' }}>
                  {['Term', 'Period', 'From Class', 'To Class', 'Outcome', 'Recorded By', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #dde3ef' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => {
                  const meta = OUTCOME_META[row.outcome] || { label: row.outcome, color: '#5a6882', bg: '#f0f3f8' };
                  return (
                    <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafd' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a2336', borderBottom: '1px solid #edf0f7' }}>{row.term_name}</td>
                      <td style={{ padding: '8px 12px', color: '#5a6882', fontSize: 12, borderBottom: '1px solid #edf0f7', whiteSpace: 'nowrap' }}>
                        {fmtDate(row.start_date)} – {fmtDate(row.end_date)}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#374151', borderBottom: '1px solid #edf0f7' }}>{row.from_class || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#374151', borderBottom: '1px solid #edf0f7' }}>{row.to_class || '—'}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid #edf0f7' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                          background: meta.bg, color: meta.color,
                          textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#5a6882', fontSize: 12, borderBottom: '1px solid #edf0f7' }}>{row.recorded_by || '—'}</td>
                      <td style={{ padding: '8px 12px', color: '#5a6882', fontSize: 12, borderBottom: '1px solid #edf0f7' }}>{row.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {student.repeat_count > 0 && (
          <div style={{ marginTop: 12, padding: '6px 12px', background: '#f8d7da', borderRadius: 6, display: 'inline-block' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#721c24' }}>
              Repeated {student.repeat_count} {student.repeat_count === 1 ? 'time' : 'times'}
            </span>
          </div>
        )}
      </ChartSection>

      {/* ── Support Plans ─────────────────────────────────────────────── */}
      <ChartSection>
        <SectionHeader
          label="Support Plans"
          action={canEdit && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowRemForm(v => !v)}>
              {showRemForm ? 'Cancel' : '+ Add Plan'}
            </button>
          )}
        />

        {showRemForm && (
          <form onSubmit={submitRemediation} style={{ background: '#f8fafd', border: '1px solid #dde3ef', borderRadius: 6, padding: 14, marginBottom: 14 }}>
            {remError && <div className="alert alert-error" style={{ marginBottom: 8 }}>{remError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group">
                <label>Competency (optional)</label>
                <select value={remForm.competency_id} onChange={e => setRemForm(f => ({ ...f, competency_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {competencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <input value={remForm.reason} onChange={e => setRemForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. consistent low scores in fractions" />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" type="submit" disabled={remSaving}>
              {remSaving ? 'Saving…' : 'Save Plan'}
            </button>
          </form>
        )}

        {remediation.length === 0
          ? <p style={{ color: '#aaa', fontSize: 13 }}>No active support plans.</p>
          : remediation.map(r => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                padding: '12px 16px', borderRadius: 8, marginBottom: 8, gap: 12,
                background: STATUS_BG[r.status] || '#f8fafd',
                border: `1px solid ${STATUS_COLORS[r.status] || '#dde3ef'}44`,
                borderLeft: `4px solid ${STATUS_COLORS[r.status] || '#dde3ef'}`
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1a2336' }}>
                    {r.competency_name || 'General Support'}
                  </div>
                  {r.reason && <div style={{ fontSize: 12, color: '#5a6882', marginTop: 3 }}>{r.reason}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                    background: STATUS_COLORS[r.status] + '22', color: STATUS_COLORS[r.status],
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    border: `1px solid ${STATUS_COLORS[r.status]}44`
                  }}>
                    {r.status.replace('_', ' ')}
                  </span>
                  {canEdit && r.status !== 'resolved' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {r.status === 'pending' && (
                        <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 8px', color: '#1a73e8', border: '1px solid #1a73e8', background: 'none' }}
                          onClick={() => updateRemStatus(r.id, 'in_progress')}>Start</button>
                      )}
                      <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 8px', color: '#27ae60', border: '1px solid #27ae60', background: 'none' }}
                        onClick={() => updateRemStatus(r.id, 'resolved')}>Resolve</button>
                    </div>
                  )}
                </div>
              </div>
            ))
        }
      </ChartSection>
    </div>
  );
}
