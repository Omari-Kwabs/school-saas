import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { hasPrivilege } from '../utils/access';

const EVENT_TYPES = [
  { value: 'term_start', label: 'Term Start',   color: 'bg-blue-500',   text: 'text-blue-700',   border: 'border-blue-400',   light: 'bg-blue-50'   },
  { value: 'term_end',   label: 'Term End',     color: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-indigo-400', light: 'bg-indigo-50' },
  { value: 'holiday',   label: 'Holiday',      color: 'bg-red-500',    text: 'text-red-700',    border: 'border-red-400',    light: 'bg-red-50'    },
  { value: 'event',     label: 'School Event', color: 'bg-emerald-500',text: 'text-emerald-700',border: 'border-emerald-400',light: 'bg-emerald-50'},
  { value: 'exam',      label: 'Exam Period',  color: 'bg-amber-500',  text: 'text-amber-700',  border: 'border-amber-400',  light: 'bg-amber-50'  },
];

function getTypeStyle(type) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[3];
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function eventSpansDay(event, dateStr) {
  const start = event.start_date?.slice(0,10);
  const end   = event.end_date?.slice(0,10) || start;
  return dateStr >= start && dateStr <= end;
}

const EMPTY_FORM = { title: '', description: '', event_type: 'event', start_date: '', end_date: '' };

export default function SchoolCalendar() {
  const { user } = useAuth();
  const canManage = hasPrivilege(user, 'calendar:manage');

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // null = create
  const [form, setForm]     = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Selected day detail
  const [selectedDay, setSelectedDay] = useState(null);
  const [terms, setTerms] = useState([]);

  // Term colour palette — cycle through for multiple concurrent terms
  const TERM_COLORS = [
    { bg: 'bg-blue-50',   border: 'border-l-2 border-blue-300',   label: 'text-blue-600',  dot: '#3b82f6' },
    { bg: 'bg-emerald-50',border: 'border-l-2 border-emerald-300',label: 'text-emerald-600',dot: '#10b981' },
    { bg: 'bg-violet-50', border: 'border-l-2 border-violet-300', label: 'text-violet-600', dot: '#8b5cf6' },
    { bg: 'bg-amber-50',  border: 'border-l-2 border-amber-300',  label: 'text-amber-600',  dot: '#f59e0b' },
  ];

  function termColor(idx) { return TERM_COLORS[idx % TERM_COLORS.length]; }

  // Returns the term (if any) that a dateStr falls inside
  function termForDay(dateStr) {
    return terms.find(t =>
      t.start_date && t.end_date &&
      dateStr >= t.start_date.slice(0, 10) &&
      dateStr <= t.end_date.slice(0, 10)
    ) || null;
  }

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/calendar', { params: { year, month: month + 1 } });
      setEvents(res.data);
    } catch {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Load terms once (for date-band rendering)
  useEffect(() => {
    api.get('/terms').then(data => setTerms(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  // Build calendar grid
  const firstDay  = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }
  function goToday() {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDay(toLocalDateStr(now));
  }

  function openCreate(dateStr) {
    if (!canManage) return;
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM, start_date: dateStr });
    setFormError('');
    setModalOpen(true);
  }
  function openEdit(ev, e) {
    e.stopPropagation();
    if (!canManage) return;
    setEditingEvent(ev);
    setForm({
      title:       ev.title,
      description: ev.description || '',
      event_type:  ev.event_type,
      start_date:  ev.start_date?.slice(0,10),
      end_date:    ev.end_date?.slice(0,10) || '',
    });
    setFormError('');
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  async function handleSave() {
    if (!form.title.trim()) return setFormError('Title is required');
    if (!form.start_date)   return setFormError('Start date is required');
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description || null,
        event_type:  form.event_type,
        start_date:  form.start_date,
        end_date:    form.end_date || null,
      };
      if (editingEvent) {
        await client.put(`/calendar/${editingEvent.id}`, payload);
      } else {
        await client.post('/calendar', payload);
      }
      closeModal();
      loadEvents();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ev, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    try {
      await client.delete(`/calendar/${ev.id}`);
      loadEvents();
      if (selectedDay) setSelectedDay(d => d); // keep selected day
    } catch {
      alert('Failed to delete event');
    }
  }

  // Events for a given dateStr
  function eventsForDay(dateStr) {
    return events.filter(ev => eventSpansDay(ev, dateStr));
  }
  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : [];

  // For upcoming events list
  const todayStr = toLocalDateStr(now);
  const upcoming = events
    .filter(ev => (ev.end_date?.slice(0,10) || ev.start_date?.slice(0,10)) >= todayStr)
    .slice(0, 8);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Term dates, holidays and school events</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium text-gray-700">
            Today
          </button>
          {canManage && (
            <button onClick={() => openCreate(toLocalDateStr(now))}
              className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
              </svg>
              Add Event
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <button onClick={prevMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/>
                </svg>
              </button>
              <h2 className="text-base font-semibold text-gray-900">{MONTHS[month]} {year}</h2>
              <button onClick={nextMonth}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                </svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading...</div>
            ) : (
              <div className="grid grid-cols-7">
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const dayNum = idx - firstDay + 1;
                  const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                  const date = isCurrentMonth ? new Date(year, month, dayNum) : null;
                  const dateStr = date ? toLocalDateStr(date) : null;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDay;
                  const dayEvents = dateStr ? eventsForDay(dateStr) : [];
                  const isLastRow = idx >= totalCells - 7;

                  // Term band: find which term this day belongs to
                  const dayTerm = dateStr ? termForDay(dateStr) : null;
                  const termIdx = dayTerm ? terms.findIndex(t => t.id === dayTerm.id) : -1;
                  const tc = termIdx >= 0 ? termColor(termIdx) : null;
                  const isTermStart = dayTerm && dateStr === dayTerm.start_date?.slice(0, 10);
                  const isTermEnd   = dayTerm && dateStr === dayTerm.end_date?.slice(0, 10);

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (!isCurrentMonth) return;
                        setSelectedDay(isSelected ? null : dateStr);
                      }}
                      onDoubleClick={() => isCurrentMonth && openCreate(dateStr)}
                      className={[
                        'min-h-[80px] p-1.5 border-b border-r border-gray-100 relative',
                        isLastRow ? 'border-b-0' : '',
                        isCurrentMonth ? 'cursor-pointer' : 'bg-gray-50/50',
                        isSelected ? 'bg-blue-50' : (tc && isCurrentMonth ? tc.bg : ''),
                        !isSelected && isCurrentMonth && !tc ? 'hover:bg-gray-50' : '',
                      ].join(' ')}
                    >
                      {/* Term boundary markers */}
                      {tc && isCurrentMonth && (isTermStart || isTermEnd) && (
                        <div className={`absolute top-0 ${isTermStart ? 'left-0' : 'right-0'} bottom-0 w-0.5`}
                          style={{ background: tc.dot, opacity: 0.6 }} />
                      )}
                      {isCurrentMonth && (
                        <>
                          <div className="flex items-start justify-between mb-0.5">
                            <span className={[
                              'inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full',
                              isToday ? 'bg-blue-600 text-white' : 'text-gray-700',
                            ].join(' ')}>
                              {dayNum}
                            </span>
                            {/* Term label on first day of month or term start */}
                            {tc && (isTermStart || dayNum === 1) && (
                              <span className={`text-[9px] font-semibold truncate ml-1 leading-tight mt-0.5 ${tc.label}`}
                                title={dayTerm.name}>
                                {dayTerm.name.replace(/\s+term\s*/i, ' T').replace('Term', 'T')}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {dayEvents.slice(0, 3).map(ev => {
                              const style = getTypeStyle(ev.event_type);
                              return (
                                <div
                                  key={ev.id}
                                  onClick={e => { e.stopPropagation(); setSelectedDay(dateStr); }}
                                  className={`text-[10px] truncate px-1 py-0.5 rounded ${style.color} text-white font-medium leading-tight`}
                                  title={ev.title}
                                >
                                  {ev.title}
                                </div>
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <span className="text-[10px] text-gray-500 px-1">+{dayEvents.length - 3} more</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3">
            {EVENT_TYPES.map(t => (
              <div key={t.value} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={`w-2.5 h-2.5 rounded-sm ${t.color}`}></span>
                {t.label}
              </div>
            ))}
          </div>
          {/* Term bands legend */}
          {terms.filter(t => t.start_date && t.end_date).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {terms.filter(t => t.start_date && t.end_date).map((t, idx) => {
                const tc = termColor(idx);
                return (
                  <div key={t.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-sm border"
                      style={{ background: tc.dot, opacity: 0.3 }}></span>
                    {t.name}
                    {t.status === 'active' && <span className="text-emerald-600 font-semibold">(active)</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="lg:w-72 flex flex-col gap-4">
          {/* Selected day detail */}
          {selectedDay && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}
                </h3>
                {canManage && (
                  <button onClick={() => openCreate(selectedDay)}
                    className="text-xs text-blue-600 hover:underline font-medium">
                    + Add
                  </button>
                )}
              </div>
              {selectedDayEvents.length === 0 ? (
                <p className="text-xs text-gray-400">No events on this day.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedDayEvents.map(ev => {
                    const style = getTypeStyle(ev.event_type);
                    return (
                      <div key={ev.id} className={`rounded-lg border ${style.border} ${style.light} p-3`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${style.text} truncate`}>{ev.title}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{getTypeStyle(ev.event_type).label}</p>
                            {ev.end_date && ev.end_date.slice(0,10) !== ev.start_date.slice(0,10) && (
                              <p className="text-[11px] text-gray-500">
                                Until {new Date(ev.end_date + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                              </p>
                            )}
                            {ev.description && (
                              <p className="text-xs text-gray-600 mt-1">{ev.description}</p>
                            )}
                          </div>
                          {canManage && (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={e => openEdit(ev, e)}
                                className="p-1 rounded hover:bg-white/80 text-gray-500 hover:text-gray-700">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                                </svg>
                              </button>
                              <button onClick={e => handleDelete(ev, e)}
                                className="p-1 rounded hover:bg-white/80 text-gray-500 hover:text-red-600">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming events */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Upcoming Events</h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-gray-400">No upcoming events.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcoming.map(ev => {
                  const style = getTypeStyle(ev.event_type);
                  const startDate = new Date(ev.start_date + 'T00:00:00');
                  return (
                    <button
                      key={ev.id}
                      onClick={() => {
                        setYear(startDate.getFullYear());
                        setMonth(startDate.getMonth());
                        setSelectedDay(ev.start_date.slice(0,10));
                      }}
                      className="text-left flex items-start gap-2.5 group"
                    >
                      <div className={`w-1 self-stretch rounded-full shrink-0 ${style.color}`}></div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 group-hover:text-blue-600 truncate">{ev.title}</p>
                        <p className="text-[11px] text-gray-500">
                          {startDate.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
                          {ev.end_date && ev.end_date.slice(0,10) !== ev.start_date.slice(0,10) &&
                            ` – ${new Date(ev.end_date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingEvent ? 'Edit Event' : 'Add Event'}
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. First Term Begins"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type <span className="text-red-500">*</span></label>
                <select
                  value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {EVENT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Optional details..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : editingEvent ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
