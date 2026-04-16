"use client";

import { useState } from "react";
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
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST"
      });

      if (!response.ok) {
        return;
      }

      router.push("/login");
      router.refresh();
    } finally {
      setIsPending(false);
    }
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
