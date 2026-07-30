import createClient from "openapi-fetch";

import type { paths } from "./openapi.generated";

export const apiClient = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001",
  credentials: "include",
});
