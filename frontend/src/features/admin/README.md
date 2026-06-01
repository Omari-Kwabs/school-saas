<!--

# PLATFORM ADMIN CONSOLE - REACT COMPONENT LIBRARY

Complete platform administration UI system built with React, Vite, and Tailwind CSS.
Monitor, manage, and support all schools across your SaaS platform.

**KEY FEATURE:** Answers "Which school needs attention NOW?" at every screen.

---

## 📊 COMPONENT INVENTORY

### PHASE 1: ADMIN SHELL (Foundation)
- **AdminLayout.jsx** - Main wrapper with sidebar, topbar, content area
- **AdminSidebar.jsx** - Collapsible navigation (7 menu items)
- **AdminTopBar.jsx** - Title, global search, profile dropdown

### PHASE 2: SCHOOLS OVERVIEW
- **SchoolsTable.jsx** - 5-column table with schools, plan, setup %, activity, risk
- **RiskBadge.jsx** - Risk status indicator (low/medium/high)

### PHASE 3: ONBOARDING TRACKER
- **OnboardingTable.jsx** - Track onboarding progress across schools
- **ProgressBar.jsx** - Reusable progress indicator (sm/md/lg sizes)

### PHASE 4: HEALTH MONITOR
- **HealthCard.jsx** - School health score with activity indicators
- **HealthDashboard.jsx** - Grid of health cards with summary stats

### PHASE 5: ALERT SYSTEM
- **AlertList.jsx** - Display alerts with type, severity, actions
- **AlertFilter.jsx** - Filter by alert type and severity level

### PHASE 6: USAGE ANALYTICS
- **UsageTable.jsx** - Track active users, daily actions, features in use
- **SimpleBarChart.jsx** - Basic bar chart visualization

### PHASE 7: BILLING
- **BillingTable.jsx** - Plan, status, expiry date, revenue tracking
- **StatusBadge.jsx** - Status indicator (active/trial/expired/pending)

### PHASE 8: LOGS
- **LogTable.jsx** - Event logs with timestamp, school, event, status

### PHASE 9: ACTIONS & DETAILS
- **AdminActionsPanel.jsx** - Quick action buttons (view, resend, trigger, resolve)
- **Drawer.jsx** - Reusable slide-out panel component
- **SchoolDetailView.jsx** - Tabbed school details in drawer (info/setup/issues)

### PHASE 10: SEARCH
- **OmniSearch.jsx** - Global search (schools, users, alerts, actions)

**TOTAL: 20 Components**

---

## 🚀 QUICK START

### 1. Basic Admin Dashboard

```jsx
import AdminLayout from './components/admin/AdminLayout';
import SchoolsTable from './components/admin/SchoolsTable';
import RiskBadge from './components/admin/RiskBadge';

export default function AdminDashboard() {
  return (
    <AdminLayout pageTitle="Schools Overview">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Schools</h2>
      <SchoolsTable onRowClick={(id) => console.log('View school:', id)} />
    </AdminLayout>
  );
}
```

### 2. Health Monitor

```jsx
import AdminLayout from './components/admin/AdminLayout';
import HealthDashboard from './components/admin/HealthDashboard';

export default function HealthPage() {
  return (
    <AdminLayout pageTitle="Health Monitor">
      <HealthDashboard onCardClick={(id) => console.log('View school:', id)} />
    </AdminLayout>
  );
}
```

### 3. Onboarding Tracker

```jsx
import AdminLayout from './components/admin/AdminLayout';
import OnboardingTable from './components/admin/OnboardingTable';

export default function OnboardingPage() {
  return (
    <AdminLayout pageTitle="Onboarding Progress">
      <OnboardingTable onRowClick={(id) => console.log('View onboarding:', id)} />
    </AdminLayout>
  );
}
```

### 4. Alerts Dashboard

```jsx
import AdminLayout from './components/admin/AdminLayout';
import AlertFilter from './components/admin/AlertFilter';
import AlertList from './components/admin/AlertList';

export default function AlertsPage() {
  const [filters, setFilters] = useState({});

  return (
    <AdminLayout pageTitle="Alerts">
      <AlertFilter onFilterChange={setFilters} />
      <AlertList onResolve={(id) => console.log('Resolve alert:', id)} />
    </AdminLayout>
  );
}
```

### 5. Usage Analytics

```jsx
import AdminLayout from './components/admin/AdminLayout';
import UsageTable from './components/admin/UsageTable';
import SimpleBarChart from './components/admin/SimpleBarChart';

export default function UsagePage() {
  return (
    <AdminLayout pageTitle="Usage Analytics">
      <SimpleBarChart title="Daily Actions" />
      <div className="mt-6">
        <UsageTable onRowClick={(id) => console.log('View usage:', id)} />
      </div>
    </AdminLayout>
  );
}
```

### 6. Billing Management

```jsx
import AdminLayout from './components/admin/AdminLayout';
import BillingTable from './components/admin/BillingTable';

export default function BillingPage() {
  return (
    <AdminLayout pageTitle="Billing">
      <BillingTable onRowClick={(id) => console.log('View billing:', id)} />
    </AdminLayout>
  );
}
```

### 7. Event Logs

```jsx
import AdminLayout from './components/admin/AdminLayout';
import LogTable from './components/admin/LogTable';

export default function LogsPage() {
  return (
    <AdminLayout pageTitle="Event Logs">
      <LogTable onRowClick={(id) => console.log('View log:', id)} />
    </AdminLayout>
  );
}
```

---

## 🎯 COMPLETE ADMIN APP EXAMPLE

```jsx
import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout';
import SchoolsTable from './components/admin/SchoolsTable';
import SchoolDetailView from './components/admin/SchoolDetailView';
import HealthDashboard from './components/admin/HealthDashboard';
import OnboardingTable from './components/admin/OnboardingTable';
import AlertFilter from './components/admin/AlertFilter';
import AlertList from './components/admin/AlertList';
import UsageTable from './components/admin/UsageTable';
import SimpleBarChart from './components/admin/SimpleBarChart';
import BillingTable from './components/admin/BillingTable';
import LogTable from './components/admin/LogTable';

export default function AdminApp() {
  const [selectedSchoolId, setSelectedSchoolId] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);

  const handleAction = (action, schoolId) => {
    console.log(`Action: ${action} on school ${schoolId}`);
    switch (action) {
      case 'view':
        setSelectedSchoolId(schoolId);
        setDetailViewOpen(true);
        break;
      case 'resend':
        console.log('Resend invite');
        break;
      case 'trigger':
        console.log('Trigger onboarding');
        break;
      case 'resolve':
        console.log('Mark resolved');
        break;
      default:
        break;
    }
  };

  return (
    <Routes>
      {/* Dashboard */}
      <Route
        path="/admin"
        element={
          <AdminLayout pageTitle="Dashboard">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <p className="text-sm text-gray-600">Total Schools</p>
                <p className="text-3xl font-bold text-indigo-600">47</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <p className="text-sm text-gray-600">Active Alerts</p>
                <p className="text-3xl font-bold text-red-600">3</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <p className="text-sm text-gray-600">Monthly Revenue</p>
                <p className="text-3xl font-bold text-green-600">$18.2K</p>
              </div>
            </div>
            <SchoolsTable onRowClick={(id) => {
              setSelectedSchoolId(id);
              setDetailViewOpen(true);
            }} />
          </AdminLayout>
        }
      />

      {/* Schools */}
      <Route
        path="/admin/schools"
        element={
          <AdminLayout pageTitle="Schools Overview">
            <SchoolsTable onRowClick={(id) => {
              setSelectedSchoolId(id);
              setDetailViewOpen(true);
            }} />
          </AdminLayout>
        }
      />

      {/* Health Monitor */}
      <Route
        path="/admin/health"
        element={
          <AdminLayout pageTitle="Health Monitor">
            <HealthDashboard onCardClick={(id) => {
              setSelectedSchoolId(id);
              setDetailViewOpen(true);
            }} />
          </AdminLayout>
        }
      />

      {/* Onboarding */}
      <Route
        path="/admin/onboarding"
        element={
          <AdminLayout pageTitle="Onboarding Progress">
            <OnboardingTable onRowClick={(id) => {
              setSelectedSchoolId(id);
              setDetailViewOpen(true);
            }} />
          </AdminLayout>
        }
      />

      {/* Alerts */}
      <Route
        path="/admin/alerts"
        element={
          <AdminLayout pageTitle="Alerts">
            <AlertFilter />
            <div className="mt-6">
              <AlertList onResolve={(id) => console.log('Resolve:', id)} />
            </div>
          </AdminLayout>
        }
      />

      {/* Usage */}
      <Route
        path="/admin/usage"
        element={
          <AdminLayout pageTitle="Usage Analytics">
            <SimpleBarChart />
            <div className="mt-6">
              <UsageTable />
            </div>
          </AdminLayout>
        }
      />

      {/* Billing */}
      <Route
        path="/admin/billing"
        element={
          <AdminLayout pageTitle="Billing">
            <BillingTable />
          </AdminLayout>
        }
      />

      {/* Logs */}
      <Route
        path="/admin/logs"
        element={
          <AdminLayout pageTitle="Event Logs">
            <LogTable />
          </AdminLayout>
        }
      />
    </Routes>

    {/* School Detail View Drawer */}
    <SchoolDetailView
      isOpen={detailViewOpen}
      schoolId={selectedSchoolId}
      onClose={() => setDetailViewOpen(false)}
      onAction={handleAction}
    />
  );
}
```

---

## 📝 DATA STRUCTURES

### School
```javascript
{
  id: 1,
  name: 'St. Johns Academy',
  plan: 'Pro',
  setupPercent: 85,
  lastActivity: '2 hours ago',
  risk: 'low',
  email: 'admin@stjohns.edu',
  phone: '+1 (555) 123-4567',
}
```

### Onboarding
```javascript
{
  id: 1,
  schoolName: 'St. Johns Academy',
  currentStep: 8,
  totalSteps: 8,
  progress: 100,
  createdDate: '2024-05-01',
}
```

### Health
```javascript
{
  id: 1,
  schoolName: 'St. Johns Academy',
  setupScore: 95,
  paymentActivity: 'Active',
  academicActivity: 'Good',
}
```

### Alert
```javascript
{
  id: 1,
  school: 'Community School',
  type: 'Setup Incomplete',
  message: 'Onboarding not completed in 7 days',
  severity: 'high',
  time: '2 hours ago',
}
```

### Usage
```javascript
{
  id: 1,
  school: 'St. Johns Academy',
  activeUsers: 145,
  dailyActions: 1250,
  features: 'Grades, Attendance, Memos',
}
```

### Billing
```javascript
{
  id: 1,
  school: 'St. Johns Academy',
  plan: 'Pro',
  status: 'active',
  expiryDate: '2025-05-06',
  amount: '$99/mo',
}
```

### Log
```javascript
{
  id: 1,
  timestamp: '2024-05-06 14:32:45',
  school: 'St. Johns Academy',
  event: 'Onboarding completed',
  status: 'success',
}
```

---

## 🎨 DESIGN SYSTEM

### Colors
- Primary: `indigo-600`
- Success: `green-*`
- Warning: `yellow-*`
- Error: `red-*`
- Info: `blue-*`

### Spacing
- Container: `max-w-7xl mx-auto`
- Gaps: 4-6px (grid), 6px (flex)
- Padding: 6px (card)

### Responsive
- Mobile: `grid-cols-1`
- Tablet: `md:grid-cols-2`
- Desktop: `lg:grid-cols-3`

---

## 🔗 INTEGRATION CHECKLIST

- [ ] Add routes to your router
- [ ] Import AdminLayout into each admin page
- [ ] Replace MOCK_DATA with API calls
- [ ] Wire up onRowClick handlers to actual navigation
- [ ] Connect onAction handlers to backend endpoints
- [ ] Add real school data fetching
- [ ] Implement alert resolution
- [ ] Add real-time dashboard updates

---

## 📂 FILE STRUCTURE

```
frontend/src/components/admin/
├── AdminLayout.jsx
├── AdminSidebar.jsx
├── AdminTopBar.jsx
├── SchoolsTable.jsx
├── RiskBadge.jsx
├── OnboardingTable.jsx
├── ProgressBar.jsx
├── HealthCard.jsx
├── HealthDashboard.jsx
├── AlertList.jsx
├── AlertFilter.jsx
├── UsageTable.jsx
├── SimpleBarChart.jsx
├── BillingTable.jsx
├── StatusBadge.jsx
├── LogTable.jsx
├── AdminActionsPanel.jsx
├── Drawer.jsx
├── SchoolDetailView.jsx
├── OmniSearch.jsx
└── README.md (this file)
```

---

## ✨ KEY FEATURES

✓ **Data-Focused** - Tables, charts, metrics
✓ **Mobile Responsive** - Works on all screen sizes
✓ **Zero Dependencies** - React + Tailwind only
✓ **Mock Data Ready** - Instant prototyping
✓ **Reusable Badges** - RiskBadge, StatusBadge
✓ **Drawer Pattern** - SchoolDetailView component
✓ **Global Search** - OmniSearch across data
✓ **Activity Monitoring** - Real-time status
✓ **Alert System** - Type and severity filtering
✓ **Quick Actions** - One-click operations

---

## 🎯 DESIGN PHILOSOPHY

**Every screen must answer: "Which school needs attention NOW?"**

- **Schools Table** → Risk status visible
- **Health Dashboard** → Color-coded scores
- **Onboarding Table** → Completion % clear
- **Alerts Page** → Severity-sorted
- **Usage Table** → Active/inactive distinction
- **Billing Table** → Expiry dates prominent

---

## 📖 USAGE PATTERNS

### Pattern 1: Click Row → Open Detail View
```jsx
<SchoolsTable onRowClick={(id) => {
  setSelectedSchoolId(id);
  setDetailViewOpen(true);
}} />
<SchoolDetailView
  isOpen={detailViewOpen}
  schoolId={selectedSchoolId}
  onClose={() => setDetailViewOpen(false)}
  onAction={handleAction}
/>
```

### Pattern 2: Filter → Display
```jsx
<AlertFilter onFilterChange={setFilters} />
<AlertList alerts={filteredAlerts} />
```

### Pattern 3: Sidebar Navigation
```jsx
{/* In AdminSidebar */}
<NavLink to="/admin/schools">Schools</NavLink>
<NavLink to="/admin/health">Health</NavLink>
<NavLink to="/admin/alerts">Alerts</NavLink>
```

---

## 🚀 WHAT'S NEXT

1. **Connect to Backend** - Replace mock data with API calls
2. **Add Real-time Updates** - WebSocket for live alerts
3. **Export Features** - CSV export for tables
4. **Advanced Filters** - Date range, custom search
5. **Batch Actions** - Select multiple schools
6. **Dashboard Widgets** - Customizable admin dashboard
7. **Audit Trail** - Track admin actions

---

## 📞 SUPPORT

All components include:
- Mock data for instant testing
- Responsive design out of the box
- Tailwind utilities (no custom CSS)
- JSX + Vite compatible
- onClick/onChange handlers ready for integration

-->
