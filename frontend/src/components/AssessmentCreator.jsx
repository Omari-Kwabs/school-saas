import React, { useState, useEffect } from 'react';
import Stepper, { StepperNav } from './Stepper';
import { api } from '../api';

const STEPS = ['Context', 'Type', 'Competencies', 'Confirm'];

const TYPE_INFO = {
  AfL: { label: 'Assessment for Learning', tip: 'Formative — improves learning during the process. Used for feedback loops.' },
  AaL: { label: 'Assessment as Learning',  tip: 'Self-reflective — students assess themselves and peers to build metacognition.' },
  AoL: { label: 'Assessment of Learning',  tip: 'Summative — measures achievement at the end of a unit or term.' },
};

const empty = { title: '', class_id: '', subject_id: '', term_id: '', max_score: '100', format: '' };

export default function AssessmentCreator({ onSaved, onCancel }) {
  const [step, setStep]         = useState(0);
  const [form, setForm]         = useState(empty);
  const [type, setType]         = useState('AoL');
  const [competencies, setComp] = useState([]);
  const [selected, setSelected] = useState([]);
  const [compSearch, setSearch] = useState('');
  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms]       = useState([]);
  const [allComps, setAllComps] = useState([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/classes').catch(() => []),
      api.get('/subjects').catch(() => []),
      api.get('/terms').catch(() => []),
      api.get('/competencies').catch(() => []),
    ]).then(([cls, sub, trm, cmp]) => {
      setClasses(Array.isArray(cls) ? cls : []);
      setSubjects(Array.isArray(sub) ? sub : []);
      setTerms(Array.isArray(trm) ? trm : []);
      setAllComps(Array.isArray(cmp) ? cmp : []);
    });
  }, []);

  function handle(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }

  function toggleComp(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const filteredComps = allComps.filter(c =>
    !compSearch || c.name.toLowerCase().includes(compSearch.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(compSearch.toLowerCase()))
  );

  async function submit() {
    setSaving(true); setError('');
    try {
      const payload = {
        title:      form.title,
        type,
        class_id:   form.class_id   || undefined,
        subject_id: form.subject_id || undefined,
        term_id:    form.term_id    || undefined,
        max_score:  form.max_score  ? Number(form.max_score) : undefined,
        format:     form.format     || undefined,
        competency_ids: selected,
      };
      const saved = await api.post('/assessments', payload);
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function canNext() {
    if (step === 0) return form.title.trim() && form.subject_id && form.class_id;
    if (step === 1) return !!type;
    return true;
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else submit();
  }

  const cls     = classes.find(c => c.id === form.class_id);
  const subj    = subjects.find(s => s.id === form.subject_id);
  const term    = terms.find(t => t.id === form.term_id);
  const selComp = allComps.filter(c => selected.includes(c.id));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 max-w-2xl w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-800">New Assessment</h2>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

      <Stepper steps={STEPS} current={step} onStep={setStep}>
        {/* Step 0: Context */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Title *</label>
              <input
                name="title" value={form.title} onChange={handle}
                placeholder="e.g. Term 1 Mathematics Assessment"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Class *</label>
                <select name="class_id" value={form.class_id} onChange={handle}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Select Class —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject *</label>
                <select name="subject_id" value={form.subject_id} onChange={handle}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Select Subject —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Term</label>
                <select name="term_id" value={form.term_id} onChange={handle}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Select Term —</option>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Max Score</label>
                <input name="max_score" type="number" value={form.max_score} onChange={handle}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Type */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(TYPE_INFO).map(([key, info]) => (
              <button
                key={key} type="button"
                onClick={() => setType(key)}
                className={`text-left p-4 rounded-xl border-2 transition-all
                  ${type === key ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0
                    ${type === key ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                    {type === key && (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </span>
                  <div>
                    <p className={`font-semibold text-sm ${type === key ? 'text-indigo-700' : 'text-gray-800'}`}>
                      {key} — {info.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{info.tip}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Competencies */}
        {step === 2 && (
          <div className="space-y-3">
            <input
              value={compSearch} onChange={e => setSearch(e.target.value)}
              placeholder="Search competencies…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selComp.map(c => (
                  <span key={c.id} onClick={() => toggleComp(c.id)}
                    className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full cursor-pointer hover:bg-indigo-200">
                    {c.name}
                    <span className="text-indigo-400">×</span>
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-gray-200 p-2">
              {filteredComps.length === 0 && (
                <p className="text-xs text-gray-400 py-4 text-center">No competencies found.</p>
              )}
              {filteredComps.map(c => (
                <label key={c.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors
                    ${selected.includes(c.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleComp(c.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">{c.name}</span>
                  {c.code && <span className="ml-auto text-xs text-gray-400 font-mono">{c.code}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
              <Row label="Title"    value={form.title} />
              <Row label="Type"     value={`${type} — ${TYPE_INFO[type].label}`} />
              <Row label="Class"    value={cls?.name || '—'} />
              <Row label="Subject"  value={subj?.name || '—'} />
              <Row label="Term"     value={term?.name || '—'} />
              <Row label="Max Score" value={form.max_score || '100'} />
              <div className="flex gap-2 pt-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[110px]">Competencies</span>
                <div className="flex flex-wrap gap-1">
                  {selComp.length === 0
                    ? <span className="text-gray-400">None selected</span>
                    : selComp.map(c => (
                        <span key={c.id} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{c.name}</span>
                      ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        <StepperNav
          current={step}
          total={STEPS.length}
          onBack={() => setStep(s => s - 1)}
          onNext={handleNext}
          nextLabel={step === STEPS.length - 1 ? 'Create Assessment' : 'Next'}
          loading={saving}
        />
      </Stepper>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[110px]">{label}</span>
      <span className="text-gray-800 font-medium">{value || '—'}</span>
    </div>
  );
}
