"use client";
import { useRouter } from "next/navigation";
import { UpgradeSheet } from "./UpgradeSheet";

/** Opens the plans right away; closing it goes back to the listings instead of an empty form. */
export function PlanLimitGate({ reason }: { reason: string }) {
  const router = useRouter();
  return <UpgradeSheet open reason={reason} onClose={() => router.push("/panel/propiedades")} />;
}
