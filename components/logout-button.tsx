"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton({
  className = "",
  label = "Sair"
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleLogout() {
    const response = await fetch("/api/auth/logout", {
      method: "POST"
    });

    if (!response.ok) {
      return;
    }

    startTransition(() => {
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className={className}
      disabled={isPending}
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "Saindo..." : label}
    </button>
  );
}
