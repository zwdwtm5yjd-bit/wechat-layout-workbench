import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";

import {
  authDirectory,
  type E2eOwnerMetadata,
  ownerMetadataPath,
  runInApiContainer,
} from "./compose";

const cleanupOwnerScript = `
import { createDatabaseConnection } from "./packages/database/dist/index.js";

const userId = process.env.E2E_OWNER_ID;
const connection = createDatabaseConnection(process.env.DATABASE_URL, {
  applicationName: "playwright-global-teardown",
  maxConnections: 1,
});

try {
  await connection.sql\`delete from audit.audit_logs where actor_user_id = \${userId}::uuid\`;
  await connection.sql\`delete from content.article_status_history where created_by = \${userId}::uuid\`;
  await connection.sql\`delete from content.copy_records where copied_by = \${userId}::uuid\`;
  await connection.sql\`delete from content.render_outputs where generated_by = \${userId}::uuid\`;
  await connection.sql.begin(async (transaction) => {
    await transaction\`
      update content.articles
      set current_snapshot_id = null
      where owner_user_id = \${userId}::uuid
    \`;
    await transaction\`alter table content.article_snapshots disable trigger trg_article_snapshots_immutable\`;
    await transaction\`delete from content.article_snapshots where created_by = \${userId}::uuid\`;
    await transaction\`alter table content.article_snapshots enable trigger trg_article_snapshots_immutable\`;
  });
  await connection.sql\`
    delete from content.source_blocks
    where source_document_id in (
      select sd.id
      from content.source_documents sd
      join content.articles a on a.id = sd.article_id
      where a.owner_user_id = \${userId}::uuid
    )
  \`;
  await connection.sql\`
    delete from content.source_documents
    where article_id in (
      select id from content.articles where owner_user_id = \${userId}::uuid
    )
  \`;
  await connection.sql\`delete from content.article_documents where last_saved_by = \${userId}::uuid\`;
  await connection.sql\`delete from content.articles where owner_user_id = \${userId}::uuid\`;
  await connection.sql\`delete from auth.user_sessions where user_id = \${userId}::uuid\`;
  await connection.sql\`delete from auth.users where id = \${userId}::uuid\`;

  const trigger = await connection.sql\`
    select tgenabled
    from pg_trigger
    where tgname = 'trg_article_snapshots_immutable'
  \`;
  if (trigger[0]?.tgenabled !== 'O') {
    throw new Error("快照不可变触发器未恢复启用");
  }
} finally {
  await connection.close();
}
`;

export default async function globalTeardown(): Promise<void> {
  try {
    if (!existsSync(ownerMetadataPath)) {
      return;
    }
    const metadata = JSON.parse(await readFile(ownerMetadataPath, "utf8")) as E2eOwnerMetadata;
    runInApiContainer(cleanupOwnerScript, {
      E2E_OWNER_ID: metadata.userId,
    });
  } finally {
    await rm(authDirectory, { force: true, recursive: true });
  }
}
