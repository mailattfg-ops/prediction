import { MatchForm } from "../MatchForm";

export const metadata = { title: "New match · Prediction Admin" };

export default function NewMatchPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">New match</h1>
      <MatchForm />
    </div>
  );
}
