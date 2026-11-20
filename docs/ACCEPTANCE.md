# Acceptance and QA

## Implemented and checked

- [x] Public pages, initiative detail pages and localized route structure
- [x] Supplied logo and unchanged C2 illustrations, optimized for the web
- [x] Responsive desktop/mobile layouts and navigation
- [x] Published initiatives loaded from the relational backend
- [x] Draft save persists without changing public content
- [x] Publication updates the public snapshot; hidden sections and internal sources are redacted
- [x] Stale version saves are rejected
- [x] Authenticated preview for saved draft content
- [x] Anonymous access rejected for content, enquiries, media library, staff and audit endpoints
- [x] Server checks for separate content, publishing, settings, enquiries and staff permissions
- [x] Cross-origin mutation rejection
- [x] Unsafe URL rejection
- [x] Image signature/type/size restrictions and alternative text
- [x] Valid image upload persists and referenced images cannot be deleted
- [x] Valid contact enquiry persists in the protected inbox
- [x] Enquiry status/notes can be updated by authorized staff
- [x] Administrative actions recorded in audit history
- [x] Visitor enquiries require enabled intake and a published Privacy Policy page
- [x] Configurable launch URL, safe coming-soon LMS state
- [x] TypeScript check and deployable Worker build

The automated local integration suite contains 15 checks, including 13 page/SEO routes. It restores original content after the mutation tests. A clearly marked closed test enquiry remains only in the local development database. Visual checks cover a 1440 px desktop and 390 px mobile viewport, the initiative detail page, the CMS and the Myanmar fallback notice. These are practical checks, not an independent WCAG audit.

## Client acceptance and external configuration still required

- [ ] Final English copy and independent Myanmar translations/native review
- [ ] Approved mission, vision, background and objectives
- [ ] Official contacts, social channels, community imagery and reuse rights
- [ ] Final privacy policy, retention and enquiry deletion process
- [ ] Verified impact data, partner permissions and testimonials
- [ ] Live LMS destination and approved initiative launch status
- [ ] Public domain/DNS and desired public audience
- [ ] Independent staging environment
- [ ] Email notification provider and delivery verification
- [ ] Production backup policy, recovery rehearsal and monitoring owner
- [ ] Acceptance of platform-owned ChatGPT staff sign-in and D1/R2 hosting substitution
- [ ] Production staff sign-in using the approved administrator's account
- [ ] Independent security/accessibility review if required by client policy

These outstanding items are not described as completed. The initial private hosted review is distinct from an accepted public CCI launch. No quotation payment, commercial acceptance or LMS approval is implied by this delivery.
