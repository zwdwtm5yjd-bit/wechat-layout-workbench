"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  BadgeCheck,
  Building2,
  CircleOff,
  ExternalLink,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Radio,
  Search,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { Dialog, DropdownMenu } from "radix-ui";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  AccountClientError,
  type Account,
  type AccountStatus,
  archiveAccount,
  createAccount,
  disableAccount,
  enableAccount,
  listAccounts,
  setDefaultAccount,
} from "../lib/accounts/client";
import { useAppToast } from "./ui/app-toast";

type AccountFilter = AccountStatus | "all";

const filters: readonly { readonly label: string; readonly value: AccountFilter }[] = [
  { label: "全部", value: "all" },
  { label: "启用中", value: "active" },
  { label: "草稿", value: "draft" },
  { label: "已停用", value: "disabled" },
  { label: "已归档", value: "archived" },
];

const statusLabels: Readonly<Record<AccountStatus, string>> = {
  active: "启用中",
  archived: "已归档",
  disabled: "已停用",
  draft: "草稿",
};

function errorMessage(error: unknown): string {
  return error instanceof AccountClientError ? error.message : "操作失败，请稍后重试";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function accountInitial(account: Account): string {
  return (account.shortName || account.name).slice(0, 1).toLocaleUpperCase();
}

function statusTone(status: AccountStatus): string {
  if (status === "active") return "bg-success-soft text-success";
  if (status === "archived") return "bg-panel-muted text-faint";
  if (status === "disabled") return "bg-warning-soft text-warning";
  return "bg-accent-soft text-accent-strong";
}

export function AccountManager() {
  const queryClient = useQueryClient();
  const { pushToast } = useAppToast();
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") setCreateOpen(true);
  }, []);

  const accountsQuery = useQuery({
    queryKey: ["accounts", filter, search],
    queryFn: () =>
      listAccounts({
        ...(filter === "all" ? {} : { status: filter }),
        ...(search === "" ? {} : { search }),
      }),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: async (account) => {
      setCreateOpen(false);
      await refresh();
      pushToast({
        title: "公众号已创建",
        description: `“${account.name}”已加入内容工作空间。`,
        tone: "success",
      });
    },
    onError: (error) => {
      pushToast({ title: "无法创建公众号", description: errorMessage(error), tone: "warning" });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      account,
    }: {
      readonly action: string;
      readonly account: Account;
    }) => {
      if (action === "default") return setDefaultAccount(account.id);
      if (action === "disable") return disableAccount(account.id);
      if (action === "enable") return enableAccount(account.id);
      return archiveAccount(account.id);
    },
    onSuccess: async (account) => {
      await refresh();
      pushToast({
        title: "公众号状态已更新",
        description: `${account.name} · ${statusLabels[account.status]}${account.isDefault ? " · 默认" : ""}`,
        tone: "success",
      });
    },
    onError: (error) => {
      pushToast({ title: "操作未完成", description: errorMessage(error), tone: "warning" });
    },
  });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">BRAND WORKSPACES</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">公众号</h1>
          <p className="mt-2 text-[13px] text-muted">管理内容归属、默认发布空间与基础账号状态。</p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[13px] font-semibold text-white shadow-subtle transition hover:bg-accent-strong"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          新建公众号
        </button>
      </section>

      <section className="rounded-card border border-line bg-panel shadow-subtle">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0" role="tablist">
            {filters.map((item) => (
              <button
                aria-selected={filter === item.value}
                className={`shrink-0 rounded-control px-3 py-2 text-[12px] font-medium transition ${
                  filter === item.value
                    ? "bg-accent-soft text-accent-strong"
                    : "text-muted hover:bg-hover hover:text-ink"
                }`}
                key={item.value}
                onClick={() => setFilter(item.value)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={submitSearch}>
            <label className="relative min-w-0 flex-1 lg:w-72">
              <span className="sr-only">搜索公众号</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
                size={15}
              />
              <input
                className="h-9 w-full rounded-control border border-line bg-panel-muted pr-9 pl-9 text-[12px] text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-indigo-100"
                maxLength={200}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="搜索名称或简介"
                value={searchDraft}
              />
              {searchDraft === "" ? null : (
                <button
                  aria-label="清除搜索"
                  className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-faint hover:bg-hover hover:text-ink"
                  onClick={() => {
                    setSearchDraft("");
                    setSearch("");
                  }}
                  type="button"
                >
                  <X aria-hidden="true" size={13} />
                </button>
              )}
            </label>
            <button
              className="h-9 rounded-control border border-line bg-panel px-3 text-[12px] font-medium text-ink hover:bg-hover"
              type="submit"
            >
              搜索
            </button>
          </form>
        </div>

        {accountsQuery.isPending ? (
          <div className="grid min-h-72 place-items-center text-muted">
            <span className="inline-flex items-center gap-2 text-[13px]">
              <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
              正在读取公众号…
            </span>
          </div>
        ) : accountsQuery.isError ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <p className="text-sm font-semibold text-danger">公众号列表加载失败</p>
              <p className="mt-2 text-[12px] text-muted">{errorMessage(accountsQuery.error)}</p>
              <button
                className="mt-4 rounded-control border border-line px-3 py-2 text-[12px] font-medium text-ink hover:bg-hover"
                onClick={() => void accountsQuery.refetch()}
                type="button"
              >
                重新加载
              </button>
            </div>
          </div>
        ) : accountsQuery.data.items.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
                <Radio aria-hidden="true" size={20} />
              </span>
              <h2 className="mt-4 text-sm font-semibold text-ink">没有找到公众号</h2>
              <p className="mt-2 text-[12px] leading-5 text-muted">
                建立第一个公众号后，它会自动成为默认内容空间。
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {accountsQuery.data.items.map((account) => (
              <article
                className={`group rounded-card border bg-panel p-5 transition hover:-translate-y-0.5 hover:shadow-raised ${
                  account.isDefault ? "border-accent/35 ring-1 ring-accent/10" : "border-line"
                }`}
                key={account.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-zinc-900 text-sm font-semibold text-white">
                      {accountInitial(account)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-ink">{account.name}</h2>
                        {account.isDefault ? (
                          <Star
                            aria-label="默认公众号"
                            className="fill-accent text-accent"
                            size={13}
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-[11px] text-faint">{account.slug}</p>
                    </div>
                  </div>
                  <AccountActions
                    account={account}
                    busy={actionMutation.isPending}
                    onAction={(action) => actionMutation.mutate({ action, account })}
                  />
                </div>

                <p className="mt-4 line-clamp-2 min-h-10 text-[12px] leading-5 text-muted">
                  {account.description || "尚未填写公众号简介。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] ${statusTone(account.status)}`}
                  >
                    {statusLabels[account.status]}
                  </span>
                  {account.contentTypes.map((contentType) => (
                    <span
                      className="rounded-full border border-line bg-panel-muted px-2.5 py-1 text-[10px] text-muted"
                      key={contentType}
                    >
                      {contentType}
                    </span>
                  ))}
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
                  <div>
                    <dt className="text-[10px] text-faint">关联文章</dt>
                    <dd className="mt-1 text-sm font-semibold text-ink">
                      {String(account.articleCount)} 篇
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-faint">最近更新</dt>
                    <dd className="mt-1 text-[11px] text-muted">{formatTime(account.updatedAt)}</dd>
                  </div>
                </dl>
                <Link
                  className="mt-4 flex h-9 items-center justify-center gap-2 rounded-control border border-line text-[12px] font-medium text-ink transition hover:bg-hover"
                  href={`/workspace/accounts/${encodeURIComponent(account.id)}`}
                >
                  管理详情
                  <ExternalLink aria-hidden="true" size={13} />
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <CreateAccountDialog
        busy={createMutation.isPending}
        onOpenChange={setCreateOpen}
        onSubmit={(input) => createMutation.mutate(input)}
        open={createOpen}
      />
    </div>
  );
}

function AccountActions({
  account,
  busy,
  onAction,
}: {
  readonly account: Account;
  readonly busy: boolean;
  readonly onAction: (action: "archive" | "default" | "disable" | "enable") => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={`管理 ${account.name}`}
          className="grid size-8 shrink-0 place-items-center rounded-control text-muted outline-none hover:bg-hover hover:text-ink"
          disabled={busy}
          type="button"
        >
          <MoreHorizontal aria-hidden="true" size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-44 rounded-control border border-line bg-panel p-1.5 shadow-raised"
          sideOffset={6}
        >
          {!account.isDefault && account.status === "active" ? (
            <AccountMenuItem icon={Star} label="设为默认" onSelect={() => onAction("default")} />
          ) : null}
          {account.status === "active" || account.status === "draft" ? (
            <AccountMenuItem icon={CircleOff} label="停用" onSelect={() => onAction("disable")} />
          ) : null}
          {account.status === "disabled" ? (
            <AccountMenuItem
              icon={BadgeCheck}
              label="重新启用"
              onSelect={() => onAction("enable")}
            />
          ) : null}
          {account.status !== "archived" ? (
            <AccountMenuItem
              icon={Archive}
              label="归档"
              onSelect={() => {
                if (window.confirm(`归档“${account.name}”？归档后不能设为默认公众号。`)) {
                  onAction("archive");
                }
              }}
            />
          ) : null}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild>
            <Link
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[12px] text-muted outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink"
              href={`/workspace/accounts/${encodeURIComponent(account.id)}`}
            >
              <Building2 aria-hidden="true" size={14} />
              基础信息
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function AccountMenuItem({
  icon: Icon,
  label,
  onSelect,
}: {
  readonly icon: typeof Star;
  readonly label: string;
  readonly onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[12px] text-muted outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink"
      onSelect={onSelect}
    >
      <Icon aria-hidden="true" size={14} />
      {label}
    </DropdownMenu.Item>
  );
}

function CreateAccountDialog({
  busy,
  onOpenChange,
  onSubmit,
  open,
}: {
  readonly busy: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (input: {
    readonly accountType: "unknown";
    readonly contentTypes: string[];
    readonly description: string | null;
    readonly isDefault: boolean;
    readonly name: string;
    readonly shortName: string | null;
    readonly verificationStatus: "unknown";
  }) => void;
  readonly open: boolean;
}) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [contentTypes, setContentTypes] = useState("general");
  const [isDefault, setIsDefault] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTypes = [...new Set(contentTypes.split(",").map((item) => item.trim()))].filter(
      Boolean,
    );
    if (name.trim() === "" || normalizedTypes.length === 0) return;
    onSubmit({
      name: name.trim(),
      shortName: shortName.trim() || null,
      description: description.trim() || null,
      contentTypes: normalizedTypes,
      accountType: "unknown",
      verificationStatus: "unknown",
      isDefault,
    });
  };

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-panel p-6 shadow-raised outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink">新建公众号</Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] leading-5 text-muted">
                先建立基础内容空间；品牌资产和微信授权将在后续任务接入。
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="关闭"
                className="grid size-8 place-items-center rounded-control text-muted hover:bg-hover hover:text-ink"
                type="button"
              >
                <X aria-hidden="true" size={16} />
              </button>
            </Dialog.Close>
          </div>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <AccountField label="公众号名称" required>
              <input
                autoFocus
                className="h-10 w-full rounded-control border border-line bg-panel px-3 text-[12px] text-ink outline-none focus:border-accent focus:ring-3 focus:ring-indigo-100"
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：清风巡察"
                required
                value={name}
              />
            </AccountField>
            <AccountField label="简称">
              <input
                className="h-10 w-full rounded-control border border-line bg-panel px-3 text-[12px] text-ink outline-none focus:border-accent"
                maxLength={100}
                onChange={(event) => setShortName(event.target.value)}
                placeholder="用于卡片和紧凑展示"
                value={shortName}
              />
            </AccountField>
            <AccountField
              hint="使用英文小写标识，多个类型用英文逗号分隔。"
              label="内容类型"
              required
            >
              <input
                className="h-10 w-full rounded-control border border-line bg-panel px-3 text-[12px] text-ink outline-none focus:border-accent"
                maxLength={300}
                onChange={(event) => setContentTypes(event.target.value)}
                placeholder="inspection,government"
                required
                value={contentTypes}
              />
            </AccountField>
            <AccountField label="简介">
              <textarea
                className="min-h-20 w-full resize-y rounded-control border border-line bg-panel px-3 py-2.5 text-[12px] leading-5 text-ink outline-none focus:border-accent"
                maxLength={2000}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="说明这个公众号主要承载哪些内容"
                value={description}
              />
            </AccountField>
            <label className="flex items-center gap-2 text-[12px] text-ink">
              <input
                checked={isDefault}
                className="size-4 rounded border-line accent-[var(--color-accent)]"
                onChange={(event) => setIsDefault(event.target.checked)}
                type="checkbox"
              />
              创建后设为默认公众号
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <button
                  className="h-10 rounded-control border border-line px-4 text-[12px] font-medium text-ink hover:bg-hover"
                  disabled={busy}
                  type="button"
                >
                  取消
                </button>
              </Dialog.Close>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[12px] font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" size={14} />
                ) : null}
                {busy ? "正在创建…" : "创建公众号"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AccountField({
  children,
  hint,
  label,
  required = false,
}: {
  readonly children: ReactNode;
  readonly hint?: string;
  readonly label: string;
  readonly required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      <span className="mt-2 block">{children}</span>
      {hint === undefined ? null : (
        <span className="mt-1.5 block text-[10px] text-faint">{hint}</span>
      )}
    </label>
  );
}
