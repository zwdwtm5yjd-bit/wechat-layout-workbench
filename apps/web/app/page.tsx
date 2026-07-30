import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { sessionCookieName } from "../lib/auth/route-policy";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSessionHint = Boolean(cookieStore.get(sessionCookieName)?.value);

  redirect(hasSessionHint ? "/workspace" : "/login");
}
