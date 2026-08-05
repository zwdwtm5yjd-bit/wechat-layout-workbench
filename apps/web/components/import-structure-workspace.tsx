"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileSearch,
  ImageIcon,
  ListChecks,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  Text,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  confirmImportStructure,
  getImportStructure,
  ImportClientError,
  type ImportBlockRole,
  type ImportStructure,
} from "../lib/imports/client";
import { useAppToast } from "./ui/app-toast";
import { CreationProgress } from "./creation-progress";

const roles: readonly { readonly label: string; readonly value: ImportBlockRole }[] = [
  { value: "title", label: "主标题" },
  { value: "subtitle", label: "副标题" },
  { value: "heading_1", label: "一级标题" },
  { value: "heading_2", label: "二级标题" },
  { value: "heading_3", label: "三级标题" },
  { value: "paragraph", label: "正文" },
  { value: "quote", label: "引用" },
  { value: "bullet_item", label: "无序列表" },
  { value: "ordered_item", label: "有序列表" },
  { value: "image_reference", label: "图片引用" },
  { value: "excluded", label: "排除" },
];

const sourceLabels: Readonly<Record<ImportStructure["detectedSource"], string>> = {
  word: "Microsoft Word",
  wps: "WPS",
  web: "网页",
  wechat: "微信公众号",
  markdown: "Markdown",
  plain_text: "纯文本",
  chatgpt: "ChatGPT",
  claude: "Claude",
};

function errorMessage(error: unknown): string {
  if (error instanceof ImportClientError && error.status === 409) {
    const currentVersion = error.details?.currentVersion;
    return typeof currentVersion === "number"
      ? `文章已在其他页面更新到 v${currentVersion}，请刷新后重新确认。`
      : "文章已在其他页面更新，请刷新后重新确认。";
  }
  return error instanceof ImportClientError ? error.message : "结构确认失败，请稍后重试";
}

function roleLabel(role: ImportBlockRole): string {
  return roles.find((item) => item.value === role)?.label ?? role;
}

function roleTone(role: ImportBlockRole): string {
  if (role === "title" || role.startsWith("heading")) {
    return "border-indigo-200 bg-accent-soft";
  }
  if (role === "excluded") {
    return "border-line bg-panel-muted opacity-60";
  }
  if (role === "image_reference") {
    return "border-amber-200 bg-amber-50";
  }
  return "border-line bg-panel";
}

export function ImportStructureWorkspace({ articleId }: { readonly articleId: string }) {
  const router = useRouter();
  const { pushToast } = useAppToast();
  const [rolesById, setRolesById] = useState<Readonly<Record<string, ImportBlockRole>>>({});
  const [initialRolesById, setInitialRolesById] = useState<
    Readonly<Record<string, ImportBlockRole>>
  >({});
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [batchRole, setBatchRole] = useState<ImportBlockRole>("paragraph");
  const [title, setTitle] = useState("");
  const [initializedKey, setInitializedKey] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const structureQuery = useQuery({
    queryKey: ["import-structure", articleId],
    queryFn: () => getImportStructure(articleId),
  });

  useEffect(() => {
    const structure = structureQuery.data;
    if (structure === undefined) {
      return;
    }
    const nextKey = `${structure.sourceDocumentId}:${structure.documentVersion}`;
    if (nextKey === initializedKey) {
      return;
    }
    const nextRoles = Object.fromEntries(
      structure.blocks.map((block) => [block.sourceBlockId, block.role]),
    ) as Readonly<Record<string, ImportBlockRole>>;
    setRolesById(nextRoles);
    setInitialRolesById(nextRoles);
    setTitle(structure.title);
    setSelectedIds([]);
    setTransactionId(crypto.randomUUID());
    setInitializedKey(nextKey);
  }, [initializedKey, structureQuery.data]);

  const changedCount = useMemo(() => {
    return Object.entries(rolesById).filter(
      ([sourceBlockId, role]) => initialRolesById[sourceBlockId] !== role,
    ).length;
  }, [initialRolesById, rolesById]);

  const confirmMutation = useMutation({
    mutationFn: (structure: ImportStructure) =>
      confirmImportStructure({
        articleId,
        title: title.trim() || null,
        baseVersion: structure.documentVersion,
        lastTransactionId: transactionId || crypto.randomUUID(),
        blocks: structure.blocks.map((block) => ({
          sourceBlockId: block.sourceBlockId,
          role: rolesById[block.sourceBlockId] ?? block.role,
        })),
      }),
    onSuccess: (result) => {
      pushToast({
        title: "文章结构已确认",
        description: `文档 v${result.documentVersion} 与导入快照 #${result.snapshotNumber} 已保存。`,
        tone: "success",
      });
      router.push(`${result.editorUrl}?guide=1`);
    },
    onError: (error) => {
      pushToast({
        title: "确认未执行",
        description: errorMessage(error),
        tone: "warning",
      });
    },
  });

  const changeRole = (sourceBlockId: string, role: ImportBlockRole) => {
    setRolesById((current) => ({ ...current, [sourceBlockId]: role }));
    setTransactionId(crypto.randomUUID());
  };

  const applyBatchRole = () => {
    if (selectedIds.length === 0) {
      pushToast({
        title: "尚未选择内容块",
        description: "勾选右侧内容块后再批量设置角色。",
      });
      return;
    }
    setRolesById((current) => {
      const next = { ...current };
      for (const sourceBlockId of selectedIds) {
        next[sourceBlockId] = batchRole;
      }
      return next;
    });
    setTransactionId(crypto.randomUUID());
  };

  if (structureQuery.isPending) {
    return (
      <div className="grid min-h-[560px] place-items-center text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
          正在读取识别结果…
        </span>
      </div>
    );
  }

  if (structureQuery.isError) {
    return (
      <section className="grid min-h-[520px] place-items-center rounded-card border border-line bg-panel p-8 text-center shadow-subtle">
        <div>
          <ShieldAlert aria-hidden="true" className="mx-auto text-danger" size={24} />
          <h1 className="mt-4 text-base font-semibold text-ink">无法读取导入结构</h1>
          <p className="mt-2 text-[12px] text-muted">{errorMessage(structureQuery.error)}</p>
          <button
            className="mt-5 h-9 rounded-control bg-accent px-4 text-[12px] font-semibold text-white"
            onClick={() => {
              void structureQuery.refetch();
            }}
            type="button"
          >
            重新加载
          </button>
        </div>
      </section>
    );
  }

  const structure = structureQuery.data;
  const allSelected = structure.blocks.length > 0 && selectedIds.length === structure.blocks.length;
  const alreadyConfirmed = structure.status === "pending_layout";

  return (
    <div className="space-y-5">
      <CreationProgress current={2} />
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">STRUCTURE REVIEW</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">确认文章结构</h1>
          <p className="mt-2 text-[13px] text-muted">
            来源：{sourceLabels[structure.detectedSource]} · 文档 v{structure.documentVersion} ·{" "}
            {structure.statistics.blockCount} 个内容块
          </p>
        </div>
        {alreadyConfirmed ? (
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[12px] font-semibold text-white"
            href={`/workspace/articles/${articleId}`}
          >
            已确认，进入编辑器
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        ) : (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[12px] font-semibold text-white shadow-subtle transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            disabled={confirmMutation.isPending || initializedKey === ""}
            onClick={() => {
              confirmMutation.mutate(structure);
            }}
            type="button"
          >
            {confirmMutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
            ) : (
              <Check aria-hidden="true" size={15} />
            )}
            {confirmMutation.isPending ? "正在生成文档…" : "确认并进入排版"}
          </button>
        )}
      </section>

      {structure.warnings.length === 0 ? (
        <section className="flex items-center gap-2 rounded-control border border-emerald-200 bg-success-soft px-4 py-3 text-[11px] text-success">
          <Check aria-hidden="true" size={14} />
          未发现需要人工处理的兼容性问题。
        </section>
      ) : (
        <section
          aria-label="导入警告"
          className="rounded-card border border-amber-200 bg-amber-50/80 p-4"
        >
          <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-900">
            <AlertTriangle aria-hidden="true" size={15} />
            清洗与兼容提示
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {structure.warnings.map((warning) => (
              <div
                className="rounded-control border border-amber-200/70 bg-white/60 px-3 py-2"
                key={warning.code}
              >
                <p className="text-[11px] font-medium text-amber-950">
                  {warning.message}
                  {warning.count > 1 ? ` × ${warning.count}` : ""}
                </p>
                <p className="mt-0.5 text-[9px] text-amber-700">{warning.code}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {[
          ["字符", structure.statistics.characterCount],
          ["字词", structure.statistics.wordCount],
          ["标题", structure.statistics.headingCount],
          ["图片引用", structure.statistics.imageCount],
          ["表格", structure.statistics.tableCount],
          ["移除样式", structure.statistics.removedStyleCount],
          ["安全节点", structure.statistics.removedSecurityNodeCount],
          ["隐藏节点", structure.statistics.removedHiddenNodeCount],
        ].map(([label, value]) => (
          <div
            className="rounded-control border border-line bg-panel px-3 py-3 shadow-subtle"
            key={label}
          >
            <p className="text-[10px] text-faint">{label}</p>
            <p className="mt-1 text-base font-semibold text-ink">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-card border border-line bg-panel shadow-subtle">
        <div className="border-b border-line p-4">
          <label className="block max-w-2xl">
            <span className="mb-1.5 block text-[11px] font-medium text-muted">文章标题</span>
            <input
              className="h-10 w-full rounded-control border border-line bg-panel-muted px-3 text-sm font-semibold text-ink outline-none focus:border-accent focus:ring-3 focus:ring-indigo-100 disabled:opacity-60"
              disabled={alreadyConfirmed}
              maxLength={500}
              onChange={(event) => {
                setTitle(event.target.value);
                setTransactionId(crypto.randomUUID());
              }}
              value={title}
            />
          </label>
        </div>

        <div className="grid xl:grid-cols-2">
          <div className="border-b border-line xl:border-r xl:border-b-0">
            <div className="flex h-12 items-center gap-2 border-b border-line bg-panel-muted px-4">
              <FileSearch aria-hidden="true" className="text-muted" size={15} />
              <h2 className="text-[12px] font-semibold text-ink">标准化原文</h2>
              <span className="ml-auto text-[10px] text-faint">只读 · 未保存 HTML</span>
            </div>
            <pre className="max-h-[680px] min-h-[420px] overflow-auto whitespace-pre-wrap break-words p-5 font-sans text-[13px] leading-7 text-muted">
              {structure.originalText}
            </pre>
          </div>

          <div className="min-w-0">
            <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-line bg-panel-muted px-4 py-2">
              <label className="inline-flex items-center gap-2 text-[11px] text-muted">
                <input
                  aria-label="选择全部内容块"
                  checked={allSelected}
                  disabled={alreadyConfirmed}
                  onChange={(event) => {
                    setSelectedIds(
                      event.target.checked
                        ? structure.blocks.map((block) => block.sourceBlockId)
                        : [],
                    );
                  }}
                  type="checkbox"
                />
                全选
              </label>
              <select
                aria-label="批量角色"
                className="h-8 rounded-control border border-line bg-panel px-2 text-[11px] text-ink outline-none"
                disabled={alreadyConfirmed}
                onChange={(event) => {
                  setBatchRole(event.target.value as ImportBlockRole);
                }}
                value={batchRole}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <button
                className="h-8 rounded-control border border-line bg-panel px-3 text-[11px] font-medium text-ink hover:bg-hover disabled:opacity-50"
                disabled={alreadyConfirmed || selectedIds.length === 0}
                onClick={applyBatchRole}
                type="button"
              >
                应用到 {selectedIds.length} 项
              </button>
              <button
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-[11px] text-muted hover:bg-hover disabled:opacity-50"
                disabled={alreadyConfirmed || changedCount === 0}
                onClick={() => {
                  setRolesById(initialRolesById);
                  setTransactionId(crypto.randomUUID());
                }}
                type="button"
              >
                <RotateCcw aria-hidden="true" size={12} />
                重置 {changedCount > 0 ? `(${changedCount})` : ""}
              </button>
            </div>

            <div className="max-h-[680px] min-h-[420px] space-y-2 overflow-auto p-3">
              {structure.blocks.map((block) => {
                const role = rolesById[block.sourceBlockId] ?? block.role;
                const selected = selectedIds.includes(block.sourceBlockId);
                return (
                  <article
                    className={`rounded-control border p-3 transition ${roleTone(role)} ${
                      selected ? "ring-2 ring-indigo-200" : ""
                    }`}
                    key={block.sourceBlockId}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        aria-label={`选择内容块 ${block.orderIndex + 1}`}
                        checked={selected}
                        className="mt-2.5"
                        disabled={alreadyConfirmed}
                        onChange={(event) => {
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, block.sourceBlockId]
                              : current.filter((id) => id !== block.sourceBlockId),
                          );
                        }}
                        type="checkbox"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-faint">
                            {role === "image_reference" ? (
                              <ImageIcon aria-hidden="true" size={11} />
                            ) : role.includes("item") ? (
                              <ListChecks aria-hidden="true" size={11} />
                            ) : (
                              <Text aria-hidden="true" size={11} />
                            )}
                            #{block.orderIndex + 1} · {roleLabel(role)}
                          </span>
                          <select
                            aria-label={`内容块 ${block.orderIndex + 1} 的角色`}
                            className="h-8 rounded-control border border-line bg-panel px-2 text-[11px] text-ink outline-none sm:ml-auto"
                            disabled={alreadyConfirmed}
                            onChange={(event) => {
                              changeRole(
                                block.sourceBlockId,
                                event.target.value as ImportBlockRole,
                              );
                            }}
                            value={role}
                          >
                            {roles.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p
                          className={`mt-2 whitespace-pre-wrap break-words text-[13px] leading-6 ${
                            role === "excluded" ? "line-through text-faint" : "text-ink"
                          }`}
                        >
                          {block.text || block.relation.alt || "未命名图片引用"}
                        </p>
                        {block.relation.sourceUrl === undefined ||
                        block.relation.sourceUrl === null ? null : (
                          <p className="mt-1 truncate text-[9px] text-amber-700">
                            外部引用：{block.relation.sourceUrl}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-panel p-4 shadow-subtle sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-5 text-muted">
          确认后将进入待排版状态，同时保存不可变的“导入后”快照。原文和 Source Block
          标识继续保留用于追踪。
        </p>
        {alreadyConfirmed ? null : (
          <button
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[12px] font-semibold text-white disabled:opacity-50"
            disabled={confirmMutation.isPending}
            onClick={() => {
              confirmMutation.mutate(structure);
            }}
            type="button"
          >
            {confirmMutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
            ) : (
              <Check aria-hidden="true" size={15} />
            )}
            确认结构
          </button>
        )}
      </section>
    </div>
  );
}
