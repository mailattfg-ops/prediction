import { LoginForm } from "./LoginForm";

export const metadata = { title: "Admin Login · Football Prediction" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center text-3xl">⚽</div>
        <h1 className="mt-2 text-center text-xl font-bold">Prediction Admin</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in to manage matches and sessions.</p>
        <LoginForm />
      </div>
    </main>
  );
}
