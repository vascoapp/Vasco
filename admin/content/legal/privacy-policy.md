# Privacy Policy — Vasco

**Last updated:** May 9, 2026
**Effective date:** May 9, 2026

Vasco ("we," "us," "our") operates the Vasco mobile application (the "App"). This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our App.

By using the App, you agree to the collection and use of information as described in this policy.

---

## 1. Information We Collect

### 1.1 Account Information
When you create an account, we collect:
- Full name
- Email address
- Phone number (optional)
- Business/company name
- Trade type (e.g., plumbing, electrical, gas, carpentry, painting)
- Country of operation
- Preferred language

### 1.2 Business Information
To provide our services, we collect:
- Chamber of Commerce registration number (KvK, Companies House, etc.)
- VAT/tax registration number
- Business address
- Bank account details (IBAN, BIC) for invoice generation
- Insurance information and certification details
- Business branding (logo, company colors)

### 1.3 Customer Data You Enter
When you manage customers through the App:
- Customer names, email addresses, and phone numbers
- Customer business names and addresses
- Job site locations (including GPS coordinates when provided)
- Communication history and notes

When a customer phone number is present, the App may build a WhatsApp deep-link
(`https://wa.me/<E.164>?text=<message>`) so you can send pre-filled reminders to
your customer's WhatsApp. The link is only opened when you tap "approve" on a
queued automation. We do not transmit the phone number to WhatsApp ourselves —
the deep-link is opened by your device's operating system.

### 1.4 Job and Financial Data
- Job descriptions, schedules, and status
- Quotes, invoices, and payment records
- Time tracking entries (clock-in/clock-out times)
- Material costs and supplier information
- Photos of job sites (before, during, and after work)

### 1.5 Usage and Analytics Data
- App feature usage patterns
- AI insight interactions (viewed, expanded, dismissed, acted upon)
- Screen visit frequency
- Automation approval/rejection patterns (per workflow pack: queued, approved, dismissed, expired — used to compute pack health and improve template quality)
- Performance metrics (job completion rates, estimation accuracy)
- Cross-customer mute decisions you make on individual automations (stored
  on-device only; not synced to the server)

### 1.6 Device Information
- Device type and operating system version
- App version
- Language and locale settings
- Timezone

### 1.7 Push Notification Tokens
When you enable push notifications, we store an Expo Push token tied to your
device so we can deliver in-app reminders, payment receipts, and automation
nudges. The token contains no personal information and is rotated weekly.
You can revoke it at any time in your device settings.

---

## 2. How We Use Your Information

We use collected information to:

### 2.1 Core Service Delivery
- Manage your jobs, quotes, invoices, and customer relationships
- Generate PDF quotes and invoices with your business details
- Track time and materials for job costing
- Process payments through integrated payment providers
- Maintain compliance records and certification tracking

### 2.2 AI-Powered Features
- Generate personalized business insights and recommendations
- Predict quote acceptance probability, job duration, and payment timing
- Detect overdue invoices and suggest follow-up actions
- Analyze invoice photos to extract pricing data
- Provide material price comparisons and supplier recommendations
- Learn your preferences to prioritize relevant automation actions

### 2.3 Benchmarking (Anonymized)
- Compare your business performance against anonymized industry averages
- Provide regional pricing intelligence
- Generate trade-specific market insights

We **never** share your individual business data with competitors. Benchmarking data is aggregated and anonymized.

### 2.4 Service Improvement
- Improve AI model accuracy based on outcome tracking
- Enhance automation workflows based on usage patterns
- Fix bugs and optimize app performance

---

## 3. How We Store Your Data

### 3.1 Local Storage (On Your Device)
Most of your data is stored locally on your device using encrypted storage. This includes:
- Job, quote, invoice, and customer records
- Time tracking entries
- AI learning profile and preferences
- Automation configuration
- Clock-in/clock-out state

**Your data is accessible even without an internet connection.**

### 3.2 Cloud Storage (When Enabled)
When cloud sync is enabled, data is stored on our servers hosted by Supabase (AWS infrastructure in EU region):
- Account and business profile
- Job and financial records
- AI learning profiles (for cross-device sync)
- Business events for analytics

### 3.3 Data Retention
- **Active account data:** Retained as long as your account is active
- **Invoices and financial records:** 7 years (per EU tax law requirements)
- **Quotes and estimates:** 5 years
- **Job records:** 5 years after completion
- **AI learning data:** Retained while account is active; deleted within 30 days of account deletion
- **Analytics events:** 12 months, then anonymized

---

## 4. Third-Party Services

We share data with the following third-party services only as necessary to provide our features:

### 4.1 Supabase (Database & Authentication)
- **Purpose:** Cloud data storage, user authentication, real-time sync
- **Data shared:** Account information, business records, AI learning profiles
- **Location:** EU (AWS eu-west-1)
- **Privacy policy:** https://supabase.com/privacy

### 4.2 Mollie (Payment Processing — EU)
- **Purpose:** Generate payment links for your invoices (EUR)
- **Data shared:** Invoice amount, currency, customer email (when payment link is created)
- **Location:** Netherlands (EU)
- **Privacy policy:** https://www.mollie.com/privacy
- **Note:** Mollie integration is optional. No payment data is shared unless you actively create a payment link. Mollie webhook signatures are verified server-side; replays are deduplicated via an idempotency table so duplicate emails or push notifications do not fire.

### 4.2b Stripe (Payment Processing — UK)
- **Purpose:** Generate payment links for your invoices (GBP). Used only when your contractor country is set to UK.
- **Data shared:** Invoice amount, currency, customer email (when payment link is created)
- **Location:** Ireland (EU/EEA region)
- **Privacy policy:** https://stripe.com/privacy
- **Note:** Stripe integration is optional. Same idempotency contract as Mollie above.

### 4.3 Anthropic (AI Photo Analysis)
- **Purpose:** Analyze photos of invoices/receipts to extract line items and pricing
- **Data shared:** Compressed photos (800px max, 0.6 quality) sent to Claude Haiku Vision API via our server
- **Location:** US-based API, processing only (no data retention by Anthropic)
- **Privacy policy:** https://www.anthropic.com/privacy
- **Note:** Photos are only sent when you actively use the invoice scanning feature. Rate-limited to 1 analysis per 30 seconds.

### 4.4 Accounting Providers (Optional)
When you connect an accounting provider (Moneybird, DATEV, Lexoffice, etc.):
- **Data shared:** Invoices, quotes, customer records, payment information
- **Purpose:** Sync financial data with your accounting software
- **Note:** You control which provider is connected. No data is shared until you explicitly connect and authorize.

### 4.5 Expo (App Distribution + Push)
- **Purpose:** App updates, OTA hotfixes, and push notification delivery via Expo Push Service
- **Data shared:** Device type, app version, Expo push token
- **Privacy policy:** https://expo.dev/privacy

### 4.6 Resend (Email Delivery)
- **Purpose:** Send invoices, payment reminders, and account emails to your customers
- **Data shared:** Recipient email, invoice/quote PDF attachments, message body
- **Location:** US-based with EU sub-processors
- **Privacy policy:** https://resend.com/legal/privacy-policy
- **Note:** Email content is queued for one-tap approval before sending. We do not auto-send emails on your behalf.

### 4.7 Sentry (Error Reporting — Optional)
- **Purpose:** Capture production crashes and runtime errors so we can fix them
- **Data shared:** Stack traces, breadcrumbs (route trail + significant in-app actions like "invoice_sent", "invoice_paid"), user ID (anonymous UUID), device + OS
- **Location:** US-based; EU data residency available
- **Privacy policy:** https://sentry.io/privacy/
- **Note:** Sentry runs only when an error occurs. We do not log message bodies, customer names, financial amounts, or PDF content in error reports.

---

## 5. Your Rights (GDPR)

Under the General Data Protection Regulation (GDPR), you have the right to:

### 5.1 Access
Request a copy of all personal data we hold about you.

### 5.2 Rectification
Correct any inaccurate personal data.

### 5.3 Erasure ("Right to Be Forgotten")
Request deletion of your personal data. We will delete your data within 30 days, except where retention is required by law (e.g., tax records for 7 years).

### 5.4 Data Portability
Export your data in a machine-readable format (CSV/JSON).

### 5.5 Restriction of Processing
Request that we limit how we use your data.

### 5.6 Object to Processing
Object to our processing of your data for specific purposes, including AI-powered features.

### 5.7 Withdraw Consent
Withdraw consent for optional data processing at any time through the App settings.

### 5.8 Lodge a Complaint
File a complaint with your local data protection authority:
- **Netherlands:** Autoriteit Persoonsgegevens (AP)
- **Germany:** Bundesbeauftragte für den Datenschutz (BfDI)
- **France:** Commission Nationale de l'Informatique et des Libertés (CNIL)
- **Spain:** Agencia Española de Protección de Datos (AEPD)
- **Italy:** Garante per la protezione dei dati personali
- **UK:** Information Commissioner's Office (ICO)

To exercise any of these rights, contact us at **privacy@vascobuild.com**.

---

## 6. Data Security

We implement the following security measures:
- **Encryption at rest:** All local data stored using device-encrypted storage
- **Encryption in transit:** All network communications use TLS 1.2+
- **Authentication:** Secure token-based authentication via Supabase Auth
- **Access control:** Role-based access within the App
- **Photo compression:** Images are compressed before processing to minimize data exposure
- **Rate limiting:** AI analysis requests are rate-limited to prevent abuse

---

## 7. Children's Privacy

The App is not intended for use by individuals under 16 years of age. We do not knowingly collect personal data from children. If we become aware that we have collected data from a child under 16, we will delete it promptly.

---

## 8. International Data Transfers

Your data may be transferred to and processed in countries outside your country of residence:
- **Supabase servers:** EU (AWS eu-west-1, Ireland)
- **Anthropic API:** United States (for photo analysis only, no data retention)

For transfers outside the EU/EEA, we rely on:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- Adequacy decisions where applicable

---

## 9. Cookies and Tracking

The App does not use cookies. We do not use third-party advertising or tracking services. Analytics are collected internally for service improvement only.

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of material changes through the App or via email. Your continued use of the App after changes constitutes acceptance of the updated policy.

---

## 11. Contact Us

For privacy-related questions, data access requests, or complaints:

**Email:** privacy@vascobuild.com
**Address:** [Your registered business address]
**Data Protection Officer:** [Name, if appointed]

For general support: support@vascobuild.com
**Website:** https://vascobuild.com
