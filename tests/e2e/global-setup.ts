import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import {
  authDirectory,
  type E2eOwnerMetadata,
  ownerMetadataPath,
  runInApiContainer,
} from "./compose";

const passwordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$FM9dAIf0WYf24OZpTOxpyA$m+jg0HVeC0/KOKRMWP1WXLQCsiYztbr0pSBYtfRELKQ";

const createOwnerScript = `
import { createDatabaseConnection } from "./packages/database/dist/index.js";

const connection = createDatabaseConnection(process.env.DATABASE_URL, {
  applicationName: "playwright-global-setup",
  maxConnections: 1,
});

try {
  await connection.sql\`
    insert into auth.users (
      id,
      email,
      display_name,
      password_hash,
      role,
      status,
      timezone,
      locale
    )
    values (
      \${process.env.E2E_OWNER_ID}::uuid,
      \${process.env.E2E_OWNER_EMAIL},
      'Playwright Owner',
      \${process.env.E2E_PASSWORD_HASH},
      'owner',
      'active',
      'Asia/Shanghai',
      'zh-CN'
    )
  \`;
} finally {
  await connection.close();
}
`;

export default async function globalSetup(): Promise<void> {
  const userId = randomUUID();
  const email = `playwright-${userId}@example.invalid`;
  const metadata: E2eOwnerMetadata = { email, userId };

  runInApiContainer(createOwnerScript, {
    E2E_OWNER_EMAIL: email,
    E2E_OWNER_ID: userId,
    E2E_PASSWORD_HASH: passwordHash,
  });

  await mkdir(authDirectory, { recursive: true });
  await writeFile(ownerMetadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}
