import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { AUTH_OPTIONS } from "./auth.constants.js";
import type { AuthRuntimeOptions, PasswordHasher } from "./auth.types.js";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  #dummyHash?: Promise<string>;

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
    });
  }

  async verifyPassword(passwordHash: string | undefined, password: string): Promise<boolean> {
    const effectiveHash = passwordHash?.startsWith("$argon2id$")
      ? passwordHash
      : await this.getDummyHash();

    try {
      return await argon2.verify(effectiveHash, password);
    } catch {
      return false;
    }
  }

  private getDummyHash(): Promise<string> {
    this.#dummyHash ??= this.hashPassword(randomBytes(32).toString("base64url"));
    return this.#dummyHash;
  }
}

@Injectable()
export class SessionTokenService {
  readonly #secret: string;

  constructor(@Inject(AUTH_OPTIONS) options: AuthRuntimeOptions) {
    this.#secret = options.sessionSecret;
  }

  create(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString("base64url");

    return {
      rawToken,
      tokenHash: this.hash(rawToken),
    };
  }

  hash(rawToken: string): string {
    return createHmac("sha256", this.#secret).update(rawToken).digest("hex");
  }
}

@Injectable()
export class CsrfTokenService {
  readonly #secret: string;

  constructor(@Inject(AUTH_OPTIONS) options: AuthRuntimeOptions) {
    this.#secret = options.csrfSecret;
  }

  createBinding(): string {
    return randomBytes(32).toString("base64url");
  }

  issue(binding: string): string {
    const nonce = randomBytes(32).toString("base64url");
    return `${nonce}.${this.sign(binding, nonce)}`;
  }

  verify(token: string, binding: string): boolean {
    const separator = token.indexOf(".");
    if (separator <= 0 || separator === token.length - 1) {
      return false;
    }

    const nonce = token.slice(0, separator);
    const signature = token.slice(separator + 1);

    return safeEqual(signature, this.sign(binding, nonce));
  }

  verifySubmitted(headerToken: string, cookieToken: string, binding: string): boolean {
    return safeEqual(headerToken, cookieToken) && this.verify(headerToken, binding);
  }

  private sign(binding: string, nonce: string): string {
    const message = `${binding.length}!${binding}!${nonce.length}!${nonce}`;
    return createHmac("sha256", this.#secret).update(message).digest("base64url");
  }
}
