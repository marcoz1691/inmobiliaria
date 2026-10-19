import type { Tx } from "@/server/db/tenant-tx";
import { auditLog } from "@/server/db/schema";

export async function audit(
  tx: Tx,
  entry: { tenantId: string; actorUserId: string | null; action: string; entityType: string; entityId?: string; diff?: Record<string, unknown> },
) {
  await tx.insert(auditLog).values(entry);
}
