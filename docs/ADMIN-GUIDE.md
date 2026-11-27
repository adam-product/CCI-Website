# CCI staff guide

## Sign in

Open `/admin` and sign in with your staff email and password. If you received an invitation, use it within 24 hours to confirm your email and set a password of at least 15 characters. If a Super Administrator issued a temporary password, sign in with it to choose your permanent password.

Choose **Forgot password?** on the sign-in page and enter your staff email. Open the reset email within 20 minutes, choose a new password and sign in again. If reset emails are unavailable, ask a Super Administrator for help.

Under **Staff Access**, a Super Administrator can enter a staff email and assign a role. To create credentials manually, turn on **Set a temporary password manually**, enter and confirm a password of at least 15 characters, and select **Create staff account**. Share the password privately. It expires after 24 hours and must be replaced on first sign-in. **Save access** generates a temporary password for an account without credentials. **Send invitation** is available when email delivery is configured, and **Resend invitation** issues a fresh link for a pending account. Resetting a password or disabling an account revokes its existing session.

## Edit and publish

1. Choose Pages, Our Initiatives, Impact or Settings.
2. Open a record. English and Myanmar have independent fields; select the language above the form.
3. Edit copy, imagery and approved links. Supply alt text when assigning an image.
4. Add editorial sections, set their order and choose whether each section is visible.
5. Select **Save draft**. The public site remains unchanged.
6. Open **Preview saved draft**. This authenticated preview shows saved content only.
7. A Publisher or Super Administrator selects **Publish saved draft** to publish the reviewed draft. For changes still in the editor, select **Save and publish**, then confirm. Public pages reload the latest published content when reopened or revisited.

If a record changed in another session, reload it before saving. The version check protects other editors' work. Unsaved text is not included by the preview or publish buttons. Unpublishing removes a page/initiative from public content and preserves its draft. Website settings cannot be unpublished.

Home hero labels and metadata can be edited, with default labels used when blank. Homepage editorial sections follow their display order. The featured initiatives and impact appear after the introduction when it is visible. Website Settings sections appear at the foot of each public page. The Our Initiatives card order and featured checkbox control the listing and homepage selection.

## Launch Way Way Shaung

Edit the Way Way Shaung initiative. Add the approved production HTTPS URL, change the initiative status to Active, save and publish. Before a URL is approved, leave it blank; the page stays usable with a coming-soon message. This action links to a separately operated LMS and does not deploy learning features.

## Media

In the content editor, select **Choose file** to upload and attach the image to your draft automatically. Describe the image in the alternative text field when available. A blank field uses the record title, and section images use their heading. Save the draft and publish the record when ready. To upload directly to the Media Library, enter alternative text before choosing a file. Uploads accept PNG, JPEG and WebP up to 4 MB on Vercel and 5 MB on the Worker. Uploading a replacement creates a new asset. To delete an old image, first remove its references from published content and drafts.

## Impact and optional sections

Add a metric only after its figure, unit, measurement period and source are approved. The source is internal and is not exposed by the public API. Stories, partner imagery, testimonials and galleries can use editorial sections and uploaded media; keep them hidden until approved. No statistics or partner/testimonial claims are seeded.

## Contact enquiries

First publish the approved Privacy Policy page. In Settings, enable **Client has approved the published privacy policy**, save and publish. This opens the form. Contact information and social links remain blank until supplied.

The form stores valid enquiries in the protected inbox. It does not currently send email notifications. Use Enquiries to review a message, select New/In Review/Responded/Closed, add internal notes and save. Notes and sender data are never exposed publicly. Do not collect sensitive scam evidence through this general contact form. Retention and deletion processes must be agreed before public launch.

## Staff

A Super Administrator can add a staff email, choose a role and enable it. Staff must use that same email at sign-in. Disable a row to revoke future API access. CCI roles do not grant access to LMS learner records. The initial administrator is managed by the protected runtime environment configuration and cannot be replaced through an ordinary staff row.

## Final content review

Use **Ask search engines to skip this site** in Settings while reviewing site content. Draft previews show a private staff notice.

## Test the contact form

Open **Enquiries**, then select **Test contact form**. Enter sample details and submit. The inbox labels the new entry with `[TEST]`. Open the entry to review the message, add notes, and update its status. Staff testing is available before the public contact form opens.

## Website contact details and social channels

In **Settings**, set **Public contact email** and add the official URLs in **Social media channels**. Publish the settings to update Contact Us and the footer. Empty channels stay hidden. **Accept real contact form enquiries** controls visitor intake while the Privacy Policy page is published. Authorized staff review submissions under **Enquiries**.

## Way Way Shaung partners and testimonials

Edit **Way Way Shaung** in **Our Initiatives** and add a page section. For a **Partner logo**, enter the approved partner name and use an approved image from Media Library. A link is optional. For a **Testimonial**, enter the approved quotation and its attribution. Preview the changes before publishing. Each group appears on the public page once it has a visible entry with its logo or quotation.
