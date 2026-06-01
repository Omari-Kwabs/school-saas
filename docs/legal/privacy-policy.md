# Privacy Policy

**Cyborg Technologies**
**Product: SchoolOS**
**Effective Date: 30 May 2026**
**Last Updated: 30 May 2026**

---

## 1. Introduction

Cyborg Technologies ("**we**", "**us**", or "**our**") operates SchoolOS, a cloud-based school management platform. This Privacy Policy explains how we collect, use, disclose, and safeguard personal information when you or your institution uses SchoolOS.

We are committed to protecting personal data in compliance with the **Data Protection Act, 2012 (Act 843)** of the Republic of Ghana and all applicable regulations made thereunder.

By using SchoolOS, you acknowledge that you have read, understood, and agree to this Privacy Policy.

---

## 2. Definitions

| Term | Meaning |
|------|---------|
| **Platform** | The SchoolOS web application and associated services |
| **Institution** | A school or educational organisation that subscribes to SchoolOS |
| **Administrator** | A user with institutional management privileges |
| **User** | Any individual who accesses the Platform (administrators, teachers, staff) |
| **Student Data** | Personal information relating to enrolled students |
| **Processing** | Any operation performed on personal data |

---

## 3. Who We Are (Data Controller)

**Cyborg Technologies**
Email: omarikwabs.ucchim@gmail.com

For matters relating to data protection, contact us at the email address above.

---

## 4. Data We Collect

### 4.1 Institutional Account Data
- Institution name, logo, motto, primary colour, and contact details
- Subscription plan and billing records
- Onboarding configuration (academic structure, fee structures, term settings)

### 4.2 User Account Data
- Full name, email address, username, and role
- Hashed passwords (we never store plaintext passwords)
- Login timestamps and session identifiers
- Assigned privileges and access permissions

### 4.3 Student Data
- Full name, class/year group, and enrollment status
- Attendance records (present, absent, late)
- Academic grades, assessment scores, and report card data
- Portfolio items (where applicable)
- Fee payment status and financial records

### 4.4 Operational Data
- Timetable and calendar entries
- Announcements, memos, and internal communications
- Expense records and store transactions
- Feeding records

### 4.5 Technical and Usage Data
- IP addresses and browser/device information
- Authentication tokens (stored in httpOnly cookies)
- Error logs and crash reports (collected via Sentry when enabled)
- API usage and feature interaction analytics

---

## 5. How We Collect Data

- **Directly from Institutions:** During onboarding and day-to-day platform use
- **From Users:** When users log in, enter records, or interact with Platform features
- **Automatically:** Via server logs, cookies, and error monitoring tools
- **CSV Imports:** When institutions bulk-import student records

---

## 6. Purposes of Processing

We process personal data for the following lawful purposes:

| Purpose | Legal Basis (Act 843) |
|---------|----------------------|
| Providing and maintaining the Platform | Performance of contract |
| User authentication and session management | Performance of contract |
| Generating academic reports and report cards | Performance of contract |
| Processing fee payments and financial records | Performance of contract |
| Sending system notifications and alerts | Legitimate interest |
| Error monitoring and platform stability | Legitimate interest |
| Compliance with legal obligations | Legal obligation |
| Platform analytics and improvement | Legitimate interest |

---

## 7. Children's Data

SchoolOS processes data relating to school-aged children on behalf of subscribing institutions. Institutions are responsible for:

- Obtaining all necessary consents from parents or guardians where required under applicable law
- Ensuring data entered about students is accurate and lawfully obtained
- Notifying us of any data subject access requests from parents or guardians

We do not use student data for advertising, profiling, or any purpose beyond delivering the contracted service to the Institution.

---

## 8. Cookies and Session Tokens

We use **httpOnly cookies** to store authentication tokens securely. These cookies:

- Are not accessible via JavaScript
- Expire after 2 hours of inactivity (short-lived JWT tokens)
- Are refreshed automatically via the `/api/auth/refresh` endpoint

We do not use advertising cookies or third-party tracking cookies.

---

## 9. Data Sharing and Disclosure

We do not sell personal data. We may share data only as follows:

### 9.1 Sub-processors
We use the following third-party services to operate the Platform:

| Provider | Purpose | Location |
|----------|---------|---------|
| Cloudflare R2 | File storage (logos, signatures, portfolios) | Global CDN |
| Sentry | Error monitoring and crash reporting | Cloud |
| Redis (self-hosted/managed) | Session caching and job queues | Configured by deployment |

All sub-processors are contractually bound to process data only on our instructions and to maintain appropriate security standards.

### 9.2 Legal Requirements
We may disclose personal data if required to do so by law, court order, or the lawful request of a government authority in Ghana.

### 9.3 Business Transfers
If Cyborg Technologies is involved in a merger, acquisition, or asset sale, we will notify affected institutions before personal data is transferred and subject to a different Privacy Policy.

---

## 10. Data Security

We implement industry-standard security measures including:

- **Encryption in transit:** All data transmitted via HTTPS/TLS
- **Password hashing:** bcryptjs with appropriate salt rounds
- **JWT authentication:** Short-lived tokens (2h) with version invalidation on privilege changes
- **Rate limiting:** API endpoints protected against brute-force attacks
- **Multi-tenancy isolation:** All records scoped by `school_id`; cross-tenant access is architecturally prevented
- **Role-based access control:** 13 privilege keys with per-endpoint middleware enforcement
- **Audit logging:** Administrative actions are logged

No security system is impenetrable. In the event of a data breach that affects your rights and freedoms, we will notify the affected Institution and the Data Protection Commission of Ghana within 72 hours of becoming aware.

---

## 11. Data Retention

| Data Category | Retention Period |
|--------------|----------------|
| Active account data | Duration of subscription |
| Student academic records | Duration of subscription + 3 years |
| Financial/fee records | Duration of subscription + 7 years (tax compliance) |
| Server access logs | 90 days |
| Error/crash reports | 30 days |
| Data after termination | 30 days (then deleted unless legally required) |

Institutions may request earlier deletion subject to legal retention requirements.

---

## 12. Data Subject Rights

Under the Data Protection Act, 2012 (Act 843), individuals have the right to:

1. **Access** — Request a copy of personal data we hold about you
2. **Rectification** — Request correction of inaccurate data
3. **Erasure** — Request deletion of your personal data where permitted
4. **Restriction** — Request that we limit processing of your data
5. **Objection** — Object to processing based on legitimate interests
6. **Portability** — Receive your data in a structured, machine-readable format

To exercise any of these rights, contact us at **omarikwabs.ucchim@gmail.com**. We will respond within **21 working days**.

---

## 13. Cross-Border Data Transfers

Where data is processed by sub-processors outside Ghana, we ensure appropriate safeguards are in place consistent with Part VI of the Data Protection Act, 2012 (Act 843).

---

## 14. Changes to This Policy

We may update this Privacy Policy periodically. When we make material changes, we will:

- Post the updated policy on the Platform
- Update the "Last Updated" date at the top
- Notify Institution Administrators by email where the change is significant

Continued use of the Platform after the effective date of changes constitutes acceptance.

---

## 15. Contact Us

**Cyborg Technologies**
Email: omarikwabs.ucchim@gmail.com

For complaints about our handling of your personal data, you may also contact the **Data Protection Commission of Ghana**.

---

*© 2026 Cyborg Technologies. All rights reserved.*
