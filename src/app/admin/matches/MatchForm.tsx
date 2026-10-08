"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/components/api";
import { Alert, Button, Card, Field, Input, LinkButton } from "@/components/ui";

export type MatchFormValues = {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: string;
  awayTeamLogo: string;
  competition: string;
  kickoffAt: string; // datetime-local value (browser local time)
  venue: string;
  externalId: string;
};

export function MatchForm({ id, initial }: { id?: string; initial?: MatchFormValues }) {
  const router = useRouter();
  const [v, setV] = useState<MatchFormValues>(
    initial ?? { homeTeam: "", awayTeam: "", homeTeamLogo: "", awayTeamLogo: "", competition: "", kickoffAt: "", venue: "", externalId: "" },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof MatchFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const body = { ...v, kickoffAt: v.kickoffAt ? new Date(v.kickoffAt).toISOString() : "" };
      await api(id ? `/api/matches/${id}` : "/api/matches", { method: id ? "PUT" : "POST", body });
      router.push("/admin/matches");
      router.refresh();
    } catch (err) {
      const e = err as ApiClientError;
      setErrors(e.details ?? {});
      setMessage(e.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Home team" required error={errors.homeTeam}><Input value={v.homeTeam} onChange={set("homeTeam")} required maxLength={80} /></Field>
          <Field label="Away team" required error={errors.awayTeam}><Input value={v.awayTeam} onChange={set("awayTeam")} required maxLength={80} /></Field>
          <Field label="Home team logo URL" error={errors.homeTeamLogo} hint="Optional, https image URL"><Input type="url" value={v.homeTeamLogo} onChange={set("homeTeamLogo")} /></Field>
          <Field label="Away team logo URL" error={errors.awayTeamLogo} hint="Optional, https image URL"><Input type="url" value={v.awayTeamLogo} onChange={set("awayTeamLogo")} /></Field>
          <Field label="Competition / league" error={errors.competition}><Input value={v.competition} onChange={set("competition")} maxLength={120} /></Field>
          <Field label="Kick-off date & time" required error={errors.kickoffAt}><Input type="datetime-local" value={v.kickoffAt} onChange={set("kickoffAt")} required /></Field>
          <Field label="Venue" error={errors.venue}><Input value={v.venue} onChange={set("venue")} maxLength={160} /></Field>
          <Field label="External match ID" error={errors.externalId} hint="Optional, for a future football data provider"><Input value={v.externalId} onChange={set("externalId")} maxLength={120} /></Field>
        </div>
        {message && <Alert>{message}</Alert>}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Create match"}</Button>
          <LinkButton href="/admin/matches">Cancel</LinkButton>
        </div>
      </Card>
    </form>
  );
}
