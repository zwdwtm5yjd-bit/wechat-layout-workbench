import { v7 as uuidV7, validate as validateUuid, version as uuidVersion } from "uuid";

declare const uuidV7Brand: unique symbol;

export type UuidV7 = string & { readonly [uuidV7Brand]: true };

export function createUuidV7(): UuidV7 {
  return uuidV7() as UuidV7;
}

export function isUuidV7(value: string): value is UuidV7 {
  return validateUuid(value) && uuidVersion(value) === 7;
}
