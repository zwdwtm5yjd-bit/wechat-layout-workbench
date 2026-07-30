import { describe, expect, it } from "vitest";

import type { AuthRuntimeOptions } from "./auth.types.js";
import { Argon2PasswordHasher, CsrfTokenService, SessionTokenService } from "./auth.crypto.js";

const options: AuthRuntimeOptions = {
  environment: "test",
  sessionSecret: "session-secret-for-auth-crypto-tests",
  csrfSecret: "csrf-secret-for-auth-crypto-tests",
  sessionTtlSeconds: 60,
  rememberedSessionTtlSeconds: 120,
  loginIdentifierMaxAttempts: 5,
  loginIpMaxAttempts: 25,
  loginRateLimitWindowSeconds: 900,
  loginLockoutSeconds: 900,
  sessionTouchIntervalSeconds: 300,
};

describe("authentication cryptography", () => {
  it("hashes and verifies passwords with Argon2id", async () => {
    const hasher = new Argon2PasswordHasher();
    const passwordHash = await hasher.hashPassword("correct horse battery staple");

    expect(passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    expect(passwordHash).toContain("m=19456");
    expect(passwordHash).toContain("t=2");
    expect(passwordHash).toContain("p=1");
    await expect(hasher.verifyPassword(passwordHash, "correct horse battery staple")).resolves.toBe(
      true,
    );
    await expect(hasher.verifyPassword(passwordHash, "wrong password")).resolves.toBe(false);
    await expect(hasher.verifyPassword(undefined, "unknown account password")).resolves.toBe(false);
    await expect(hasher.verifyPassword("$argon2id$invalid", "malformed hash")).resolves.toBe(false);
  });

  it("creates opaque session tokens and stores only deterministic HMAC hashes", () => {
    const service = new SessionTokenService(options);
    const first = service.create();
    const second = service.create();

    expect(first.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).toBe(service.hash(first.rawToken));
    expect(second.rawToken).not.toBe(first.rawToken);
    expect(second.tokenHash).not.toBe(first.tokenHash);
  });

  it("binds a double-submit CSRF token to the active session or anonymous binding", () => {
    const service = new CsrfTokenService(options);
    const binding = service.createBinding();
    const token = service.issue(binding);

    expect(service.verifySubmitted(token, token, binding)).toBe(true);
    expect(service.verifySubmitted(token, `${token}tampered`, binding)).toBe(false);
    expect(service.verifySubmitted(token, token, `${binding}tampered`)).toBe(false);
  });
});
