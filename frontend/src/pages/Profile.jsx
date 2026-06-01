import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import BrandSettings from '../components/BrandSettings';

export default function Profile() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [nameForm, setNameForm] = useState({ name: '' });
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState('');

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Signature pad state
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos   = useRef(null);
  const [sigSaved, setSigSaved] = useState(false);
  const [sigSaving, setSigSaving] = useState(false);
  const [sigMsg, setSigMsg] = useState('');
  const [existingSig, setExistingSig] = useState(null);
  const [sigMode, setSigMode] = useState('draw'); // 'draw' | 'upload'

  useEffect(() => {
    document.title = 'My Profile — SchoolSaaS';
    api.get('/profile/me').then(d => {
      setProfile(d);
      setNameForm({ name: d.name });
      if (d.signature_data) setExistingSig(d.signature_data);
    }).catch(() => {});
  }, []);

  // Canvas drawing helpers
  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  function startDraw(e) {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvasRef.current);
  }
  function draw(e) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setSigSaved(false);
  }
  function stopDraw() { isDrawing.current = false; }
  function clearCanvas() {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setSigSaved(false);
  }
  function isCanvasBlank() {
    if (!canvasRef.current) return true;
    const ctx = canvasRef.current.getContext('2d');
    const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height).data;
    return !data.some(v => v !== 0);
  }
  async function saveSignature() {
    if (sigMode === 'draw' && isCanvasBlank()) {
      setSigMsg('error:Please draw your signature first.');
      return;
    }
    setSigSaving(true); setSigMsg('');
    try {
      const sig = sigMode === 'draw' ? canvasRef.current.toDataURL('image/png') : existingSig;
      await api.put('/profile/me/signature', { signature_data: sig });
      setExistingSig(sig);
      setSigSaved(true);
      setSigMsg('Signature saved successfully.');
      setTimeout(() => setSigMsg(''), 3000);
    } catch { setSigMsg('error:Failed to save signature.'); }
    finally { setSigSaving(false); }
  }
  async function removeSignature() {
    if (!confirm('Remove your digital signature?')) return;
    await api.put('/profile/me/signature', { signature_data: null });
    setExistingSig(null);
    clearCanvas();
    setSigMsg('Signature removed.');
    setTimeout(() => setSigMsg(''), 3000);
  }
  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setExistingSig(ev.target.result); setSigSaved(false); };
    reader.readAsDataURL(file);
  }

  async function saveName(e) {
    e.preventDefault(); setNameSaving(true); setNameMsg('');
    try {
      await api.put('/profile/me', { name: nameForm.name });
      setProfile(p => ({ ...p, name: nameForm.name }));
      setNameMsg('Name updated successfully.');
      setTimeout(() => setNameMsg(''), 3000);
    } catch { setNameMsg('Failed to update name. Please try again.'); }
    finally { setNameSaving(false); }
  }

  async function changePassword(e) {
    e.preventDefault(); setPwError(''); setPwMsg('');
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('New passwords do not match.'); return;
    }
    if (pwForm.new_password.length < 6) {
      setPwError('New password must be at least 6 characters.'); return;
    }
    setPwSaving(true);
    try {
      await api.put('/profile/me/password', {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      });
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setPwMsg('Password changed successfully.');
      setTimeout(() => setPwMsg(''), 4000);
    } catch { setPwError('Failed to change password. Please check your current password and try again.'); }
    finally { setPwSaving(false); }
  }

  const cardStyle = { background: '#fff', borderRadius: 8, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 20 };

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-title">My Profile</div>

      {/* Account info */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Account Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Name</div>
            <div style={{ fontWeight: 600, marginTop: 2 }}>{profile?.name || user?.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Email</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>{profile?.email || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Role</div>
            <div style={{ fontWeight: 500, marginTop: 2, textTransform: 'capitalize' }}>{(profile?.role || user?.role || '').replace(/_/g,' ')}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Member Since</div>
            <div style={{ fontWeight: 500, marginTop: 2 }}>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</div>
          </div>
        </div>
      </div>

      {/* Update name */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Update Name</div>
        <form onSubmit={saveName}>
          <div className="form-group">
            <label>Display Name *</label>
            <input value={nameForm.name} onChange={e => setNameForm({ name: e.target.value })} required />
          </div>
          {nameMsg && <div className={`alert ${nameMsg.startsWith('Error') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 10 }}>{nameMsg}</div>}
          <button className="btn btn-primary" disabled={nameSaving}>{nameSaving ? 'Saving…' : 'Update Name'}</button>
        </form>
      </div>

      {/* School Branding — owner only */}
      {(profile?.role || user?.role) === 'owner' && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>School Branding</div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
            Set your school logo, motto, and theme colour. Changes apply across the entire platform.
          </p>
          <BrandSettings />
        </div>
      )}

      {/* Digital Signature */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Digital Authority Stamp</div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          Your signature will appear on report cards, fee statements, and other official documents you authorise.
        </p>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
          {['draw', 'upload'].map(m => (
            <button key={m} onClick={() => setSigMode(m)}
              style={{ padding: '7px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: sigMode === m ? '#1a1a2e' : '#f9fafb', color: sigMode === m ? '#fff' : '#374151' }}>
              {m === 'draw' ? '✏️ Draw' : '📎 Upload'}
            </button>
          ))}
        </div>

        {sigMode === 'draw' ? (
          <>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <canvas ref={canvasRef} width={480} height={140}
                style={{ border: '1.5px solid #d1d5db', borderRadius: 8, background: '#fafafa', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
              />
              <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 11, color: '#d1d5db', pointerEvents: 'none', userSelect: 'none' }}>
                Sign here
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={clearCanvas}
                style={{ padding: '6px 14px', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
                Clear
              </button>
              <button onClick={saveSignature} disabled={sigSaving}
                style={{ padding: '6px 18px', border: 'none', background: '#1a1a2e', color: '#fff', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                {sigSaving ? 'Saving…' : 'Save Signature'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 13, color: '#374151' }}>Upload a signature image (PNG, JPG — transparent background preferred)</label>
              <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'block', marginTop: 8, fontSize: 13 }} />
            </div>
            {existingSig && sigMode === 'upload' && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fafafa', display: 'inline-block', marginBottom: 10 }}>
                <img src={existingSig} alt="Signature preview" style={{ maxHeight: 100, maxWidth: 320, objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveSignature} disabled={sigSaving || !existingSig}
                style={{ padding: '6px 18px', border: 'none', background: '#1a1a2e', color: '#fff', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                {sigSaving ? 'Saving…' : 'Save Signature'}
              </button>
            </div>
          </>
        )}

        {sigMsg && (
          <div style={{ marginTop: 10, fontSize: 13, padding: '8px 12px', borderRadius: 6,
            background: sigMsg.startsWith('error:') ? '#fef2f2' : '#f0fdf4',
            color: sigMsg.startsWith('error:') ? '#991b1b' : '#166534' }}>
            {sigMsg.replace('error:', '')}
          </div>
        )}

        {/* Existing signature preview */}
        {existingSig && (
          <div style={{ marginTop: 20, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Current saved signature
            </div>
            <div style={{ display: 'inline-block', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 20px', background: '#fff', position: 'relative' }}>
              <img src={existingSig} alt="Your signature" style={{ maxHeight: 80, maxWidth: 280, objectFit: 'contain', display: 'block' }} />
              <div style={{ borderTop: '1px solid #374151', marginTop: 8, paddingTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>{profile?.name || user?.name}</div>
                <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'capitalize' }}>{(profile?.role || user?.role || '').replace(/_/g, ' ')}</div>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <button onClick={removeSignature}
                style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Remove signature
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Change password */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Change Password</div>
        <form onSubmit={changePassword}>
          <div className="form-group">
            <label>Current Password *</label>
            <input type="password" value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>New Password *</label>
            <input type="password" value={pwForm.new_password}
              onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Confirm New Password *</label>
            <input type="password" value={pwForm.confirm_password}
              onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))} required />
          </div>
          {pwError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{pwError}</div>}
          {pwMsg   && <div className="alert alert-success" style={{ marginBottom: 10 }}>{pwMsg}</div>}
          <button className="btn btn-primary" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Change Password'}</button>
        </form>
      </div>
    </div>
  );
}
