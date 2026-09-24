# GDPR Data Subject Request Process — Vasco

**Last updated:** May 9, 2026

## How to Submit a Request

Data subjects (your customers, employees, contacts) can exercise their GDPR rights by contacting:

**Email:** privacy@vascobuild.com
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
- In-app: Profile → "Delete my account" opens one deletion screen. It first shows the contractor their OWN record-keeping duty (per country) and offers the records download; an acknowledgement is required before the request can be sent. The request is a row in `account_deletion_requests`; a background worker (`drain-account-deletions`, daily at 02:00 UTC and triggered immediately on request) erases all user-owned data — invoices included — calls `auth.admin.deleteUser`, and marks the request `done`. Only a minimal record that the erasure happened (no content, the free-text reason cleared) is kept, for 3 years.
- Out-of-band: email privacy@vascobuild.com — same SLA.
- Personal data will be deleted within 30 days.
- **Record keeping is the contractor's duty.** Invoices and accounting records must be kept by the contractor's business for the period its tax law requires; Vasco does not retain them after account deletion, which is why the export is offered first. Exceptions to erasure: ongoing disputes.
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

**Data Protection Officer:** privacy@vascobuild.com
