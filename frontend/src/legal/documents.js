// Version string is stored against each user's acceptance record. Bump it
// whenever these documents change materially -- that's what lets you tell
// which users agreed to which version, and who needs to re-accept.
export const POLICY_VERSION = "2026-07-30";

// These are the published Privacy Policy and Terms of Use, rendered at
// /legal/privacy and /legal/terms and required to be accepted at signup.
// They describe the application's actual behaviour -- the data collected,
// how advertising is targeted, what is and isn't shared with advertisers,
// and how consent is recorded. Keep them in step with the code: if you
// change what the product does with user data, update these too and bump
// POLICY_VERSION so existing users are asked to re-accept.

export const PRIVACY_POLICY = `# Privacy Policy

**Last updated: ${POLICY_VERSION}**

This policy explains what NexgenSocial collects, why, and what control you have. It describes how the service actually works — please read it before creating an account.

## 1. Who we are

NexgenSocial is operated by Corverxis Technologies ("we", "us"). For privacy questions, contact us at the address listed in Section 12.

## 2. What we collect

**Information you give us directly**

- **Account details:** email address, username, display name, and a password (stored only as a bcrypt hash — we never store or have access to your actual password).
- **Optional profile details:** birth date, gender, relationship status, occupation, education, city and country, timezone, whether you have children, bio, profile photo, and interests. Every one of these is optional. You can use the service without providing any of them.
- **Content you create:** posts, threads, comments, reels, videos, photos, group posts, marketplace listings, newsroom articles, political page content, job postings, and job applications.
- **Places you save:** only places you explicitly add. We do **not** track your location in the background. If you use the "current location" button, your device provides coordinates at that moment only.
- **Job application materials:** cover letters and any resume you upload.

**Information collected automatically**

- **Usage of ads:** if you have enabled behavioral tracking (off by default), we record which ads you saw and clicked.
- **Basic technical data** necessary to operate the service, such as your authentication session.

**Information we do NOT collect**

- We do not track your location in the background.
- We do not read your contacts, messages on other services, or files.
- Your screen-time statistics are calculated and stored **entirely in your own browser**. They are never sent to our servers.

## 3. How we use it

- To operate the service: showing your content to the audience you chose, delivering your feed, and letting people find and interact with you.
- **To show advertising.** NexgenSocial is free and funded by ads. How ads are chosen depends on settings you control:
  - If **interest-based targeting is off** (the default), you see untargeted ads only.
  - If you **turn it on**, we use your demographics and interests to select which ads to show you. This happens on our servers; advertisers do not receive your profile.
- To measure ad performance for advertisers, in aggregate.
- To keep the service safe and enforce our Terms.

## 4. What we share — and what we never share

**We do not sell your personal information. We do not give advertisers your individual profile.**

Advertisers can:
- Choose audience criteria (for example: age 25–34, interested in fitness, in Ohio) and have us show their ad to matching people.
- See aggregate results: impression counts, clicks, conversion rates, and estimated audience size.

Advertisers cannot:
- See who you are, obtain your profile, or receive any list of individuals.
- Access any figure covering fewer than 25 people. Below that threshold we suppress the number entirely, because small counts combined with narrow targeting can identify individuals.

**Other recipients:**
- **Service providers** that host our infrastructure and database, strictly to run the service.
- **Legal disclosure** where we are required by law to produce information.
- **Public content:** anything you post publicly (public posts, reels, marketplace listings, newsroom articles, political pages, job postings) is visible to anyone. Political advertising additionally appears permanently in our public ad archive, including after a campaign ends — this is a transparency requirement, and it applies to political ads only.

## 5. Your choices and controls

- **Audience per post:** public, followers, friends, or a custom circle you define.
- **Ad settings:** interest-based targeting, behavioral tracking, and inclusion in aggregate audience counts are each separately controlled, and all default to **off**.
- **Feed algorithm:** you can adjust how much your feed weights recency, engagement, and diversity.
- **Export your data:** one click, any time, from your profile. You get a complete JSON file of your account.
- **Delete your account:** contact us and we will delete your account and associated personal data, subject to Section 7.
- **Places:** private by default; you choose which to make public.

## 6. Legal bases (for users in the EEA/UK)

Where GDPR applies, we rely on: **contract** (to provide the service you signed up for), **consent** (for interest-based targeting, behavioral tracking, and aggregate insights — each opt-in), **legitimate interests** (security, preventing abuse), and **legal obligation** (political ad transparency, responding to lawful requests). Where we rely on consent you may withdraw it at any time in your settings, without losing access to the service.

You also have rights of access, rectification, erasure, restriction, portability, and objection, and the right to complain to your local supervisory authority.

## 7. How long we keep things

- Account data: until you delete your account.
- Content: until you delete it or your account.
- **Political ads: permanently**, in the public archive. This is deliberate and required for transparency — do not run a political ad expecting it to be removable.
- Ad event records: retained for advertiser billing and reporting; disassociated from your account where you have not consented to behavioral tracking.

## 8. Children

NexgenSocial is not for anyone under 13, and we block registration where a stated birth date indicates an age under 13. If we learn we have collected data from a child under 13, we will delete it.

## 9. Security

Passwords are hashed with bcrypt. Traffic is encrypted in transit. No system is perfectly secure, and we cannot guarantee absolute security.

## 10. International transfers

Our infrastructure is hosted in the United States. If you access the service from elsewhere, your information is transferred to and processed there.

## 11. Changes

We will update this policy as the service changes. Material changes will be notified in the product, and the version date at the top will change.

## 12. Contact

Corverxis Technologies
6500 Emerald Parkway
Dublin, Ohio 43016
United States
`;

export const TERMS_OF_USE = `# Terms of Use

**Last updated: ${POLICY_VERSION}**

By creating an account you agree to these terms. Please read them.

## 1. Eligibility

You must be at least 13 years old. If you are under the age of majority where you live, you may only use NexgenSocial with a parent or guardian's involvement. You must provide accurate registration information.

## 2. Your account

You are responsible for your account and for keeping your password secure. Tell us promptly if you believe your account has been compromised. Do not impersonate another person or organization.

## 3. Your content

You keep ownership of everything you post. By posting, you grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, and display your content **for the purpose of operating and promoting the service**, and to distribute it to the audience you selected. This licence ends when you delete the content, except where it has been shared by others or where retention is required (see the political advertising archive).

You are responsible for what you post. You confirm you have the rights to it.

## 4. What you may not do

Do not:
- Post content that is unlawful, harassing, hateful, threatening, or that incites violence.
- Post sexual content involving minors, or any content that exploits or endangers children. This results in immediate termination and referral to authorities.
- Infringe anyone's copyright, trademark, or other rights — including uploading music or video you do not have the rights to use.
- Impersonate people or organizations, or misrepresent who funds a political page or advertisement.
- Post malware, attempt to breach the service's security, scrape it at scale, or interfere with its operation.
- Use the service to defraud people, including through fake marketplace listings or fraudulent job postings.
- Post discriminatory job advertisements (see Section 7).

## 5. Advertising

The service is free and supported by advertising. You will see ads. What data informs those ads is governed by your privacy settings and our Privacy Policy.

**Political advertising** carries additional obligations. If you run one, you must provide a truthful "Paid for by" disclosure, and you accept that the ad — including that disclosure, your declared spend, and its performance — is published permanently in our public archive, including after it stops running. Providing false funding information is a serious breach of these terms and may also breach election law where you operate.

## 6. Marketplace

We provide a venue; we are not a party to transactions between users. We do not verify listings, inspect goods, process payments, or guarantee that any transaction completes. Sellers must accurately describe items and comply with applicable consumer and sales law. Meeting strangers to complete a transaction carries real risk — use your judgment.

## 7. Jobs

Employers and recruiters posting roles are solely responsible for the legality of their postings, and confirm that they:
- Do not discriminate on the basis of race, colour, religion, sex, national origin, age, disability, genetic information, or any other characteristic protected where the role is located.
- Comply with pay transparency laws that apply to them. Several jurisdictions — including California, Colorado, New York, and Washington — require a good-faith salary range in job postings, and comparable duties apply in the EU. We provide salary range fields for this purpose.
- Are advertising genuine, currently available roles.
- Handle applicant data lawfully, including any resume and cover letter received.

We do not verify employers, screen postings, or guarantee that any role or applicant is genuine. **Never pay money to apply for a job, and treat any request for payment or bank details as a fraud signal.**

We are not an employment agency, and we are not a party to any employment relationship formed through the service.

## 8. Live streaming

You are responsible for what you broadcast. Do not stream illegal activity, content you lack the rights to, or people who have not consented to being broadcast.

## 9. Termination

You may delete your account at any time. We may suspend or terminate accounts that breach these terms, and we will remove content that does — including content that endangers children, at once and without notice.

## 10. Disclaimers

The service is provided "as is" and "as available", without warranties of any kind to the fullest extent the law allows. We do not warrant it will be uninterrupted, secure, or error-free. Content posted by other users is theirs, not ours, and we do not endorse it.

## 11. Limitation of liability

To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill. Nothing here excludes liability that cannot lawfully be excluded — including, in many jurisdictions, liability for death or personal injury caused by negligence, or for fraud.

## 12. Changes

We may update these terms. Material changes will be notified in the product, and continued use afterwards means you accept them.

## 13. Governing law

These terms are governed by the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Disputes are subject to the state and federal courts located in the State of Delaware. Where you have mandatory rights under the law of your country of residence, this does not remove them.

## 14. Contact

Corverxis Technologies
6500 Emerald Parkway
Dublin, Ohio 43016
United States
`;
