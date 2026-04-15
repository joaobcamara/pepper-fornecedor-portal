import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentSession } from "@/lib/session";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
    force?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getCurrentSession();
  const params = (await searchParams) ?? {};
  const requestedPath = params.next ?? "/produtos";
  const forceLogin = params.force === "1";

  if (!forceLogin && session?.role === "ADMIN") {
    redirect(requestedPath.startsWith("/admin") ? requestedPath : "/admin");
  }

  if (!forceLogin && session?.role === "SUPPLIER") {
    redirect(requestedPath.startsWith("/admin") ? "/produtos" : requestedPath);
  }

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
