"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { api, ApiClientError } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

const EMPTY: MatchFormValues = { homeTeam: "", awayTeam: "", homeTeamLogo: "", awayTeamLogo: "", competition: "", kickoffAt: "", venue: "", externalId: "" };

function FieldRow({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function MatchForm({ id, initial }: { id?: string; initial?: MatchFormValues }) {
  const router = useRouter();
  const [v, setV] = useState<MatchFormValues>(initial ?? EMPTY);
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
      toast.success(id ? "Match updated." : "Match created.");
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
      <Card>
        <CardHeader>
          <CardTitle>Fixture</CardTitle>
          <CardDescription>Teams, kick-off and optional details shown to participants.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <FieldRow id="homeTeam" label="Home team" error={errors.homeTeam}><Input id="homeTeam" value={v.homeTeam} onChange={set("homeTeam")} required maxLength={80} placeholder="Manchester United" /></FieldRow>
          <FieldRow id="awayTeam" label="Away team" error={errors.awayTeam}><Input id="awayTeam" value={v.awayTeam} onChange={set("awayTeam")} required maxLength={80} placeholder="Liverpool" /></FieldRow>
          <FieldRow id="kickoffAt" label="Kick-off date & time" error={errors.kickoffAt} hint="Local time on this device"><Input id="kickoffAt" type="datetime-local" value={v.kickoffAt} onChange={set("kickoffAt")} required /></FieldRow>
          <FieldRow id="competition" label="Competition / league" error={errors.competition}><Input id="competition" value={v.competition} onChange={set("competition")} maxLength={120} placeholder="Premier League" /></FieldRow>
          <FieldRow id="homeTeamLogo" label="Home team logo URL" error={errors.homeTeamLogo} hint="Optional https image"><Input id="homeTeamLogo" type="url" value={v.homeTeamLogo} onChange={set("homeTeamLogo")} placeholder="https://…" /></FieldRow>
          <FieldRow id="awayTeamLogo" label="Away team logo URL" error={errors.awayTeamLogo} hint="Optional https image"><Input id="awayTeamLogo" type="url" value={v.awayTeamLogo} onChange={set("awayTeamLogo")} placeholder="https://…" /></FieldRow>
          <FieldRow id="venue" label="Venue" error={errors.venue}><Input id="venue" value={v.venue} onChange={set("venue")} maxLength={160} placeholder="Old Trafford" /></FieldRow>
          <FieldRow id="externalId" label="External match ID" error={errors.externalId} hint="Optional, for a future football data provider"><Input id="externalId" value={v.externalId} onChange={set("externalId")} maxLength={120} /></FieldRow>
          {message && (
            <div className="md:col-span-2">
              <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button nativeButton={false} variant="outline" render={<Link href="/admin/matches" />}>Cancel</Button>
          <Button type="submit" disabled={busy}>
            <Save data-icon="inline-start" /> {busy ? "Saving…" : id ? "Save changes" : "Create match"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
