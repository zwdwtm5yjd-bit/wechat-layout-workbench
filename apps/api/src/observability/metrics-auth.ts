import { timingSafeEqual } from "node:crypto";

export function validMetricsAuthorization(
  header: string | undefined,
  expectedToken: string,
): boolean {
  if (header === undefined || !header.startsWith("Bearer ")) return false;
  const providedToken = header.slice("Bearer ".length);
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  return provided.byteLength === expected.byteLength && timingSafeEqual(provided, expected);
}
