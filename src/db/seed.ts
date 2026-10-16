/**
 * Dev seed. Dates are relative to today so the dashboard always has overdue, today and upcoming work.
 * Wipes every table first — refuses to run against production.
 */
import bcrypt from "bcryptjs";
import { DEV_CREDENTIALS } from "./dev-credentials";
import { sql } from "drizzle-orm";
import { db } from "./client";
import * as s from "./schema";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

const DAY = 86_400_000;
const today = new Date();
today.setHours(12, 0, 0, 0);
/** YYYY-MM-DD, `n` days from today. */
const d = (n: number) => new Date(today.getTime() + n * DAY).toISOString().slice(0, 10);
/** Timestamp `n` days from today at hh:mm local time. */
const at = (n: number, hh: number, mm = 0) => {
  const t = new Date(today.getTime() + n * DAY);
  t.setHours(hh, mm, 0, 0);
  return t;
};
const eur = (v: number) => Math.round(v * 100);

async function main() {
  await db.execute(sql`truncate table
    activities, payments, line_items, invoices, quotations, follow_ups, tasks, milestones,
    projects, leads, contacts, clients, document_sequences, memberships, users, workspaces, rate_limits
    restart identity cascade`);

  const [ws] = await db
    .insert(s.workspaces)
    .values({
      name: "Apex Tech",
      defaultCurrency: "EUR",
      defaultLocale: "fr",
      defaultDocumentLanguage: "fr",
      nif: "000016001234567",
      rc: "16/00-1234567B21",
      address: "12 rue Didouche Mourad, Alger",
    })
    .returning();
  const [owner] = await db
    .insert(s.users)
    .values({
      email: DEV_CREDENTIALS.email,
      name: "Apex Tech",
      theme: "light",
      passwordHash: await bcrypt.hash(DEV_CREDENTIALS.password, 12),
      emailVerifiedAt: new Date(),
    })
    .returning();
  if (!ws || !owner) throw new Error("seed: workspace/user not created");
  await db.insert(s.memberships).values({ workspaceId: ws.id, userId: owner.id, role: "owner" });

  const base = { workspaceId: ws.id, createdBy: owner.id };

  // ── Clients & contacts ────────────────────────────────────────────────────────────────
  const clientRows = [
    ["Librairie El Amel", "active", "DZ", "DZD", "fr", "Karim", "Benali"],
    ["Digital Solutions", "active", "FR", "EUR", "fr", "Claire", "Morel"],
    ["Algerian Publishers", "active", "DZ", "EUR", "ar", "Nadia", "Haddad"],
    ["TechSoft DZ", "prospect", "DZ", "EUR", "fr", "Yacine", "Mansouri"],
    ["Media Pro", "active", "FR", "EUR", "fr", "Julien", "Roux"],
    ["Dar El Ilm", "active", "DZ", "EUR", "ar", "Samira", "Bouzid"],
    ["Editions Houma", "prospect", "DZ", "EUR", "fr", "Rachid", "Kaci"],
    ["Creative Studio", "active", "FR", "EUR", "en", "Emma", "Laurent"],
    ["Future Lab", "prospect", "FR", "EUR", "en", "Lucas", "Bernard"],
    ["I-Tech", "inactive", "DZ", "EUR", "fr", "Amine", "Cherif"],
  ] as const;
  const CLIENT_TAGS: Record<string, string[]> = {
    "Librairie El Amel": ["publishing", "retail"],
    "Algerian Publishers": ["publishing"],
    "Dar El Ilm": ["publishing", "education"],
    "Editions Houma": ["publishing"],
    "Digital Solutions": ["agency"],
    "Media Pro": ["media"],
    "Creative Studio": ["agency", "media"],
    "Future Lab": ["education"],
  };
  const clients = await db
    .insert(s.clients)
    .values(
      clientRows.map(([name, status, country, currency, lang]) => ({
        ...base,
        name,
        status,
        country,
        currency,
        documentLanguage: lang,
        ownerId: owner.id,
        tags: CLIENT_TAGS[name] ?? [],
        email: `contact@${name.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
        phone: country === "DZ" ? "+213 550 12 34 56" : "+33 6 12 34 56 78",
      })),
    )
    .returning();
  const c = Object.fromEntries(clients.map((x) => [x.name, x])) as Record<string, (typeof clients)[0]>;
  const cl = (name: string) => {
    const row = c[name];
    if (!row) throw new Error(`seed: no client ${name}`);
    return row;
  };
  await db.insert(s.contacts).values(
    clientRows.map(([name, , , , , first, last]) => ({
      ...base,
      clientId: cl(name).id,
      firstName: first,
      lastName: last,
      jobTitle: "Director",
      email: `${first.toLowerCase()}@${name.toLowerCase().replace(/[^a-z]+/g, "")}.example`,
      isPrimary: true,
    })),
  );

  // ── Leads (every stage) ───────────────────────────────────────────────────────────────
  const leadRows: [string, string, (typeof s.leadStage.enumValues)[number], number, (typeof s.priority.enumValues)[number]][] = [
    ["Bookstore platform v2", "Librairie El Amel", "new", 2000, "medium"],
    ["Mobile app", "TechSoft DZ", "new", 5000, "high"],
    ["Catalogue website", "Editions Houma", "new", 4000, "low"],
    ["Client portal", "Digital Solutions", "contacted", 7500, "high"],
    ["Website redesign", "Creative Studio", "contacted", 2800, "medium"],
    ["Data platform", "Future Lab", "contacted", 12000, "medium"],
    ["CRM software", "Algerian Publishers", "proposal_sent", 6000, "urgent"],
    ["Website", "Dar El Ilm", "proposal_sent", 3200, "high"],
    ["Video platform", "Media Pro", "proposal_sent", 8500, "medium"],
    ["Field app", "I-Tech", "negotiation", 9000, "high"],
    ["Booking module", "Media Pro", "negotiation", 4600, "medium"],
    ["Web application", "Digital Solutions", "won", 14000, "high"],
    ["Bookstore platform", "Librairie El Amel", "won", 9500, "medium"],
    ["Intranet", "Creative Studio", "lost", 3000, "low"],
  ];
  const leads = await db
    .insert(s.leads)
    .values(
      leadRows.map(([title, client, stage, value, prio], i) => ({
        ...base,
        title,
        clientId: cl(client).id,
        stage,
        valueMinor: eur(value),
        currency: "EUR",
        priority: prio,
        ownerId: owner.id,
        position: i,
        expectedCloseDate: d(10 + i * 3),
        wonAt: stage === "won" ? at(-40 - i, 10) : null,
        lostReason: stage === "lost" ? "budget" : null,
      })),
    )
    .returning();
  const lead = (title: string) => leads.find((l) => l.title === title)!;

  // ── Projects, milestones, tasks ───────────────────────────────────────────────────────
  const projects = await db
    .insert(s.projects)
    .values([
      { ...base, code: "PRJ-012", name: "Bookstore platform", clientId: cl("Librairie El Amel").id, leadId: lead("Bookstore platform").id, status: "active", startDate: d(-60), deadline: d(25), budgetMinor: eur(9500), currency: "EUR", repoUrl: "https://git.example/apex/bookstore" },
      { ...base, code: "PRJ-013", name: "Web application", clientId: cl("Digital Solutions").id, leadId: lead("Web application").id, status: "at_risk", startDate: d(-45), deadline: d(9), budgetMinor: eur(14000), currency: "EUR" },
      { ...base, code: "PRJ-014", name: "Publishing CRM", clientId: cl("Algerian Publishers").id, status: "planning", startDate: d(5), deadline: d(90), budgetMinor: eur(6000), currency: "EUR" },
    ] satisfies (typeof s.projects.$inferInsert)[])
    .returning();
  const [pBook, pWeb, pCrm] = projects as [(typeof projects)[0], (typeof projects)[0], (typeof projects)[0]];

  const milestones = await db
    .insert(s.milestones)
    .values([
      { ...base, projectId: pBook.id, title: "Discovery & design", dueDate: d(-30), status: "completed", amountMinor: eur(3000), completedAt: at(-31, 17), position: 0 },
      { ...base, projectId: pBook.id, title: "Catalogue & search", dueDate: d(4), status: "in_progress", amountMinor: eur(3500), position: 1 },
      { ...base, projectId: pBook.id, title: "Checkout & launch", dueDate: d(25), status: "pending", amountMinor: eur(3000), position: 2 },
      { ...base, projectId: pWeb.id, title: "API integration", dueDate: d(2), status: "in_progress", amountMinor: eur(5000), position: 0 },
      { ...base, projectId: pWeb.id, title: "User acceptance", dueDate: d(9), status: "pending", amountMinor: eur(4000), position: 1 },
      { ...base, projectId: pCrm.id, title: "Kick-off workshop", dueDate: d(6), status: "pending", position: 0 },
    ] satisfies (typeof s.milestones.$inferInsert)[])
    .returning();

  const taskRows: [string, string | null, number | null, (typeof s.taskStatus.enumValues)[number], (typeof s.priority.enumValues)[number]][] = [
    ["Fix ISBN import errors", pBook.id, -3, "in_progress", "urgent"],
    ["Send API credentials to Digital Solutions", pWeb.id, -1, "todo", "high"],
    ["Review search relevance", pBook.id, 0, "in_review", "high"],
    ["Prepare UAT checklist", pWeb.id, 0, "todo", "medium"],
    ["Call Librairie El Amel about payment terms", null, 0, "todo", "medium"],
    ["Write kick-off agenda", pCrm.id, 2, "todo", "medium"],
    ["Set up staging for Web application", pWeb.id, 3, "blocked", "high"],
    ["Design checkout flow", pBook.id, 5, "todo", "medium"],
    ["Update portfolio case study", null, 14, "todo", "low"],
    ["Plan Q1 roadmap", null, null, "todo", "low"],
    ["Deliver wireframes", pBook.id, -20, "done", "medium"],
    ["Sign NDA", pCrm.id, -4, "done", "low"],
  ];
  await db.insert(s.tasks).values(
    taskRows.map(([title, projectId, due, status, prio], i) => ({
      ...base,
      title,
      projectId,
      status,
      priority: prio,
      dueDate: due === null ? null : d(due),
      assigneeId: owner.id,
      completedAt: status === "done" ? at(due ?? 0, 16) : null,
      position: i,
    })),
  );

  // ── Follow-ups ────────────────────────────────────────────────────────────────────────
  await db.insert(s.followUps).values([
    { ...base, leadId: lead("Field app").id, channel: "call", dueAt: at(-2, 10), subject: "Confirm negotiation terms", ownerId: owner.id },
    { ...base, leadId: lead("Bookstore platform v2").id, channel: "call", dueAt: at(0, 10), subject: "Discovery call", ownerId: owner.id },
    { ...base, leadId: lead("CRM software").id, channel: "meeting", dueAt: at(0, 14), subject: "Demo of the proposal", ownerId: owner.id },
    { ...base, leadId: lead("Website").id, channel: "email", dueAt: at(1, 11), subject: "Proposal reminder", ownerId: owner.id },
    { ...base, leadId: lead("Mobile app").id, channel: "meeting", dueAt: at(3, 15, 30), subject: "Scope workshop", ownerId: owner.id },
    { ...base, clientId: cl("Creative Studio").id, channel: "call", dueAt: at(5, 10), subject: "Check-in after launch", ownerId: owner.id },
    { ...base, leadId: lead("Video platform").id, channel: "email", dueAt: at(8, 9), subject: "Send revised estimate", ownerId: owner.id },
    { ...base, clientId: cl("Digital Solutions").id, channel: "call", dueAt: at(-6, 10), subject: "Weekly sync", status: "done", completedAt: at(-6, 10, 30), outcome: "Asked for a detailed proposal", ownerId: owner.id },
  ]);

  // ── Invoices, line items, payments ────────────────────────────────────────────────────
  type Inv = {
    num: number;
    client: string;
    project?: string;
    issue: number;
    due: number;
    state: (typeof s.invoiceState.enumValues)[number];
    lines: [string, number, number][]; // title, qty, unit price (major units)
    currency?: string;
    paid?: [number, number][]; // [days offset, amount major]
  };
  const invoiceDefs: Inv[] = [
    { num: 131, client: "Creative Studio", issue: -165, due: -135, state: "sent", lines: [["Website build", 1, 4200]], paid: [[-140, 4200]] },
    { num: 132, client: "Digital Solutions", issue: -150, due: -120, state: "sent", lines: [["Discovery workshop", 2, 1500]], paid: [[-118, 3000]] },
    { num: 133, client: "Media Pro", issue: -125, due: -95, state: "sent", lines: [["Video player module", 1, 5200]], paid: [[-96, 5200]] },
    { num: 134, client: "Dar El Ilm", issue: -100, due: -70, state: "sent", lines: [["Hosting & maintenance (year)", 1, 1800], ["Content migration", 12, 350]], paid: [[-72, 6000]] },
    { num: 135, client: "Librairie El Amel", project: pBook.id, issue: -75, due: -45, state: "sent", lines: [["Discovery & design", 1, 3000], ["Brand assets", 1, 4100]], paid: [[-44, 7100]] },
    { num: 136, client: "Digital Solutions", project: pWeb.id, issue: -45, due: -15, state: "sent", lines: [["Web application — sprint 1", 1, 6500]], paid: [[-20, 6500]] },
    { num: 137, client: "Creative Studio", issue: -30, due: -5, state: "viewed", lines: [["Landing pages", 3, 900]], paid: [[-3, 2700]] },
    { num: 138, client: "Media Pro", issue: -20, due: 10, state: "sent", lines: [["Booking module — deposit", 1, 4600]], paid: [[-2, 2000]] },
    { num: 139, client: "Algerian Publishers", issue: -40, due: -12, state: "sent", lines: [["CRM audit", 1, 2400]] },
    { num: 140, client: "Dar El Ilm", issue: -35, due: -5, state: "viewed", lines: [["Website — phase 1", 1, 3200]] },
    { num: 141, client: "Librairie El Amel", issue: -50, due: -20, state: "sent", currency: "DZD", lines: [["Formation équipe", 4, 85000]] },
    { num: 142, client: "Digital Solutions", project: pWeb.id, issue: -8, due: 22, state: "sent", lines: [["Web application — sprint 2", 1, 7500]] },
    { num: 143, client: "Future Lab", issue: -1, due: 29, state: "draft", lines: [["Prototype", 1, 3800]] },
    { num: 130, client: "I-Tech", issue: -90, due: -60, state: "void", lines: [["Field app estimate", 1, 1200]] },
  ];
  let payKey = 0;
  for (const def of invoiceDefs) {
    const currency = def.currency ?? "EUR";
    const lines = def.lines.map(([title, qty, price], position) => ({
      title,
      position,
      quantity: String(qty),
      unitPriceMinor: eur(price),
      amountMinor: eur(price * qty),
    }));
    const subtotal = lines.reduce((a, l) => a + l.amountMinor, 0);
    const client = cl(def.client);
    const [inv] = await db
      .insert(s.invoices)
      .values({
        ...base,
        number: `INV-${new Date(today.getTime() + def.issue * DAY).getFullYear()}-0${def.num}`,
        clientId: client.id,
        projectId: def.project ?? null,
        state: def.state,
        issueDate: d(def.issue),
        dueDate: d(def.due),
        currency,
        language: client.documentLanguage ?? "fr",
        subtotalMinor: subtotal,
        totalMinor: subtotal,
        sentAt: def.state === "draft" ? null : at(def.issue, 9),
        viewedAt: def.state === "viewed" ? at(def.issue + 2, 15) : null,
        voidedAt: def.state === "void" ? at(def.issue + 5, 9) : null,
      })
      .returning();
    if (!inv) throw new Error("seed: invoice not created");
    await db.insert(s.lineItems).values(lines.map((l) => ({ ...base, ...l, invoiceId: inv.id })));
    for (const [off, amount] of def.paid ?? []) {
      await db.insert(s.payments).values({
        ...base,
        invoiceId: inv.id,
        clientId: client.id,
        paidOn: d(off),
        amountMinor: eur(amount),
        currency,
        method: "bank_transfer",
        reference: `VIR-${1000 + ++payKey}`,
        idempotencyKey: `seed-${payKey}`,
      });
    }
    if (def.project === pBook.id && def.num === 135) {
      await db
        .update(s.milestones)
        .set({ invoiceId: inv.id })
        .where(sql`${s.milestones.id} = ${milestones[0]!.id}`);
    }
  }

  // ── Quotations ────────────────────────────────────────────────────────────────────────
  const quoteDefs = [
    [28, "Algerian Publishers", "sent", -6, 24, 6000, "CRM software"],
    [29, "Dar El Ilm", "sent", -14, 16, 3200, "Website"],
    [30, "Media Pro", "sent", -40, -10, 8500, "Video platform"],
    [31, "Digital Solutions", "accepted", -60, -30, 14000, "Web application"],
    [32, "Creative Studio", "declined", -50, -20, 3000, "Intranet"],
    [33, "TechSoft DZ", "draft", -1, 29, 5000, "Mobile app"],
  ] as const;
  for (const [n, client, status, issue, valid, amount, title] of quoteDefs) {
    const row = cl(client);
    const [q] = await db
      .insert(s.quotations)
      .values({
        ...base,
        number: `Q-${today.getFullYear()}-0${n}`,
        clientId: row.id,
        leadId: lead(title)?.id ?? null,
        status,
        issueDate: d(issue),
        validUntil: d(valid),
        currency: "EUR",
        language: row.documentLanguage ?? "fr",
        subtotalMinor: eur(amount),
        totalMinor: eur(amount),
        sentAt: status === "draft" ? null : at(issue, 10),
        acceptedAt: status === "accepted" ? at(issue + 7, 10) : null,
      })
      .returning();
    await db.insert(s.lineItems).values({
      ...base,
      quotationId: q!.id,
      title,
      unitPriceMinor: eur(amount),
      amountMinor: eur(amount),
    });
  }

  // ── Activity feed ─────────────────────────────────────────────────────────────────────
  const act = (
    hoursAgo: number,
    kind: string,
    entityType: string,
    entityId: string,
    clientId: string | null,
    payload: Record<string, string | number>,
  ) => ({
    workspaceId: ws.id,
    actorId: owner.id,
    kind,
    entityType,
    entityId,
    clientId,
    payload,
    occurredAt: new Date(Date.now() - hoursAgo * 3_600_000),
  });
  const inv138 = await db.query.invoices.findFirst({ where: (t, { like }) => like(t.number, "%0138") });
  await db.insert(s.activities).values([
    act(2, "lead_created", "lead", lead("Bookstore platform v2").id, cl("Librairie El Amel").id, { title: "Bookstore platform v2" }),
    act(4, "followup_done", "client", cl("Digital Solutions").id, cl("Digital Solutions").id, { subject: "Weekly sync" }),
    act(6, "payment_received", "invoice", inv138!.id, cl("Media Pro").id, { number: inv138!.number, amountMinor: eur(2000), currency: "EUR" }),
    act(8, "quotation_sent", "lead", lead("Website").id, cl("Dar El Ilm").id, { number: `Q-${today.getFullYear()}-029` }),
    act(26, "lead_stage_changed", "lead", lead("Field app").id, cl("I-Tech").id, { title: "Field app", stage: "negotiation" }),
    act(30, "milestone_completed", "project", pBook.id, cl("Librairie El Amel").id, { title: "Discovery & design" }),
    act(50, "task_completed", "project", pCrm.id, cl("Algerian Publishers").id, { title: "Sign NDA" }),
  ]);

  await db.insert(s.documentSequences).values([
    { workspaceId: ws.id, kind: "invoice", year: today.getFullYear(), nextValue: 144 },
    { workspaceId: ws.id, kind: "quotation", year: today.getFullYear(), nextValue: 34 },
    { workspaceId: ws.id, kind: "project", year: today.getFullYear(), nextValue: 15 },
  ]);

  console.log(`Seeded workspace "${ws.name}" (${ws.id}) for ${owner.email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
