import { z, type ZodType } from "zod";
import type { FieldType, Outcome } from "@prisma/client";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().trim().min(1).max(max).nullable().optional());
const optionalUrl = z.preprocess(emptyToNull, z.url({ protocol: /^https?$/ }).max(500).nullable().optional());

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).pipe(z.email()),
  password: z.string().min(1).max(200),
});

export const matchSchema = z.object({
  homeTeam: z.string().trim().min(1).max(80),
  awayTeam: z.string().trim().min(1).max(80),
  homeTeamLogo: optionalUrl,
  awayTeamLogo: optionalUrl,
  competition: optionalText(120),
  kickoffAt: z.coerce.date(),
  venue: optionalText(160),
  externalId: optionalText(120),
});
export type MatchInput = z.infer<typeof matchSchema>;

export const fieldSchema = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{0,39}$/, "Key must be lowercase letters, digits or _"),
    label: z.string().trim().min(1).max(80),
    type: z.enum(["TEXT", "NUMBER", "SELECT"]),
    options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    required: z.boolean().default(false),
  })
  .refine((f) => f.type !== "SELECT" || f.options.length > 0, { error: "SELECT fields need at least one option", path: ["options"] });
export type FieldInput = z.infer<typeof fieldSchema>;

const RESERVED_KEYS = new Set(["fullName", "mobile", "email", "selectedOutcome", "consent", "customData", "predictedHomeScore", "predictedAwayScore"]);

export const sessionSchema = z
  .object({
    matchId: z.string().min(1),
    startTime: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(1).max(1440).default(10),
    status: z.enum(["DRAFT", "SCHEDULED"]).default("SCHEDULED"),
    allowDraw: z.boolean().default(false),
    showResultsToParticipants: z.boolean().default(false),
    requireConsent: z.boolean().default(false),
    enableScorePrediction: z.boolean().default(false),
    collectLateEntries: z.boolean().default(true),
    campaignName: optionalText(120),
    eventName: optionalText(120),
    fields: z.array(fieldSchema).max(20).default([]),
  })
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    s.fields.forEach((f, i) => {
      if (RESERVED_KEYS.has(f.key) || seen.has(f.key)) {
        ctx.addIssue({ code: "custom", message: `Duplicate or reserved key "${f.key}"`, path: ["fields", i, "key"] });
      }
      seen.add(f.key);
    });
  });
export type SessionInput = z.infer<typeof sessionSchema>;

export const resultSchema = z.object({
  homeScore: z.coerce.number().int().min(0).max(99),
  awayScore: z.coerce.number().int().min(0).max(99),
  winningOutcome: z.enum(["HOME", "AWAY", "DRAW"]).optional(),
});
export type ResultInput = z.infer<typeof resultSchema>;

/** Normalizes to E.164 ("+919876543210"). Numbers without a country code get DEFAULT_COUNTRY_CODE. */
export function normalizeMobile(raw: string): string | null {
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!/^\+?\d{8,15}$/.test(s)) return null;
  if (s.startsWith("+")) return s;
  const cc = (process.env.DEFAULT_COUNTRY_CODE || "").replace(/\D/g, "");
  return "+" + (cc && s.length <= 10 ? cc + s : s);
}

export type FieldDef = { key: string; label: string; type: FieldType; options: string[]; required: boolean };

export const impliedOutcome = (home: number, away: number): Outcome => (home > away ? "HOME" : home < away ? "AWAY" : "DRAW");

/** Name, mobile, email, consent and the admin-configured custom fields. Shared by predictions and timed-out registrations. */
function participantShape(fields: FieldDef[], requireConsent: boolean) {
  const custom: Record<string, ZodType> = {};
  for (const f of fields) {
    const error = (iss: { input?: unknown }) => (iss.input === undefined ? `${f.label} is required` : undefined);
    let inner: ZodType;
    if (f.type === "NUMBER") inner = z.coerce.number({ error }).min(-1e9).max(1e9);
    else if (f.type === "SELECT") inner = z.enum(f.options as [string, ...string[]], { error: (iss) => error(iss) ?? "Choose one of the listed options" });
    else inner = z.string({ error }).trim().min(f.required ? 1 : 0, `${f.label} is required`).max(500);
    custom[f.key] = z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      f.required ? inner : inner.optional(),
    );
  }
  return {
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    mobile: z
      .string()
      .trim()
      .min(8, "Enter a valid mobile number")
      .max(20)
      .transform((v, ctx) => {
        const n = normalizeMobile(v);
        if (!n) {
          ctx.addIssue({ code: "custom", message: "Enter a valid mobile number" });
          return z.NEVER;
        }
        return n;
      }),
    email: z.string().trim().toLowerCase().max(200).pipe(z.email("Enter a valid email address")),
    consent: requireConsent ? z.literal(true, { error: "Please accept the privacy notice" }) : z.boolean().optional(),
    customData: z.strictObject(custom).default({}),
  };
}

/** Details-only schema used after the window has closed: no outcome, no score (unknown keys are dropped). */
export function buildLateEntrySchema(fields: FieldDef[], requireConsent: boolean) {
  return z.object(participantShape(fields, requireConsent));
}
export type LateEntryInput = z.infer<ReturnType<typeof buildLateEntrySchema>>;

/** Builds the participant + prediction schema for one session, including its admin-configured custom fields. */
export function buildSubmissionSchema(fields: FieldDef[], allowDraw: boolean, requireConsent: boolean, enableScore = false) {
  const outcomes: [Outcome, ...Outcome[]] = allowDraw ? ["HOME", "AWAY", "DRAW"] : ["HOME", "AWAY"];
  // Exact-score fields: required when the session enables score prediction, stripped otherwise.
  const scoreField = enableScore
    ? z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number({ error: "Enter the score" }).int({ error: "Whole numbers only" }).min(0).max(99),
      )
    : z.preprocess(() => undefined, z.undefined());
  return z
    .object({
      ...participantShape(fields, requireConsent),
      predictedHomeScore: scoreField,
      predictedAwayScore: scoreField,
      // In score mode the outcome is derived from the score, so the client does not have to send one.
      selectedOutcome: enableScore ? z.enum(outcomes).optional() : z.enum(outcomes, { error: "Select who you think will win" }),
    })
    .superRefine((d, ctx) => {
      if (!enableScore || d.predictedHomeScore === undefined || d.predictedAwayScore === undefined) return;
      if (impliedOutcome(d.predictedHomeScore, d.predictedAwayScore) === "DRAW" && !allowDraw) {
        ctx.addIssue({ code: "custom", path: ["predictedHomeScore"], message: "A draw score is not allowed for this match. Pick a winner." });
      }
    })
    // Score mode: the winner is derived from the score; anything the client sent as selectedOutcome is ignored.
    .transform((d) => ({
      ...d,
      selectedOutcome: (enableScore && d.predictedHomeScore !== undefined && d.predictedAwayScore !== undefined
        ? impliedOutcome(d.predictedHomeScore, d.predictedAwayScore)
        : d.selectedOutcome) as Outcome,
    }));
}
export type SubmissionInput = z.infer<ReturnType<typeof buildSubmissionSchema>>;
