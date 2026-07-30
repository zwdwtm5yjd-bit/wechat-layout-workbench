import { describe, expect, it } from "vitest";

import { documentV1Fixture } from "../fixtures/index.js";
import {
  DocumentMigrationError,
  DocumentMigrationRegistry,
  migrateDocumentToCurrent,
  type DocumentMigration,
} from "./index.js";

interface LegacyDocument {
  schemaVersion: "0.9.0";
  document: typeof documentV1Fixture;
}

describe("document migrations", () => {
  it("returns current documents unchanged without applying migrations", () => {
    const result = migrateDocumentToCurrent(documentV1Fixture);

    expect(result.document).toEqual(documentV1Fixture);
    expect(result.appliedMigrations).toEqual([]);
  });

  it("applies registered migrations and validates the final V1 document", () => {
    const registry = new DocumentMigrationRegistry();
    const migration: DocumentMigration<LegacyDocument, typeof documentV1Fixture> = {
      fromVersion: "0.9.0",
      toVersion: "1.0.0",
      migrate(input, context) {
        expect(context).toEqual({
          fromVersion: "0.9.0",
          toVersion: "1.0.0",
          step: 1,
        });

        return structuredClone(input.document);
      },
    };

    registry.register(migration);

    const result = migrateDocumentToCurrent(
      {
        schemaVersion: "0.9.0",
        document: documentV1Fixture,
      } satisfies LegacyDocument,
      registry,
    );

    expect(result.document).toEqual(documentV1Fixture);
    expect(result.appliedMigrations).toEqual([
      {
        fromVersion: "0.9.0",
        toVersion: "1.0.0",
      },
    ]);
  });

  it("fails safely when no migration path exists", () => {
    expect(() =>
      migrateDocumentToCurrent({
        schemaVersion: "0.8.0",
      }),
    ).toThrow(DocumentMigrationError);
  });
});
