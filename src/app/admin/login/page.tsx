import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin Login · Football Prediction" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_oklch(0.3_0.05_260),_oklch(0.17_0.03_260)_60%)] px-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-2xl">⚽</div>
          <CardTitle className="text-xl">Prediction Admin</CardTitle>
          <CardDescription>Sign in to manage matches, sessions and results.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
