"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, QrCode, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type MatchOption = { id: string; label: string };
export type FieldRow = { key: string; label: string; type: "TEXT" | "NUMBER" | "SELECT"; options: string; required: boolean };
export type SessionFormValues = {
  matchId: string;
  startTime: string; // datetime-local
  durationMinutes: number;
  status: "DRAFT" | "SCHEDULED";
  allowDraw: boolean;
  showResultsToParticipants: boolean;
  showWinnersToParticipants: boolean;
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

const FIELD_TYPES = { TEXT: "Text", NUMBER: "Number", SELECT: "Select" };
const STATUSES = { SCHEDULED: "Scheduled (live)", DRAFT: "Draft (QR disabled)" };

function SwitchRow({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="cursor-pointer">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={(c) => onChange(c)} />
    </div>
  );
}

export function SessionForm({ id, matches, initial, defaultMatchId }: { id?: string; matches: MatchOption[]; initial?: SessionFormValues; defaultMatchId?: string }) {
  const router = useRouter();
  const [v, setV] = useState<SessionFormValues>(
    initial ?? {
      matchId: defaultMatchId ?? matches[0]?.id ?? "", startTime: defaultStart(), durationMinutes: 10, status: "SCHEDULED",
      allowDraw: false, showResultsToParticipants: false, showWinnersToParticipants: true, requireConsent: false,
      enableScorePrediction: false, collectLateEntries: true, campaignName: "", eventName: "", fields: [],
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
  const matchItems = Object.fromEntries(matches.map((m) => [m.id, m.label]));

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
      toast.success(id ? "Session updated." : "Session created. QR code is ready.");
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
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Match & timing</CardTitle>
          <CardDescription>Which fixture, and when the 10-minute prediction window opens.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Match</Label>
            <Select value={v.matchId} onValueChange={(val) => patch({ matchId: (val as string) ?? "" })} items={matchItems}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a match…" /></SelectTrigger>
              <SelectContent>
                {matches.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.matchId && <p className="text-xs text-destructive">{errors.matchId}</p>}
            <p className="text-xs text-muted-foreground">
              Teams are defined per match. Don&apos;t see your fixture?{" "}
              <Link href="/admin/matches/new" className="font-medium text-primary underline-offset-4 hover:underline">Add a new match</Link>, then come back here.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startTime">Prediction opens at</Label>
              <Input id="startTime" type="datetime-local" value={v.startTime} onChange={(e) => patch({ startTime: e.target.value })} required />
              <p className="text-xs text-muted-foreground">{errors.startTime ?? "Local time on this device"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input id="duration" type="number" min={1} max={1440} value={v.durationMinutes} onChange={(e) => patch({ durationMinutes: Number(e.target.value) })} required />
              <p className="text-xs text-muted-foreground">{errors.durationMinutes ?? "Default 10. Expiry = start + duration"}</p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={v.status} onValueChange={(val) => patch({ status: (val as "DRAFT" | "SCHEDULED") ?? "SCHEDULED" })} items={STATUSES}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHEDULED">Scheduled (live)</SelectItem>
                  <SelectItem value="DRAFT">Draft (QR disabled)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eventName">Event / venue name</Label>
              <Input id="eventName" value={v.eventName} onChange={(e) => patch({ eventName: e.target.value })} maxLength={120} placeholder="Fan Park, Gate 3" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign name</Label>
              <Input id="campaignName" value={v.campaignName} onChange={(e) => patch({ campaignName: e.target.value })} maxLength={120} placeholder="Derby Day 2026" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participant experience</CardTitle>
          <CardDescription>What people see and answer after scanning the QR code.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <SwitchRow id="score" label="Exact score prediction" description="Ask for the final score instead of Home/Away/Draw. Only the exact score wins; one score-prize winner is drawn at random among exact scores." checked={v.enableScorePrediction} onChange={(c) => patch({ enableScorePrediction: c })} />
          <SwitchRow id="draw" label="Allow “Draw”" description="Offer Draw as an outcome (or accept draw scores in score mode)." checked={v.allowDraw} onChange={(c) => patch({ allowDraw: c })} />
          <SwitchRow id="winners" label="Show result & winners on the QR page" description="After you finalize, the page shows the final score and winner names." checked={v.showWinnersToParticipants} onChange={(c) => patch({ showWinnersToParticipants: c })} />
          <SwitchRow id="split" label="Show vote split to participants" description="Display how everyone voted on the success and result screens." checked={v.showResultsToParticipants} onChange={(c) => patch({ showResultsToParticipants: c })} />
          <SwitchRow id="late" label="Keep collecting details after the window closes" description="Late scanners still fill the form; they see a time-over popup and are stored as timed-out registrations." checked={v.collectLateEntries} onChange={(c) => patch({ collectLateEntries: c })} />
          <SwitchRow id="consent" label="Require privacy consent checkbox" description="Participants must tick a consent box before submitting." checked={v.requireConsent} onChange={(c) => patch({ requireConsent: c })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Additional participant fields</CardTitle>
              <CardDescription>Name, mobile and email are always collected. Add only what the campaign needs.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PRESETS).map((p) => (
                <Button key={p} type="button" variant="outline" size="xs" onClick={() => addField(p)}>+ {p}</Button>
              ))}
              <Button type="button" variant="secondary" size="xs" onClick={() => addField()}><Plus data-icon="inline-start" /> Custom</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.fields && <Alert variant="destructive"><AlertDescription>{errors.fields}</AlertDescription></Alert>}
          {v.fields.length === 0 && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No extra fields. Participants only enter name, mobile and email.</p>}
          {v.fields.map((f, i) => (
            <div key={i} className="grid gap-3 rounded-lg border p-3 md:grid-cols-12 md:items-end">
              <div className="space-y-1.5 md:col-span-3">
                <Label>Label</Label>
                <Input value={f.label} onChange={(e) => patchField(i, { label: e.target.value, key: f.key || slug(e.target.value) })} maxLength={80} placeholder="City" />
                {errors[`fields.${i}.label`] && <p className="text-xs text-destructive">{errors[`fields.${i}.label`]}</p>}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Key</Label>
                <Input value={f.key} onChange={(e) => patchField(i, { key: slug(e.target.value) })} placeholder="city" />
                {errors[`fields.${i}.key`] && <p className="text-xs text-destructive">{errors[`fields.${i}.key`]}</p>}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Type</Label>
                <Select value={f.type} onValueChange={(val) => patchField(i, { type: (val as FieldRow["type"]) ?? "TEXT" })} items={FIELD_TYPES}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text</SelectItem>
                    <SelectItem value="NUMBER">Number</SelectItem>
                    <SelectItem value="SELECT">Select</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label>Options (comma separated)</Label>
                <Input value={f.options} onChange={(e) => patchField(i, { options: e.target.value })} disabled={f.type !== "SELECT"} placeholder={f.type === "SELECT" ? "Male, Female, Other" : "—"} />
                {errors[`fields.${i}.options`] && <p className="text-xs text-destructive">{errors[`fields.${i}.options`]}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 md:col-span-2 md:pb-1.5">
                <label className="flex items-center gap-2 text-sm">
                  <Switch size="sm" checked={f.required} onCheckedChange={(c) => patchField(i, { required: c })} /> Required
                </label>
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Remove field" onClick={() => setV((s) => ({ ...s, fields: s.fields.filter((_, j) => j !== i) }))}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {message && <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button nativeButton={false} variant="outline" render={<Link href={id ? `/admin/sessions/${id}` : "/admin"} />}>Cancel</Button>
        <Button type="submit" disabled={busy} size="lg">
          <QrCode data-icon="inline-start" /> {busy ? "Saving…" : id ? "Save changes" : "Create session & generate QR"}
        </Button>
      </div>
    </form>
  );
}
