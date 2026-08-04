"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BadgeCheck,
  CircleOff,
  FileText,
  LoaderCircle,
  Radio,
  Save,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  AccountClientError,
  archiveAccount,
  disableAccount,
  enableAccount,
  getAccount,
  getAccountDeleteImpact,
  permanentlyDeleteAccount,
  setDefaultAccount,
  updateAccount,
} from "../lib/accounts/client";
import { useAppToast } from "./ui/app-toast";

function errorMessage(error: unknown): string {
  return error instanceof AccountClientError ? error.message : "操作失败，请稍后重试";
}

export function AccountDetail({ accountId }: { readonly accountId: string }) {
  const queryClient = useQueryClient();
  const { pushToast } = useAppToast();
  const accountQuery = useQuery({
    queryKey: ["account", accountId],
    queryFn: () => getAccount(accountId),
  });
  const impactQuery = useQuery({
    queryKey: ["account-delete-impact", accountId],
    queryFn: () => getAccountDeleteImpact(accountId),
    enabled: accountQuery.isSuccess,
  });
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [contentTypes, setContentTypes] = useState("");
  const [accountType, setAccountType] = useState<"service" | "subscription" | "unknown">("unknown");
  const [verificationStatus, setVerificationStatus] = useState<
    "unknown" | "unverified" | "verified"
  >("unknown");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    const account = accountQuery.data;
    if (account === undefined) return;
    setName(account.name);
    setShortName(account.shortName ?? "");
    setDescription(account.description ?? "");
    setContentTypes(account.contentTypes.join(","));
    setAccountType(account.accountType);
    setVerificationStatus(account.verificationStatus);
  }, [accountQuery.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["account", accountId] }),
      queryClient.invalidateQueries({ queryKey: ["account-delete-impact", accountId] }),
      queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateAccount(accountId, {
        name: name.trim(),
        shortName: shortName.trim() || null,
        description: description.trim() || null,
        contentTypes: [...new Set(contentTypes.split(",").map((item) => item.trim()))].filter(
          Boolean,
        ),
        accountType,
        verificationStatus,
      }),
    onSuccess: async () => {
      await refresh();
      pushToast({ title: "基础信息已保存", description: "公众号资料已经更新。", tone: "success" });
    },
    onError: (error) => {
      pushToast({ title: "保存失败", description: errorMessage(error), tone: "warning" });
    },
  });

  const stateMutation = useMutation({
    mutationFn: async (action: "archive" | "default" | "disable" | "enable") => {
      if (action === "default") return setDefaultAccount(accountId);
      if (action === "disable") return disableAccount(accountId);
      if (action === "enable") return enableAccount(accountId);
      return archiveAccount(accountId);
    },
    onSuccess: async () => {
      await refresh();
      pushToast({ title: "状态已更新", description: "默认选择已同步调整。", tone: "success" });
    },
    onError: (error) => {
      pushToast({ title: "状态更新失败", description: errorMessage(error), tone: "warning" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => permanentlyDeleteAccount(accountId),
    onSuccess: () => {
      window.location.replace("/workspace/accounts");
    },
    onError: (error) => {
      pushToast({ title: "无法永久删除", description: errorMessage(error), tone: "warning" });
      void impactQuery.refetch();
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") return;
    saveMutation.mutate();
  };

  if (accountQuery.isPending) {
    return (
      <div className="grid min-h-[480px] place-items-center text-muted">
        <span className="inline-flex items-center gap-2 text-[13px]">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={16} />
          正在读取公众号详情…
        </span>
      </div>
    );
  }

  if (accountQuery.isError) {
    return (
      <div className="grid min-h-[480px] place-items-center text-center">
        <div>
          <AlertTriangle className="mx-auto text-danger" size={24} />
          <h1 className="mt-4 text-base font-semibold text-ink">公众号详情加载失败</h1>
          <p className="mt-2 text-[12px] text-muted">{errorMessage(accountQuery.error)}</p>
          <Link
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-control border border-line px-3 text-[12px] font-medium text-ink hover:bg-hover"
            href="/workspace/accounts"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            返回公众号列表
          </Link>
        </div>
      </div>
    );
  }

  const account = accountQuery.data;
  const impact = impactQuery.data;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-ink"
            href="/workspace/accounts"
          >
            <ArrowLeft aria-hidden="true" size={13} />
            返回公众号
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-zinc-900 text-sm font-semibold text-white">
              {(account.shortName || account.name).slice(0, 1)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-[-0.035em] text-ink">
                  {account.name}
                </h1>
                {account.isDefault ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-medium text-accent-strong">
                    <Star aria-hidden="true" className="fill-accent" size={11} /> 默认
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] text-faint">{account.slug}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!account.isDefault && account.status === "active" ? (
            <StateButton
              icon={Star}
              label="设为默认"
              onClick={() => stateMutation.mutate("default")}
            />
          ) : null}
          {account.status === "active" || account.status === "draft" ? (
            <StateButton
              icon={CircleOff}
              label="停用"
              onClick={() => stateMutation.mutate("disable")}
            />
          ) : null}
          {account.status === "disabled" ? (
            <StateButton
              icon={BadgeCheck}
              label="启用"
              onClick={() => stateMutation.mutate("enable")}
            />
          ) : null}
          {account.status !== "archived" ? (
            <StateButton
              icon={Archive}
              label="归档"
              onClick={() => {
                if (window.confirm(`归档“${account.name}”？归档后不能设为默认公众号。`)) {
                  stateMutation.mutate("archive");
                }
              }}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form
          className="rounded-card border border-line bg-panel p-5 shadow-subtle sm:p-6"
          onSubmit={submit}
        >
          <div className="flex items-start gap-3 border-b border-line pb-5">
            <span className="grid size-9 place-items-center rounded-control bg-accent-soft text-accent">
              <Radio aria-hidden="true" size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">基础信息</h2>
              <p className="mt-1 text-[11px] text-muted">用于文章归属、筛选与后续品牌配置。</p>
            </div>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <DetailField label="公众号名称" required>
              <input
                className="h-10 w-full rounded-control border border-line px-3 text-[12px] text-ink outline-none focus:border-accent"
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </DetailField>
            <DetailField label="简称">
              <input
                className="h-10 w-full rounded-control border border-line px-3 text-[12px] text-ink outline-none focus:border-accent"
                maxLength={100}
                onChange={(event) => setShortName(event.target.value)}
                value={shortName}
              />
            </DetailField>
            <DetailField label="账号类型">
              <select
                className="h-10 w-full rounded-control border border-line bg-panel px-3 text-[12px] text-ink"
                onChange={(event) =>
                  setAccountType(event.target.value as "service" | "subscription" | "unknown")
                }
                value={accountType}
              >
                <option value="unknown">未确认</option>
                <option value="subscription">订阅号</option>
                <option value="service">服务号</option>
              </select>
            </DetailField>
            <DetailField label="认证状态">
              <select
                className="h-10 w-full rounded-control border border-line bg-panel px-3 text-[12px] text-ink"
                onChange={(event) =>
                  setVerificationStatus(event.target.value as "unknown" | "unverified" | "verified")
                }
                value={verificationStatus}
              >
                <option value="unknown">未确认</option>
                <option value="unverified">未认证</option>
                <option value="verified">已认证</option>
              </select>
            </DetailField>
            <div className="sm:col-span-2">
              <DetailField hint="英文小写标识，多个类型用英文逗号分隔。" label="内容类型" required>
                <input
                  className="h-10 w-full rounded-control border border-line px-3 text-[12px] text-ink outline-none focus:border-accent"
                  onChange={(event) => setContentTypes(event.target.value)}
                  required
                  value={contentTypes}
                />
              </DetailField>
            </div>
            <div className="sm:col-span-2">
              <DetailField label="简介">
                <textarea
                  className="min-h-28 w-full resize-y rounded-control border border-line px-3 py-2.5 text-[12px] leading-5 text-ink outline-none focus:border-accent"
                  maxLength={2000}
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </DetailField>
            </div>
          </div>
          <button
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[12px] font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
            disabled={saveMutation.isPending || account.status === "archived"}
            type="submit"
          >
            {saveMutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={14} />
            ) : (
              <Save aria-hidden="true" size={14} />
            )}
            {saveMutation.isPending ? "正在保存…" : "保存基础信息"}
          </button>
        </form>

        <aside className="space-y-5">
          <section className="rounded-card border border-line bg-panel p-5 shadow-subtle">
            <h2 className="text-sm font-semibold text-ink">使用情况</h2>
            <dl className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-control bg-panel-muted px-3 py-3">
                <dt className="inline-flex items-center gap-2 text-[11px] text-muted">
                  <FileText aria-hidden="true" size={14} /> 关联文章
                </dt>
                <dd className="text-sm font-semibold text-ink">
                  {String(account.articleCount)} 篇
                </dd>
              </div>
              <div className="flex items-center justify-between px-1 py-1 text-[11px]">
                <dt className="text-muted">当前状态</dt>
                <dd className="font-medium text-ink">{account.status}</dd>
              </div>
              <div className="flex items-center justify-between px-1 py-1 text-[11px]">
                <dt className="text-muted">默认主题</dt>
                <dd className="font-medium text-ink">
                  {account.defaultThemeId === null ? "未设置" : "已设置"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex items-start gap-2 rounded-control bg-success-soft px-3 py-3 text-[10px] leading-4 text-success">
              <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0" size={13} />
              品牌资产与微信授权尚未接入，不会显示虚假的连接状态。
            </div>
          </section>

          <section className="rounded-card border border-danger/20 bg-panel p-5 shadow-subtle">
            <div className="flex items-center gap-2 text-danger">
              <Trash2 aria-hidden="true" size={16} />
              <h2 className="text-sm font-semibold">永久删除</h2>
            </div>
            {impactQuery.isPending ? (
              <p className="mt-4 text-[11px] text-muted">正在检查关联数据…</p>
            ) : impact === undefined ? (
              <p className="mt-4 text-[11px] text-danger">删除影响检查失败，请刷新后重试。</p>
            ) : impact.canPermanentlyDelete ? (
              <>
                <p className="mt-3 text-[11px] leading-5 text-muted">
                  当前没有关联文章。输入 DELETE 后可永久删除，操作会保留审计记录。
                </p>
                <input
                  aria-label="永久删除确认词"
                  className="mt-3 h-9 w-full rounded-control border border-danger/25 px-3 font-mono text-[11px] text-ink outline-none focus:border-danger"
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="DELETE"
                  value={confirmation}
                />
                <button
                  className="mt-3 h-9 w-full rounded-control bg-danger text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={confirmation !== "DELETE" || deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`永久删除“${account.name}”？此操作不可恢复。`)) {
                      deleteMutation.mutate();
                    }
                  }}
                  type="button"
                >
                  {deleteMutation.isPending ? "正在删除…" : "永久删除公众号"}
                </button>
              </>
            ) : (
              <div className="mt-3 rounded-control bg-danger-soft px-3 py-3 text-[11px] leading-5 text-danger">
                {impact.blockingReasons.join("；")}。请先迁移或清理关联文章。
              </div>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}

function StateButton({
  icon: Icon,
  label,
  onClick,
}: {
  readonly icon: typeof Star;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded-control border border-line bg-panel px-3 text-[11px] font-medium text-ink hover:bg-hover"
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={14} />
      {label}
    </button>
  );
}

function DetailField({
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
      <span className="text-[11px] font-medium text-ink">
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
