# School User & System Administrator Manual

## 1. Overview
This manual contains two sets of guidance:

1. **School users** — how to log in, navigate the school portal, and use the system.
2. **System administrators** — how to access the admin console, login credentials, and important admin workflows.

This is designed to be shared with schools and with your platform admin team.

---

## 2. School Portal Access

### Login Page
- URL: `http://localhost:5173/login`
- Required fields:
  - School code
  - Email
  - Password

### What School Users Can Do
- Access the school dashboard
- View students, classes, attendance, results, and grades
- Read announcements
- Send memos
- Manage profile and password

### Common School Roles
- **Owner**: full school-level access
- **Teacher**: academic and attendance access
- **Bursar / Accountant**: billing and fees access
- **Headmaster (Academics / Admin)**: school-level academic or administrative control

### School Portal Tips
- Use the school code exactly as provided by your platform admin.
- If login fails, verify email and password first.
- For forgotten password, follow the school portal’s password reset workflow.
- School users do not use `/admin` or `/admin/login`.

---

## 3. System Administrator Access

### Admin Console Login
- URL: `http://localhost:5173/admin/login`
- This is a separate login flow for platform administrators only.
- Do not use the school portal login page for system admin access.

### Default System Admin Credentials
These are the provided default credentials for the admin console:

- Email: `superadmin@schoolsaas.com`
- Password: `Admin@SchoolSaaS2025`

> If the app is deployed with environment overrides, the credentials may use values from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend `.env` file.

### Accessing the Admin Console
1. Open: `http://localhost:5173/admin/login`
2. Enter the system admin email and password
3. Click **Sign In**
4. After login, you are redirected to `http://localhost:5173/admin`

### Admin Console Pages
The admin console includes these pages:
- `/admin` — Admin dashboard
- `/admin/schools` — Schools overview
- `/admin/health` — Health monitor
- `/admin/onboarding` — Onboarding tracker
- `/admin/alerts` — Alerts center
- `/admin/usage` — Usage analytics
- `/admin/billing` — Billing dashboard
- `/admin/logs` — Event logs

### Important Notes
- The admin console is a standalone workspace for platform-level management.
- Use the admin login page, not the school portal page.
- If the admin page appears inside the school portal design, refresh and verify `/admin/login` first.
- Only users in the `system_admin` role can access these routes.

---

## 4. System Admin Responsibilities

### Key Admin Tasks
- Monitor school onboarding progress
- Check health metrics for each school
- Resolve urgent alerts
- Review billing and subscription status
- Inspect system logs and audit events
- Trigger or reset school onboarding flows as needed

### Recommended Workflow
1. Login to `http://localhost:5173/admin/login`
2. Review the dashboard for priority issues
3. Open the Schools page to see setup % and risk status
4. View the Health Monitor to identify low-scoring schools
5. Check Alerts and resolve critical items first
6. Visit Billing for expiring or overdue accounts
7. Use Logs if troubleshooting system behavior

---

## 5. School User Learning Material

### Getting Started for School Staff
1. Navigate to the school portal at `http://localhost:5173/login`
2. Enter your school code, email, and password
3. On successful login, you will land on the school dashboard
4. Use the sidebar to access sections like Students, Attendance, Results, and Fees

### Classroom & Student Management
- **Students**: view student records and profiles
- **Classes**: see class lists and assigned teachers
- **Attendance**: mark attendance and review history
- **Grades**: review grades and assessments

### Communication & Notifications
- **Announcements**: official school updates
- **Memos**: send internal messages to staff or families
- **Alerts**: watch for important system notifications

### Billing & Fees
- School users with finance access can view billing details
- Track due dates and payment plans
- Owners and bursars can manage fee structures

---

## 6. Troubleshooting

### If School Portal Login Fails
- Confirm the correct school code
- Confirm email and password are correct
- Ensure the school account is active
- Contact the platform admin if the account is locked or inactive

### If Admin Login Fails
- Confirm admin email and password
- Use `http://localhost:5173/admin/login`
- If still failing, restart the backend and run the admin creation script:
  - `cd backend`
  - `node scripts/create-admin.js`
- Check `.env` for `ADMIN_EMAIL` and `ADMIN_PASSWORD`

### If `/admin` Looks Wrong
- Open `/admin/login` first and sign in
- The console should load in its own admin layout
- If you see the school portal style, your session may not be a system admin

---

## 7. Admin Onboarding Tips for Schools

### For School Owners
- Complete the onboarding wizard step-by-step
- Fill in school identity, academic structure, terms, subjects, staff, fees, and student records
- Use the review page to confirm everything before going live

### For Teachers
- Use the dashboard to access student performance and assessment tools
- Update attendance and feedback regularly
- Collaborate with the owner or headmaster for data accuracy

### For Finance Staff
- Maintain fee schedules and payment plans
- Monitor overdue balances and alerts
- Work with the owner to keep billing healthy

---

## 8. Admin Security Best Practices

- Change the default admin password immediately after first login
- Keep admin credentials secure and limited to trusted staff
- Use strong passwords and unique email accounts
- Review audit logs regularly for suspicious activity

---

## 9. Contact & Support

For help with the system setup, contact your platform administrator or technical support team.

If you need custom training materials, copy this manual and adapt it for your school network.
