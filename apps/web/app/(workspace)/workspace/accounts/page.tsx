import type { Metadata } from "next";

import { AccountManager } from "../../../../components/account-manager";

export const metadata: Metadata = {
  title: "公众号",
};

export default function AccountsPage() {
  return <AccountManager />;
}
