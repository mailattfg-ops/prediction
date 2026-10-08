import { PageHeader } from "@/components/admin/page-header";
import { MatchForm } from "../MatchForm";

export const metadata = { title: "New match · Prediction Admin" };

export default function NewMatchPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New match" description="Create the fixture first, then start a prediction session for it." />
      <MatchForm />
    </div>
  );
}
