# Deploying Apex CRM (Vercel + Neon)

This puts Apex CRM online with **a production database that is completely separate from the one you
use for development**. Plan about an hour the first time.

**What you'll set up:**

| Piece | What it is | Cost |
| --- | --- | --- |
| GitHub | Holds the code; Vercel deploys from it | Free |
| Neon project **apex-crm-production** | The live database (new, empty, real data only) | Free tier to start |
| Neon project you use today | Stays your **development** database (demo data, tests) | — |
| Vercel project | Runs the website, the daily job and the file storage | Hobby is free for personal use; **Pro (about $20/month) is required for commercial use** by Vercel's terms |
| Email (SMTP) | Sends password resets, invitations, invoices, reminders | Gmail free, or Brevo/Resend |

---

## 1. Put the code on GitHub

From a terminal where GitHub works:

```bash
git push -u origin main
```

Check https://github.com/kouteiba97/CRM-project shows the code. Keep the repository **private**.

---

## 2. Create the production database on Neon

1. Go to https://console.neon.tech → **New project**.
2. Name: `apex-crm-production`. Postgres version: the latest offered.
   Region: the closest to your users, e.g. **AWS Europe Central 1 (Frankfurt)** for Algeria/France.
3. Open the project → **Connect** → choose the **pooled** connection string (contains `-pooler`),
   database `neondb`. Copy it — it looks like
   `postgresql://neondb_owner:…@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`.
   This is your **production `DATABASE_URL`**. Keep it secret.
4. Backups: Neon keeps a restore history (point-in-time restore). On the free plan it is short;
   on a paid plan raise **Settings › Storage › History retention** to at least 7 days.

You do **not** create tables by hand: they are created automatically on every deploy
(`npm run db:migrate` runs before the build, see `vercel.json`).

> Never run `npm run db:seed` against production: it wipes everything. It refuses anyway as
> soon as the database contains a real account.

Your existing Neon project stays your **development** database: keep using it in `.env.local`.

---

## 3. Create the Vercel project

1. Go to https://vercel.com → **Add New… › Project** → **Import** the `CRM-project` repository
   (allow Vercel to access it if asked).
2. Framework: **Next.js** (detected). Leave the build settings: `vercel.json` already says
   `npm run db:migrate && npm run build`.
3. **Don't deploy yet** — open **Environment Variables** first (next step). If it already
   deployed and failed, that's fine: fix the variables and redeploy.

### 3a. Environment variables

In **Project › Settings › Environment Variables**, add these. "Production" means the live site;
"Preview" means test deployments from other branches.

| Name | Production | Preview |
| --- | --- | --- |
| `DATABASE_URL` | the **production** Neon string (step 2) | your **development** Neon string |
| `AUTH_SECRET` | a new random value ① | a *different* random value |
| `ENCRYPTION_KEY` | a new random value ① — **never change it later** | a different one |
| `CRON_SECRET` | a new random value ① | (not needed) |
| `APP_URL` | `https://<your-project>.vercel.app` (later your domain) | (leave empty) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | your email settings (step 5) | same, or leave empty |
| `OPERATOR_NAME` | your company name (shown on the Privacy page) | same |
| `CONTACT_EMAIL` | the address people write to about their data | same |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | optional (step 7) | optional |
| `ALERT_EMAIL` or `ALERT_WEBHOOK_URL` | optional: where server errors are sent | optional |

① Generate each random value separately on your computer:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Why Preview uses the development database: test deployments then never touch real data, and
the migrations they run only change the development database.

### 3b. File storage (attachments)

1. **Project › Storage › Create Database › Blob**. Name it `apex-crm-files`, access **Private**.
2. **Connect** it to the project for **Production** (and Preview if you want uploads there).
   Vercel adds `BLOB_READ_WRITE_TOKEN` for you.

### 3c. Region

**Project › Settings › Functions › Function Region**: choose the one next to your Neon region
(e.g. **Frankfurt, fra1** for Neon eu-central-1). Pages are faster when the two are close.

### 3d. Deploy

**Deployments › Redeploy** (or push to `main`). The build log shows the migrations, then the
build. When it is **Ready**, open the `.vercel.app` address.

---

## 4. First start

1. Open `https://<your-project>.vercel.app/signup` and **create your own account** — it becomes
   the owner of a new, empty workspace.
2. **Settings › Workspace**: company name, address, NIF/RC/NIS/AI, IBAN, currency, document
   language (printed on every invoice).
3. **Settings › Security**: turn on **two-step login** for the owner account.
4. **Settings › Team**: invite your colleagues (Owner / Admin / Member).
5. Optional: **Clients › Import** to bring in your existing client list (CSV or Excel).

---

## 5. Email (needed for password reset, invitations, sending invoices)

**Gmail (simplest):** in your Google Account turn on 2-Step Verification, then
**Security › App passwords** → create one called "Apex CRM" (16 letters). In Vercel set:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=you@gmail.com
SMTP_PASS=the16letters
MAIL_FROM="Your Company <you@gmail.com>"
```

Gmail allows about 500 emails a day. For more, or to send from `@yourcompany.com`, create an
account at **Brevo** or **Resend**, verify your domain there (they give you SPF/DKIM DNS records
to add), and paste their SMTP host, port, user and password into the same five variables.

Redeploy after changing variables. Test: sign out → **Forgot password?** with your own email.

---

## 6. Your own domain (optional)

1. **Project › Settings › Domains** → add `crm.yourcompany.com`.
2. At your domain registrar, add the DNS record Vercel shows (usually a `CNAME` to
   `cname.vercel-dns.com`). HTTPS is automatic.
3. Change `APP_URL` to `https://crm.yourcompany.com` and redeploy (links in emails use it).

---

## 7. Sign in with Google (optional)

1. https://console.cloud.google.com → new project → **APIs & Services › OAuth consent screen**:
   External, app name "Apex CRM", your email; publish the app.
2. **Credentials › Create credentials › OAuth client ID › Web application**.
   Authorised redirect URI: `https://<your address>/api/auth/callback/google`
   (add `http://localhost:3000/api/auth/callback/google` too for development).
3. Put the Client ID / secret in `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, redeploy.

---

## 8. Check that everything works

- [ ] `/en/login` loads over HTTPS; `/en/privacy` shows your company name.
- [ ] Sign up / sign in / sign out; two-step login.
- [ ] Forgot password email arrives and the link works.
- [ ] Invite a colleague; they can join.
- [ ] Create an invoice → **Download PDF** → **Send** (arrives with the PDF attached).
- [ ] Upload a file on a client.
- [ ] **Project › Settings › Cron Jobs** shows `/api/cron/daily` (06:00 UTC). After the first run,
      **Logs** shows `[cron] daily {…}`.
- [ ] Phone: open the site, browser menu → **Add to Home screen / Install app**.

---

## 9. Everyday operation

- **Updates:** push to `main` → Vercel builds, runs database migrations, and deploys. Other
  branches get preview deployments on the development database.
- **Backups:** Neon restore history, plus **Settings › Data › Download workspace data** from time
  to time.
- **Errors:** Vercel › Logs (and `ALERT_EMAIL` / `ALERT_WEBHOOK_URL` if set).
- **Security log:** Settings › Security shows sign-ins and important changes.
- **Legal:** the Privacy policy and Terms are a solid starting point written for this app; have
  them reviewed for your country (e.g. Algerian law 18-07, or GDPR for EU clients).
