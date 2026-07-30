import { inspect } from "node:util";

const redactedValue = "[REDACTED]";

export class SecretValue {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
    Object.freeze(this);
  }

  reveal(): string {
    return this.#value;
  }

  toJSON(): string {
    return redactedValue;
  }

  toString(): string {
    return redactedValue;
  }

  [inspect.custom](): string {
    return redactedValue;
  }
}

export function revealSecret(secret: SecretValue): string {
  return secret.reveal();
}
