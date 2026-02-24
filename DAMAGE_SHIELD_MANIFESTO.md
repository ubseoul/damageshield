# DAMAGE SHIELD — TECHNICAL MANIFESTO
### For the next engineer, AI, or collaborator who works on this product

---

## WHAT THIS IS

Damage Shield is a mobile-first SaaS tool that lets solo auto detailers document pre-existing vehicle damage before a job starts. The client signs on screen. Both parties receive a timestamped, signed PDF via email within 60 seconds. That PDF is the product.

The business insight: detailers are regularly blamed for damage they didn't cause. Existing solutions are either unorganized camera rolls or $150/month enterprise software built for 10-person shops. Damage Shield does one thing for $20/month. That's the entire strategy.

**Live URL:** https://www.damageshield.org  
**Vercel alias:** https://damageshield.vercel.app  
**Owner:** Prince Ube (princeubearchives@gmail.com)

---

## PHILOSOPHY

**Ship Over Perfect.** This product was built in a single session. Every decision was made to minimize complexity while maximizing the experience at the moment that matters most — a detailer standing in a driveway, handing their phone to a client. That moment must feel professional, fast, and trustworthy. Everything else is secondary.

**Taste is the Moat.** The only reason a detailer uses this instead of their iPhone camera is because the interface is fast, beautiful, and looks legitimate in front of a client. The HCI and design quality is the differentiator, not just decoration.

**Revenue is Oxygen.** Every technical decision traces back to getting to $10K MRR. No feature exists that doesn't serve that goal.

---

## ARCHITECTURE OVERVIEW

```
Browser (index.html)
    ↓ Auth / Data
Supabase (PostgreSQL + Auth + RLS)
    ↓ Report submit
Supabase Edge Function (Deno runtime)
    ↓ Email
Resend API
    ↓ Sends to
Detailer + Client (identical PDF attachment)
```

### Why this stack

- **Zero cost at zero users.** Supabase free tier, Vercel free tier, Resend free tier. Monthly burn at launch: $0.
- **Single file frontend.** No React, no build tools, no npm, no bundler. One `index.html` deployed to Vercel via GitHub. This was a deliberate constraint — it means any developer can open the file, understand the entire product, and ship a fix in minutes.
- **Deno Edge Function.** PDF generation and email sending happens server-side so API keys are never exposed to the browser. The Edge Function is the only server-side code in the entire product.

---

## FILE STRUCTURE

```
damageshield/
├── index.html                          ← Entire frontend (single file)
├── supabase/
│   ├── schema.sql                      ← Database setup (run once in Supabase SQL editor)
│   └── functions/
│       └── send-report/
│           └── index.ts               ← Edge Function (Deno, handles PDF + email)
└── DAMAGE_SHIELD_MANIFESTO.md         ← This file
```

---

## FRONTEND (index.html)

### Structure

Five screens rendered as `div` sections, shown/hidden with `display: none` / `display: block`:

| Screen ID | Purpose |
|---|---|
| `#screen-landing` | First visit — value prop, CTA to sign up |
| `#screen-auth` | Tabbed signup / login (Supabase Auth) |
| `#screen-dashboard` | Report history, usage counter, New Report button |
| `#screen-report` | 4-step report builder |
| `#screen-success` | Animated confirmation after send |

### Report Builder — 4 Steps

| Step | Fields |
|---|---|
| 1 — Client & Vehicle | Client name, client email, make/model, year, colour |
| 2 — Damage Items | Type dropdown, location dropdown, photo (camera capture), notes. Multiple items supported. |
| 3 — Signature | HTML5 canvas signature pad, touch-enabled |
| 4 — Review & Send | Read-only summary before final submission |

### Key JavaScript globals

```javascript
let currentUser = null;          // Supabase auth user object
let currentStep = 1;             // Active step in report builder
const totalSteps = 4;
let damageItems = [];            // Array of { id, type, location, notes, photoDataUrl }
let sigCanvas, sigCtx;           // Signature canvas references
let isDrawing = false;           // Drawing state for signature
let signatureData = null;        // Base64 PNG of completed signature
```

### Supabase client initialization

```javascript
const SUPABASE_URL = 'https://mzhnclfxvlrrkgpbqjuy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // full key in file
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Critical naming note:** The Supabase client is named `sb` throughout the codebase, NOT `supabase`. This was changed to avoid a namespace conflict with the `window.supabase` CDN global. Any future code must use `sb` when calling the Supabase client. Using `supabase` will throw `TypeError: supabase.from is not a function`.

### Signature pad — critical fix history

The signature pad had a bug where nothing drew on mobile. Root cause: `initSignaturePad()` was called when the step was hidden, so `canvas.offsetWidth` returned 0, making the canvas invisible (zero-width). 

**The fix:** `initSignaturePad()` is now called with `setTimeout(initSignaturePad, 150)` when navigating to step 3, giving the DOM time to render. The canvas width is set from `sigCanvas.parentElement.clientWidth || (window.innerWidth - 40)`.

The function also clones and replaces the canvas element on each call to prevent duplicate event listener accumulation across multiple visits to step 3:

```javascript
const old = document.getElementById('signature-canvas');
const fresh = old.cloneNode(true);
old.parentNode.replaceChild(fresh, old);
```

### Image compression

Photos are compressed client-side before storing in memory to keep payload sizes manageable for the Edge Function:

```javascript
function compressImage(dataUrl, maxWidth, callback) {
  // Resizes to 800px max width, JPEG at 0.75 quality
  // Runs entirely in browser, no upload required
}
```

### Paywall logic

The free tier allows 5 sent reports. The count is tracked in the `reports` table in Supabase. When a user attempts to send their 6th report, a modal appears before the API call is made. Form data is preserved — the user is never blocked mid-flow in front of a client. Stripe payment link opens in a new tab.

```javascript
// In sendReport():
const { count } = await sb.from('reports')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', currentUser.id);

if (count >= 5) {
  showPaywall(); // Show modal, preserve state, don't send
  return;
}
```

### Design system

- **Fonts:** Playfair Display (headings, loaded from Google Fonts), DM Sans (body)
- **Primary colour:** `#c8892a` (warm gold)
- **Background:** `#1a1a1a` (near-black)
- **Surface:** `#242424`, `#2a2a2a` (layered dark)
- **Text:** `#f0ece4` (warm white)
- **Aesthetic:** "Study room" — dark, premium, cozy. Designed to look professional on a luxury car client's level.

---

## SUPABASE

### Project reference
`mzhnclfxvlrrkgpbqjuy`

### Database schema

```sql
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  vehicle_make_model TEXT,
  vehicle_year TEXT,
  vehicle_colour TEXT,
  damage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own reports"
  ON reports FOR ALL
  USING (auth.uid() = user_id);
```

**Important:** Photos are NOT stored in the database. They are passed as base64 strings directly in the Edge Function payload and embedded inline in the HTML email/PDF. This keeps the database lean and avoids Supabase storage costs.

### Auth configuration

- Email confirmation: **DISABLED** (toggled off in Supabase Dashboard → Authentication → Settings). Users sign up and land directly in the dashboard with no email confirmation step. This was a deliberate UX decision for conversion — confirmation emails created a dead-link frustration for new users.
- Redirect URLs configured: `https://www.damageshield.org` and `https://damageshield.vercel.app`

---

## EDGE FUNCTION (send-report/index.ts)

### Runtime
Deno (not Node.js). This is critical. Any Node.js-specific APIs will fail silently or throw errors.

### Known Deno gotcha — Buffer is undefined

`Buffer` does not exist in Deno. Any base64 encoding must use the browser/Deno native `btoa()` with unicode handling:

```typescript
// WRONG — throws "Buffer is not defined"
content: Buffer.from(htmlContent).toString('base64')

// CORRECT — works in Deno
content: btoa(unescape(encodeURIComponent(htmlContent)))
```

### What the Edge Function does

1. Receives POST request from frontend with full report payload (JSON)
2. Builds a complete HTML document (dark-themed, gold accents, matches app aesthetic)
3. Embeds all damage photos as inline `<img src="data:image/jpeg;base64,...">` tags
4. Embeds signature as inline `<img>` tag
5. Includes full legal contract (5 sections)
6. Calls Resend API twice — once to detailer, once to client
7. Both emails contain identical HTML document as attachment (filename: `damage-report-[ID].html`)
8. Returns `{ success: true, reportId }` to frontend

### Payload shape (frontend → Edge Function)

```typescript
{
  detailerName: string,
  detailerEmail: string,
  clientName: string,
  clientEmail: string,
  vehicleInfo: {
    makeModel: string,
    year: string,
    colour: string
  },
  damageItems: Array<{
    type: string,
    location: string,
    notes: string,
    photoDataUrl: string | null   // base64 JPEG, may be null if no photo
  }>,
  signatureDataUrl: string,        // base64 PNG
  reportId: string,                // Format: DS-XXXXXXXX-XXXX
  timestamp: string                // ISO 8601
}
```

### Environment secrets

Set via `supabase secrets set KEY=value`, accessed in Deno as `Deno.env.get('KEY')`:

| Key | Value |
|---|---|
| `RESEND_API_KEY` | `re_BSVZfrJG_5Mk7LKVui6G3nmtMU7TUrF2i` |
| `FROM_EMAIL` | `support@damageshield.org` |

### Deployment command

```bash
supabase functions deploy send-report --no-verify-jwt
```

`--no-verify-jwt` is required. The frontend sends the report payload without a JWT in the Authorization header (the user is authenticated client-side but the Edge Function doesn't need to verify it — the user_id is pulled from the payload and the report is saved to the database separately by the frontend after a successful send).

---

## EMAIL

### Provider
Resend (resend.com)

### Domain
`damageshield.org` — verified in Resend with DNS records in Porkbun:
- `TXT resend._domainkey` — DKIM verification
- `MX send` → `feedback-smtp.us-east-1.amazonses.com` (priority 10)
- `TXT send` → `v=spf1 include:amazonses.com ~all`
- `TXT _dmarc` → `v=DMARC1; p=none;`

### Sending address
`support@damageshield.org`

### Two emails per report

**Email 1 — To detailer:**
- Subject: "Report Delivered Successfully — [Client Name]'s [Vehicle]"
- Body: confirmation that the report was sent, summary of details
- Attachment: full HTML document

**Email 2 — To client:**
- Subject: "Your Vehicle Condition Report — [Vehicle]"
- Body: explains what the document is, reassures them it protects both parties
- Opens with: "Hi [Client Name],"
- Attachment: same full HTML document

---

## DOMAIN & DNS

### Registrar
Porkbun

### Full DNS record set (Porkbun)

| Type | Host | Answer | Priority |
|---|---|---|---|
| A | damageshield.org | 216.198.79.1 | — |
| CNAME | www.damageshield.org | 5046c1cba05fc314.vercel-dns-017.com. | — |
| MX | damageshield.org | fwd1.porkbun.com | 10 |
| MX | damageshield.org | fwd2.porkbun.com | 20 |
| MX | send.damageshield.org | feedback-smtp.us-east-1.amazonses.com | 10 |
| TXT | damageshield.org | v=spf1 include:_spf.porkbun.com ~all | — |
| TXT | resend._domainkey.damageshield.org | p=MIGfMA0GCS... (full DKIM key) | — |
| TXT | send.damageshield.org | v=spf1 include:amazonses.com ~all | — |
| TXT | _dmarc.damageshield.org | v=DMARC1; p=none; | — |

### Vercel domain configuration
- `damageshield.org` → 307 redirect to `www.damageshield.org`
- `www.damageshield.org` → Production deployment
- `damageshield.vercel.app` → Production deployment (legacy alias, keep for backwards compat)

---

## DEPLOYMENT

### Frontend
1. Push changes to `index.html` to GitHub repo
2. Vercel auto-deploys on push (connected to GitHub)
3. No build step, no CI, no configuration — Vercel serves the static file directly

### Edge Function
Only needs redeployment when `index.ts` changes:
```bash
cd path/to/damageshield
supabase login
supabase link --project-ref mzhnclfxvlrrkgpbqjuy
supabase functions deploy send-report --no-verify-jwt
```
Docker Desktop must be running for Edge Function deployment on Windows.

### Database
Schema only needs to be run once. Go to Supabase Dashboard → SQL Editor → paste `schema.sql` → run.

---

## MONETIZATION

- **Free tier:** 5 sent reports (drafts are free and unlimited — only successful sends count)
- **Paid tier:** $20/month via Stripe (external payment link)
- **Paywall trigger:** 6th send attempt
- **Paywall UX:** Modal appears after the client has already signed. Form data is preserved. The detailer is never embarrassed in front of a client by a paywall mid-flow.
- **Anti-abuse:** Not yet implemented. At MVP stage, the risk of abuse is lower than the risk of over-engineering. Revisit when there are real paying users.

---

## KNOWN BUGS FIXED (history for context)

| Bug | Root cause | Fix |
|---|---|---|
| `Uncaught SyntaxError: Unexpected token 'export'` | Supabase CDN global `supabase` conflicted with local `const supabase` declaration | Renamed all local references to `sb` |
| `TypeError: supabase.from is not a function` | Same conflict — `loadReports()` still used old `supabase` reference on line 1666 | Patched with `sed` |
| Signature canvas not drawing on mobile | Canvas initialized while step was hidden — `offsetWidth` returned 0 | `setTimeout(initSignaturePad, 150)` when navigating to step 3; width from `parentElement.clientWidth` |
| Continue button stuck in loading state on validation failure | Loading state set before validation, never reset on failure | Reset `btn.disabled`, hide spinner in validation failure branch of `nextStep()` |
| `Buffer is not defined` in Edge Function | `Buffer` is Node.js only, Edge Function runs on Deno | Replaced with `btoa(unescape(encodeURIComponent(htmlContent)))` |
| Emails landing in spam | Sending from Gmail instead of verified domain | Updated `FROM_EMAIL` secret to `support@damageshield.org` after Resend domain verification |

---

## WHAT DOESN'T EXIST YET (future work)

- **Stripe webhook integration** — currently Stripe is an external link. No programmatic subscription management. Users who pay via Stripe still hit the paywall until this is built.
- **Report PDF as actual PDF** — currently the "PDF" is an HTML file attached to the email. It renders beautifully in email clients but is technically HTML. A real PDF (using a library like Puppeteer or a PDF generation API) would be more bulletproof legally.
- **Report storage** — damage photos are not stored anywhere after the email is sent. If a detailer needs the report again they must find the email. A future version should store reports with photos in Supabase Storage.
- **Dashboard report history detail view** — the dashboard shows a list of reports but clicking one doesn't open it. The data exists in the `reports` table but photos aren't stored so a full recreation isn't possible yet.
- **Mobile app** — currently a mobile web app (PWA-ready but not packaged). An actual App Store presence would increase trust with some demographics.
- **SMS delivery** — some detailers and clients prefer SMS. Resend doesn't do SMS; would require Twilio integration.
- **VIN scanner** — would improve vehicle entry speed and accuracy.

---

## COMPETITORS

| Product | Positioning | Price | Why detailers don't use it |
|---|---|---|---|
| Mobile Tech RX | All-in-one detailing business management | $50–$100+/month | Built for shops, overwhelming for solo operators |
| DAMAGE iD | Fleet damage inspection | Enterprise | Aimed at rental companies, not detailers |
| Jobber / Housecall Pro | Field service management | $50+/month | Overkill, photo docs buried in feature bloat |
| WeProov | Vehicle inspection for fleets/dealers | Enterprise | Wrong customer entirely |
| iPhone camera roll | Free | Free | No signature, no contract, no email, no PDF |

**The gap Damage Shield fills:** A solo detailer who needs exactly one thing done in exactly 60 seconds in a driveway. No competitor addresses this with the right UX at the right price.

---

## BUSINESS CONTEXT

- **Target customer:** Solo mobile detailers, 1-person operations, 5-30 jobs/week
- **Primary pain:** Being blamed for pre-existing damage, losing jobs/money/reputation
- **Secondary pain:** Looking unprofessional compared to larger shops
- **Price sensitivity:** Low — $20/month is less than one averted dispute
- **Distribution:** Reddit (r/AutoDetailing, r/mobiledetailing), Facebook Groups ("Mobile Detailing", "Auto Detailing Business Owners"), TikTok detailing niche, AutoGeekOnline forum
- **Goal:** 5 paying customers first, then 50, then $10K MRR

---

## THE THING THAT MUST NEVER BREAK

The moment a detailer hands their phone to a client to sign, the app must work perfectly. No loading spinners, no crashes, no blank canvases, no errors. That is the single most important UX moment in the product. Every bug fix priority should be evaluated against this.

---

*Built in one session on February 23, 2026.*  
*Stack: Vanilla JS · Supabase · Deno Edge Functions · Resend · Vercel · Porkbun*  
*Cost at zero users: $0/month*
