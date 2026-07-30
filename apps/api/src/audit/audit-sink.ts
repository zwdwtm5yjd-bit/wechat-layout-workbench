export const auditSinkToken = Symbol("auditSink");

export interface AuditRecord {
  readonly requestId: string;
  readonly traceId: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly status: "succeeded" | "failed";
  readonly occurredAt: string;
  readonly summary?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AuditSink {
  record(event: AuditRecord): Promise<void>;
}
