const BASE_HEADERS = { 'Content-Type': 'application/json' };
const MUTATION_HEADERS = { ...BASE_HEADERS, 'X-Requested-With': 'XMLHttpRequest' };

async function get(path) {
  const res = await fetch(`/api/admin${path}`, { credentials: 'include', headers: BASE_HEADERS });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`/api/admin${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: MUTATION_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function patch(path, body) {
  const res = await fetch(`/api/admin${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: MUTATION_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export const adminApi = {
  plans:              ()              => get('/plans'),
  updatePlanPrice:    (plan, price_ghs) => post(`/plans/${plan}/price`, { price_ghs }),
  stats:              ()   => get('/stats'),
  schools:            ()   => get('/schools'),
  school:             (id) => get(`/schools/${id}`),
  health:             ()   => get('/health'),
  alerts:             ()   => get('/alerts'),
  resolveAlert:       (id) => post(`/alerts/${id}/resolve`),
  billing:            ()   => get('/billing'),
  usage:              ()   => get('/usage'),
  logs:               (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return get(`/logs${qs ? `?${qs}` : ''}`);
  },
  onboarding:         ()   => get('/onboarding'),
  createSchool:       (data) => post('/schools', data),
  resendInvite:       (id) => post(`/schools/${id}/resend-invite`),
  triggerOnboarding:   (id) => post(`/schools/${id}/trigger-onboarding`),
  changeSubscription:  (id, data) => patch(`/schools/${id}/subscription`, data),
  schoolSubscriptions: (id) => get(`/schools/${id}/subscriptions`),
};

// Format an ISO timestamp as a relative "X ago" string
export function timeAgo(iso) {
  if (!iso) return 'Never';
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
