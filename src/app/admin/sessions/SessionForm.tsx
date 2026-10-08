"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/components/api";
import { Alert, Button, Card, Checkbox, Field, Input, LinkButton, Select } from "@/components/ui";

export type MatchOption = { id: string; label: string };
export type FieldRow = { key: string; label: string; type: "TEXT" | "NUMBER" | "SELECT"; options: string; required: boolean };
export type SessionFormValues = {
  matchId: string;
  startTime: string; // datetime-local
  durationMinutes: number;
  status: "DRAFT" | "SCHEDULED";
  allowDraw: boolean;
  showResultsToParticipants: boolean;
  requireConsent: boolean;
  enableScorePrediction: boolean;
  collectLateEntries: boolean;
  campaignName: string;
  eventName: string;
  fields: FieldRow[];
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 40);

function defaultStart() {
  const d = new Date(Date.now() + 5 * 60_000);
  d.setSeconds(0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PRESETS: Record<string, Partial<FieldRow>> = {
  Age: { type: "NUMBER" },
  Gender: { type: "SELECT", options: "Male, Female, Other" },
  City: {}, State: {}, Country: {}, Organization: {},
};

export function SessionForm({ id, matches, initial, defaultMatchId }: { id?: string; matches: MatchOption[]; initial?: SessionFormValues; defaultMatchId?: string }) {
  const router = useRouter();
  const [v, setV] = useState<SessionFormValues>(
    initial ?? {
      matchId: defaultMatchId ?? matches[0]?.id ?? "", startTime: defaultStart(), durationMinutes: 10, status: "SCHEDULED",
      allowDraw: false, showResultsToParticipants: false, requireConsent: false, enableScorePrediction: false, collectLateEntries: true, campaignName: "", eventName: "", fields: [],
    },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const patch = (p: Partial<SessionFormValues>) => setV((s) => ({ ...s, ...p }));
  const patchField = (i: number, p: Partial<FieldRow>) => setV((s) => ({ ...s, fields: s.fields.map((f, j) => (j === i ? { ...f, ...p } : f)) }));
  const addField = (preset?: string) =>
    setV((s) => ({
      ...s,
      fields: [...s.fields, { key: slug(preset ?? ""), label: preset ?? "", type: "TEXT", options: "", required: false, ...(preset ? PRESETS[preset] : {}) }],
    }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const body = {
        ...v,
        startTime: v.startTime ? new Date(v.startTime).toISOString() : "",
        fields: v.fields.map((f) => ({ ...f, options: f.type === "SELECT" ? f.options.split(",").map((o) => o.trim()).filter(Boolean) : [] })),
      };
      const res = await api<{ session: { id: string } }>(id ? `/api/sessions/${id}` : "/api/sessions", { method: id ? "PUT" : "POST", body });
      router.push(`/admin/sessions/${res.session.id}`);
      router.refresh();
    } catch (err) {
      const e = err as ApiClientError;
      setErrors(e.details ?? {});
      setMessage(e.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="font-semibold">Match & timing</h2>
        <Field label="Match" required error={errors.matchId}>
          <Select value={v.matchId} onChange={(e) => patch({ matchId: e.target.value })} required>
            <option value="">Select a match…</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
        </Field>
        <p className="-mt-2 text-xs text-slate-500">
          Teams are defined per match. Don&apos;t see your fixture?{" "}
          <Link href="/admin/matches/new" className="font-medium text-emerald-700 hover:underline">Add a new match</Link>{" "}
          (home team, away team, kick-off), then come back here.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Prediction opens at" required error={errors.startTime} hint="Local time on this device">
            <Input type="datetime-local" value={v.startTime} onChange={(e) => patch({ startTime: e.target.value })} required />
          </Field>
          <Field label="Duration (minutes)" required error={errors.durationMinutes} hint="Default 10. Expiry = start + duration">
            <Input type="number" min={1} max={1440} value={v.durationMinutes} onChange={(e) => patch({ durationMinutes: Number(e.target.value) })} required />
          </Field>
          <Field label="Status" error={errors.status} hint="Drafts are not reachable by QR">
            <Select value={v.status} onChange={(e) => patch({ status: e.target.value as "DRAFT" | "SCHEDULED" })}>
              <option value="SCHEDULED">Scheduled (live)</option>
              <option value="DRAFT">Draft</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Event / venue name" error={errors.eventName}><Input value={v.eventName} onChange={(e) => patch({ eventName: e.target.value })} maxLength={120} /></Field>
          <Field label="Campaign name" error={errors.campaignName}><Input value={v.campaignName} onChange={(e) => patch({ campaignName: e.target.value })} maxLength={120} /></Field>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Checkbox checked={v.allowDraw} onChange={(e) => patch({ allowDraw: e.target.checked })} label="Allow “Draw” as a prediction" />
          <Checkbox checked={v.showResultsToParticipants} onChange={(e) => patch({ showResultsToParticipants: e.target.checked })} label="Show vote split to participants" />
          <Checkbox checked={v.requireConsent} onChange={(e) => patch({ requireConsent: e.target.checked })} label="Require privacy consent checkbox" />
          <Checkbox
            checked={v.enableScorePrediction}
            onChange={(e) => patch({ enableScorePrediction: e.target.checked })}
            label="Ask for the exact score instead of Home/Away/Draw (winner is derived from the score; one score winner is auto-selected: earliest exact submission)"
          />
          <Checkbox
            checked={v.collectLateEntries}
            onChange={(e) => patch({ collectLateEntries: e.target.checked })}
            label="After the window closes, keep collecting participant details as timed-out registrations (no prediction or score is stored)"
          />
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Additional participant fields</h2>
            <p className="text-xs text-slate-500">Name, mobile and email are always collected. Add only what the campaign needs.</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.keys(PRESETS).map((p) => (
              <Button key={p} type="button" variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => addField(p)}>+ {p}</Button>
            ))}
            <Button type="button" variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => addField()}>+ Custom</Button>
          </div>
        </div>
        {errors.fields && <Alert>{errors.fields}</Alert>}
        {v.fields.map((f, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-3">
              <Field label="Label" error={errors[`fields.${i}.label`]}>
                <Input value={f.label} onChange={(e) => patchField(i, { label: e.target.value, key: f.key || slug(e.target.value) })} maxLength={80} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Key" error={errors[`fields.${i}.key`]}><Input value={f.key} onChange={(e) => patchField(i, { key: slug(e.target.value) })} /></Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Type">
                <Select value={f.type} onChange={(e) => patchField(i, { type: e.target.value as FieldRow["type"] })}>
                  <option value="TEXT">Text</option><option value="NUMBER">Number</option><option value="SELECT">Select</option>
                </Select>
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Options (comma separated)" error={errors[`fields.${i}.options`]}>
                <Input value={f.options} onChange={(e) => patchField(i, { options: e.target.value })} disabled={f.type !== "SELECT"} placeholder={f.type === "SELECT" ? "Male, Female, Other" : "—"} />
              </Field>
            </div>
            <div className="flex items-center gap-3 md:col-span-2 md:pb-2">
              <Checkbox checked={f.required} onChange={(e) => patchField(i, { required: e.target.checked })} label="Required" />
              <button type="button" className="text-xs text-rose-700 hover:underline" onClick={() => setV((s) => ({ ...s, fields: s.fields.filter((_, j) => j !== i) }))}>Remove</button>
            </div>
          </div>
        ))}
      </Card>

      {message && <Alert>{message}</Alert>}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Create session & generate QR"}</Button>
        <LinkButton href={id ? `/admin/sessions/${id}` : "/admin"}>Cancel</LinkButton>
      </div>
    </form>
  );
}
