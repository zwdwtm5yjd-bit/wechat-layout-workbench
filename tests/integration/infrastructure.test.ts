import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const postgresPassword = "integration-postgres-password";
const redisPassword = "integration-redis-password";
const minioAccessKey = "integrationminio";
const minioSecretKey = "integration-minio-secret-key";

async function execWhenReady(
  container: StartedTestContainer,
  command: readonly string[],
): Promise<Awaited<ReturnType<StartedTestContainer["exec"]>>> {
  let lastResult = await container.exec([...command]);
  for (let attempt = 0; attempt < 50 && lastResult.exitCode !== 0; attempt += 1) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
    lastResult = await container.exec([...command]);
  }
  return lastResult;
}

describe("V0.1 infrastructure with Testcontainers", () => {
  let postgres: StartedTestContainer;
  let redis: StartedTestContainer;
  let minio: StartedTestContainer;

  beforeAll(async () => {
    [postgres, redis, minio] = await Promise.all([
      new GenericContainer("postgres:18.4-alpine")
        .withEnvironment({
          POSTGRES_DB: "wechat_layout_integration",
          POSTGRES_PASSWORD: postgresPassword,
          POSTGRES_USER: "wechat_layout",
        })
        .withExposedPorts(5432)
        .withWaitStrategy(
          Wait.forSuccessfulCommand(
            "pg_isready --username wechat_layout --dbname wechat_layout_integration",
          ),
        )
        .withStartupTimeout(120_000)
        .start(),
      new GenericContainer("redis:8.2.8-alpine")
        .withCommand(["redis-server", "--appendonly", "yes", "--requirepass", redisPassword])
        .withExposedPorts(6379)
        .withWaitStrategy(
          Wait.forSuccessfulCommand(
            `redis-cli -a ${redisPassword} --no-auth-warning PING | grep -q PONG`,
          ),
        )
        .withStartupTimeout(120_000)
        .start(),
      new GenericContainer("minio/minio:RELEASE.2025-09-07T16-13-09Z")
        .withCommand(["server", "/data"])
        .withEnvironment({
          MINIO_ROOT_PASSWORD: minioSecretKey,
          MINIO_ROOT_USER: minioAccessKey,
        })
        .withExposedPorts(9000)
        .withWaitStrategy(Wait.forHttp("/minio/health/live", 9000))
        .withStartupTimeout(120_000)
        .start(),
    ]);
  });

  afterAll(async () => {
    await Promise.allSettled([postgres?.stop(), redis?.stop(), minio?.stop()]);
  });

  it("starts isolated PostgreSQL, Redis, and object storage dependencies", async () => {
    const postgresProbe = await execWhenReady(postgres, [
      "psql",
      "--username",
      "wechat_layout",
      "--dbname",
      "wechat_layout_integration",
      "--tuples-only",
      "--no-align",
      "--command",
      "SELECT 1",
    ]);
    const redisProbe = await redis.exec([
      "redis-cli",
      "-a",
      redisPassword,
      "--no-auth-warning",
      "PING",
    ]);
    const minioProbe = await fetch(
      `http://${minio.getHost()}:${String(minio.getMappedPort(9000))}/minio/health/live`,
    );

    expect(postgresProbe.exitCode, postgresProbe.output).toBe(0);
    expect(postgresProbe.output.trim()).toBe("1");
    expect(redisProbe.exitCode).toBe(0);
    expect(redisProbe.output.trim()).toBe("PONG");
    expect(minioProbe.status).toBe(200);
  });

  it("keeps database and queue state across container restarts", async () => {
    const createProbe = await execWhenReady(postgres, [
      "psql",
      "--username",
      "wechat_layout",
      "--dbname",
      "wechat_layout_integration",
      "--set",
      "ON_ERROR_STOP=1",
      "--command",
      "CREATE TABLE release_probe (id integer PRIMARY KEY, marker text NOT NULL); INSERT INTO release_probe VALUES (1, 'persisted');",
    ]);
    expect(createProbe.exitCode, createProbe.output).toBe(0);
    expect(
      (
        await redis.exec([
          "redis-cli",
          "-a",
          redisPassword,
          "--no-auth-warning",
          "SET",
          "release_probe",
          "persisted",
        ])
      ).output.trim(),
    ).toBe("OK");

    await Promise.all([postgres.restart(), redis.restart()]);

    const postgresProbe = await execWhenReady(postgres, [
      "psql",
      "--username",
      "wechat_layout",
      "--dbname",
      "wechat_layout_integration",
      "--tuples-only",
      "--no-align",
      "--command",
      "SELECT marker FROM release_probe WHERE id = 1",
    ]);
    const redisProbe = await execWhenReady(redis, [
      "redis-cli",
      "-a",
      redisPassword,
      "--no-auth-warning",
      "GET",
      "release_probe",
    ]);

    expect(postgresProbe.output.trim()).toBe("persisted");
    expect(redisProbe.output.trim()).toBe("persisted");
  });
});
