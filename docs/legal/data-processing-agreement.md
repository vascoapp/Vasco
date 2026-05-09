# Data Processing Agreement (DPA) — Vasco

**Last updated:** May 9, 2026

This Data Processing Agreement ("DPA") supplements the Vasco Terms of Service and Privacy Policy. It applies when Vasco processes personal data on behalf of its users under the General Data Protection Regulation (GDPR).

---

## 1. Definitions

- **Controller:** You (the contractor/business using the App)
- **Processor:** Vasco (processing data on your behalf)
- **Data Subject:** Your customers, employees, or contacts whose data is processed through the App
- **Personal Data:** Any information relating to an identified or identifiable person

---

## 2. Scope and Purpose

Vasco processes personal data on your behalf for:
- Managing customer contact information
- Creating and sending quotes and invoices
- Processing payment requests
- Providing AI-powered business insights
- Tracking job schedules and time entries
- Managing compliance records

---

## 3. Data Processing Details

| Category | Data Types | Purpose | Retention |
|----------|-----------|---------|-----------|
| Customer contacts | Name, email, phone, address | CRM, invoicing | Account lifetime |
| Financial records | Invoices, quotes, payments | Business management | 7 years (tax law) |
| Job records | Descriptions, schedules, photos | Job management | 5 years |
| Time tracking | Clock-in/out, hours worked | Payroll, costing | 5 years |
| AI learning | Interaction patterns, preferences | Personalization | Account lifetime |

---

## 4. Processor Obligations

Vasco shall:
- Process personal data only on your documented instructions
- Ensure all personnel with access are bound by confidentiality
- Implement appropriate technical and organizational security measures
- Not engage sub-processors without your prior written consent (general consent given for services listed in Section 5)
- Assist you in responding to data subject requests
- Delete or return all personal data upon termination, unless retention is required by law
- Make available all information necessary to demonstrate compliance
- Allow for and contribute to audits

---

## 5. Authorized Sub-Processors

You provide general authorization for the following sub-processors:

| Sub-Processor | Purpose | Location | Safeguards |
|--------------|---------|----------|------------|
| Supabase Inc. | Database hosting, authentication, edge functions | EU (AWS Ireland) | SCCs, SOC 2 |
| Mollie B.V. | Payment processing (EU contractors, EUR) | Netherlands | PCI DSS, GDPR compliant |
| Stripe Payments Europe Ltd. | Payment processing (UK contractors, GBP) | Ireland | PCI DSS, GDPR compliant |
| Resend Inc. | Transactional email (invoices, reminders) | USA + EU | SCCs, SOC 2 |
| Anthropic PBC | Photo analysis (Claude Vision) | USA | SCCs, no data retention |
| Functional Software Inc. (Sentry) | Error reporting (optional) | USA | SCCs, EU residency available |
| Expo Inc. | Push notification delivery, OTA updates | USA | SCCs |
| Amazon Web Services | Infrastructure (via Supabase) | EU (Ireland) | SCCs, ISO 27001 |

We will notify you of any changes to sub-processors at least 30 days in advance. You may object to a new sub-processor by contacting us within 14 days.

---

## 6. Security Measures

Vasco implements:
- **Encryption:** TLS 1.2+ in transit; AES-256 at rest (via Supabase/AWS)
- **Access control:** Role-based access; principle of least privilege
- **Authentication:** Token-based authentication with secure session management
- **Monitoring:** Automated security monitoring and alerting
- **Incident response:** 72-hour breach notification to Controllers
- **Data minimization:** Photo compression before processing; rate-limited API calls
- **Backup:** Automated daily backups with point-in-time recovery

---

## 7. Data Subject Rights

When you receive a data subject request (access, rectification, erasure, portability, restriction, objection), we will:
- Assist you in fulfilling the request within required timeframes
- Provide technical capabilities for data export and deletion
- Not respond directly to data subjects unless instructed by you

---

## 8. Data Breach Notification

In the event of a personal data breach, we will:
- Notify you without undue delay (within 72 hours of becoming aware)
- Provide details of the breach (nature, categories of data, approximate number of data subjects, consequences, measures taken)
- Cooperate with your notification obligations to supervisory authorities and data subjects

---

## 9. International Transfers

For data transfers outside the EU/EEA:
- We rely on Standard Contractual Clauses (SCCs) approved by the European Commission
- Supplementary measures are implemented where required
- Transfer impact assessments are conducted for high-risk transfers

---

## 10. Audit Rights

You may:
- Request documentation of our compliance with this DPA
- Conduct or commission an audit (with reasonable notice and during business hours)
- We will cooperate with supervisory authority inspections

---

## 11. Term and Termination

This DPA remains in effect for the duration of our processing of personal data on your behalf. Upon termination of the service agreement:
- We will delete all personal data within 30 days
- We will provide a data export upon request
- Retention beyond 30 days only where required by applicable law

---

## 12. Contact

**Data Protection Contact:** privacy@vasco.app
**Legal Contact:** legal@vasco.app
