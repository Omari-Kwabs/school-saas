<!--

# SCHOOL SAAS ONBOARDING SYSTEM

## Overview

Complete React (Vite + Tailwind) onboarding UI system for a School Management SaaS.
Provides all components needed to guide schools through setup in a friction-free way.

---

## COMPONENT STRUCTURE

### PHASE 1: SHELL (Foundation)
- **OnboardingLayout.jsx** - Main layout wrapper with progress bar, title, action buttons
- **ProgressBar.jsx** - Visual progress indicator with step labels

### PHASE 2: SETUP WIZARD (Core Flow)
- **SchoolIdentityStep.jsx** - School name, logo, motto, primary color
- **AcademicStructureStep.jsx** - Levels/grades and classes per level
- **TermSetupStep.jsx** - Academic year and term dates
- **SubjectSetupStep.jsx** - Add/remove subjects with quick presets
- **StaffSetupStep.jsx** - Add staff, assign roles and classes
- **FeeSetupStep.jsx** - Define fee items, payment plans (50-50, 33-33-33, etc.)
- **StudentImportStep.jsx** - Manual add or CSV upload with preview
- **ReviewStep.jsx** - Summary of all setup, final confirmation

### PHASE 3: DASHBOARD
- **OnboardingDashboard.jsx** - Post-setup dashboard with progress, issues, quick actions, tips

### PHASE 4: DIAGNOSTICS
- **SetupHealthCard.jsx** - Circular progress score with status label
- **IssueList.jsx** - Display setup issues with fix buttons
- **IssueFixButton.jsx** - Trigger fixes with optional confirmation
- **DiagnosticPanel.jsx** - Multi-section health check (data, fees, academics, activity)

### PHASE 5: GUIDED ACTIONS
- **GuidedTasks.jsx** - List of actionable tasks (attendance, payments, assessments)
- **ToastPrompt.jsx** - Dismissible notification with action button

### PHASE 6: CSV VALIDATION
- **CsvErrorTable.jsx** - Display CSV import errors with row numbers and suggestions

### PHASE 7: OFFLINE SUPPORT
- **OfflineIndicator.jsx** - Online/offline status indicator
- **SyncStatus.jsx** - Show pending changes and sync status

### ORCHESTRATION
- **Onboarding.jsx** - Main component that orchestrates the entire 8-step wizard flow

---

## QUICK START

### 1. Import the Orchestration Component

```jsx
import Onboarding from './components/onboarding/Onboarding';

export default function SetupPage() {
  function handleComplete(setupData) {
    console.log('Setup complete!', setupData);
    // Save to backend, redirect to dashboard, etc.
  }

  return (
    <Onboarding onComplete={handleComplete} />
  );
}
```

### 2. Use Individual Components

```jsx
import SchoolIdentityStep from './components/onboarding/SchoolIdentityStep';
import OnboardingLayout from './components/onboarding/OnboardingLayout';

export default function CustomOnboarding() {
  const [step, setStep] = useState(1);
  const [schoolData, setSchoolData] = useState({});

  return (
    <OnboardingLayout
      currentStep={step}
      totalSteps={5}
      stepTitle="School Setup"
      onNext={() => setStep(step + 1)}
      onBack={() => setStep(step - 1)}
    >
      <SchoolIdentityStep
        onSave={(data) => {
          setSchoolData(data);
          setStep(step + 1);
        }}
        initialData={schoolData}
      />
    </OnboardingLayout>
  );
}
```

### 3. Post-Setup Dashboard

```jsx
import OnboardingDashboard from './components/onboarding/OnboardingDashboard';

export default function Dashboard() {
  const issues = [
    {
      id: 1,
      title: 'No fee structure',
      message: 'Set up fees to enable payment tracking',
    },
  ];

  return (
    <OnboardingDashboard
      setupProgress={75}
      issues={issues}
      onFixIssue={(id) => console.log('Fix issue:', id)}
    />
  );
}
```

---

## DATA FLOW

Each step collects data and returns it via `onSave()` callback.

```javascript
{
  // School Identity
  schoolName: 'St. Johns Academy',
  motto: 'Excellence in Education',
  logoUrl: 'data:image/png...',
  primaryColor: '#4f46e5',

  // Academic Structure
  levels: [
    {
      id: 1,
      name: 'Primary',
      classes: [
        { id: 101, name: 'Primary 1A' },
        { id: 102, name: 'Primary 1B' },
      ],
    },
  ],

  // Terms
  academicYear: '2024/2025',
  terms: [
    { id: 1, name: 'Term 1', startDate: '2024-01-15', endDate: '2024-04-12' },
  ],

  // Subjects
  subjects: [
    { id: 1, name: 'Mathematics' },
    { id: 2, name: 'English' },
  ],

  // Staff
  staff: [
    {
      id: 1,
      name: 'Mr. Kofi',
      email: 'kofi@school.edu',
      role: 'teacher',
      assignedClass: 101,
    },
  ],

  // Fees
  feeItems: [
    { id: 1, name: 'Tuition Fee', amount: 50000 },
    { id: 2, name: 'Sports Fee', amount: 5000 },
  ],
  paymentPlan: '50', // '100', '50', or '33'

  // Students
  students: [
    { id: 1, name: 'John Doe', email: 'john@school.edu', classId: 101 },
  ],
}
```

---

## TAILWIND CLASSES USED

Key utility classes for responsive design:
- `grid`, `grid-cols-1`, `lg:grid-cols-3` - Responsive layouts
- `hidden`, `sm:block`, `md:flex` - Show/hide by breakpoint
- `bg-gradient-to-br`, `from-indigo-50` - Gradients
- `rounded-lg`, `border-gray-200` - Styling
- `hover:bg-indigo-700`, `transition-colors` - Interactions
- `disabled:opacity-50`, `disabled:cursor-not-allowed` - Disabled states

---

## CUSTOMIZATION

### Change Colors

Edit the hex value in color props:
```jsx
<SchoolIdentityStep
  initialData={{ primaryColor: '#ff6b6b' }}
/>
```

### Add Step

Add to STEPS array in Onboarding.jsx:
```javascript
const STEPS = [
  // ... existing steps ...
  { id: 9, title: 'My Custom Step', label: 'Custom' },
];
```

Add case in renderStep():
```javascript
case 9:
  return <MyCustomStep onSave={handleSaveCustom} />;
```

### Disable Auto-Progress

Set `disableNext={true}` in OnboardingLayout to require manual action:
```jsx
<OnboardingLayout
  disableNext={!formIsValid}
/>
```

---

## KEY DESIGN PRINCIPLES

1. **Ask One Thing Per Step** - Each step focuses on one concept
2. **Show Progress** - Visual indicators everywhere
3. **Quick Wins** - Pre-populated options (common subjects, fee items)
4. **Error Clarity** - CSV errors show row number + suggestion
5. **Always Show Next Action** - Every screen answers "What do I do next?"
6. **Mobile First** - Responsive grid from start
7. **Offline Ready** - SyncStatus and OfflineIndicator included

---

## USAGE IN ROUTES

```jsx
// In your App.jsx or router
<Route path="/onboarding" element={<Onboarding onComplete={handleComplete} />} />
<Route path="/dashboard" element={<OnboardingDashboard />} />
```

---

## FILES CREATED

- frontend/src/components/onboarding/OnboardingLayout.jsx
- frontend/src/components/onboarding/ProgressBar.jsx
- frontend/src/components/onboarding/SchoolIdentityStep.jsx
- frontend/src/components/onboarding/AcademicStructureStep.jsx
- frontend/src/components/onboarding/TermSetupStep.jsx
- frontend/src/components/onboarding/SubjectSetupStep.jsx
- frontend/src/components/onboarding/StaffSetupStep.jsx
- frontend/src/components/onboarding/FeeSetupStep.jsx
- frontend/src/components/onboarding/StudentImportStep.jsx
- frontend/src/components/onboarding/ReviewStep.jsx
- frontend/src/components/onboarding/OnboardingDashboard.jsx
- frontend/src/components/onboarding/SetupHealthCard.jsx
- frontend/src/components/onboarding/IssueList.jsx
- frontend/src/components/onboarding/IssueFixButton.jsx
- frontend/src/components/onboarding/DiagnosticPanel.jsx
- frontend/src/components/onboarding/GuidedTasks.jsx
- frontend/src/components/onboarding/ToastPrompt.jsx
- frontend/src/components/onboarding/CsvErrorTable.jsx
- frontend/src/components/onboarding/OfflineIndicator.jsx
- frontend/src/components/onboarding/SyncStatus.jsx
- frontend/src/components/onboarding/Onboarding.jsx (orchestrator)

**Total: 21 components**

---

## WHAT THIS DELIVERS

✓ Complete friction-free onboarding experience
✓ Mobile responsive design
✓ Data validation and CSV import
✓ Post-setup diagnostics and health checks
✓ Guided tasks for next actions
✓ Offline support and sync status
✓ Zero external dependencies (just React + Tailwind)
✓ Reusable components for custom flows
✓ Clear data structure for backend integration

**Result: Schools can be live in 10 minutes.**

-->
