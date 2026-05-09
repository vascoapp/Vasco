# GDPR Data Subject Request Process — Vasco

**Last updated:** May 9, 2026

## How to Submit a Request

Data subjects (your customers, employees, contacts) can exercise their GDPR rights by contacting:

**Email:** privacy@vasco.app
**Response time:** Within 30 days of receipt

## Request Types

### Right of Access (Article 15)
- We will provide a copy of all personal data we hold
- Format: JSON or CSV export
- Free of charge for the first request; reasonable fee for excessive/repetitive requests

### Right to Rectification (Article 16)
- We will correct inaccurate data within 7 business days
- The contractor (data controller) will be notified of corrections

### Right to Erasure (Article 17)
- In-app: Settings → Account → "Delete my account" inserts a row into `account_deletion_requests`. A background worker (`drain-account-deletions`, scheduled daily at 02:00 UTC) processes pending rows in batches of 50 — erases user-owned data, anonymises tax-retained rows (7-year retention per legal obligation), calls `auth.admin.deleteUser`, and marks the request `done`.
- Out-of-band: email privacy@vasco.app — same SLA.
- Personal data will be deleted within 30 days.
- **Exceptions:** Data required for legal obligations (invoices/tax records: 7 years), ongoing disputes, or legitimate business interests. Anonymised tax records carry no identifying personal data.
- The contractor (controller) will be notified of deletion.

### Right to Data Portability (Article 20)
- Data provided in machine-readable format (JSON/CSV)
- Includes: contact info, job records, financial data, interaction history

### Right to Restriction (Article 18)
- Processing will be limited while accuracy is contested or erasure is pending
- Data will be stored but not actively processed

### Right to Object (Article 21)
- Processing for AI personalization can be opted out
- Direct marketing can be opted out at any time

## Internal Process

1. **Receive request** → Log in request tracker
2. **Verify identity** → Confirm requestor is the data subject (email verification)
3. **Assess scope** → Determine which data is affected
4. **Execute** → Fulfill the request
5. **Notify controller** → Inform the contractor who entered the data
6. **Confirm** → Send confirmation to the data subject
7. **Document** → Log the completed request

## Contact

**Data Protection Officer:** privacy@vasco.app
