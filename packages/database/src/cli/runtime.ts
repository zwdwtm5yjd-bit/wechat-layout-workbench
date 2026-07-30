import { loadServerEnvironment, revealSecret } from "@wechat-layout/config/server";

export function loadDatabaseRuntime() {
  const configuration = loadServerEnvironment();

  return {
    configuration,
    url: revealSecret(configuration.database.url),
  };
}
