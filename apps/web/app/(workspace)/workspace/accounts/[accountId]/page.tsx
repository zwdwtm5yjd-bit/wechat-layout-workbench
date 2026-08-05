import type { Metadata } from "next";

import { AccountDetail } from "../../../../../components/account-detail";

export const metadata: Metadata = {
  title: "公众号详情",
};

export default async function AccountDetailPage({
  params,
}: Readonly<{ params: Promise<{ accountId: string }> }>) {
  const { accountId } = await params;
  return <AccountDetail accountId={accountId} />;
}
