"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ExternalLink,
  FileText,
  FileUp,
  ImageIcon,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";

import { createDocxImport } from "../lib/imports/client";
import {
  createResourceAccessUrl,
  getResourceReferences,
  listResources,
  ResourceClientError,
  trashResource,
  uploadResource,
  type Resource,
} from "../lib/resources/client";
import { useAppToast } from "./ui/app-toast";

type ResourceFilter = "all" | "document" | "image" | "trash";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function errorMessage(error: unknown): string {
  return error instanceof ResourceClientError ? error.message : "素材服务暂时不可用";
}

export function ResourceLibrary() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { pushToast } = useAppToast();
  const [filter, setFilter] = useState<ResourceFilter>("all");
  const [selected, setSelected] = useState<Resource | null>(null);
  const [preview, setPreview] = useState<{
    readonly mimeType: Resource["mimeType"];
    readonly name: string;
    readonly url: string;
  } | null>(null);
  const resourcesQuery = useQuery({
    queryKey: ["resources", filter],
    queryFn: () =>
      listResources({
        ...(filter === "document" || filter === "image" ? { resourceType: filter } : {}),
        status: filter === "trash" ? "trash" : "active",
        pageSize: 60,
      }),
  });
  const referencesQuery = useQuery({
    queryKey: ["resource-references", selected?.id],
    queryFn: () => getResourceReferences(selected?.id ?? ""),
    enabled: selected !== null && selected.status === "active",
  });
  const uploadMutation = useMutation({
    mutationFn: async (files: readonly File[]) => {
      const completed: Resource[] = [];
      for (const file of files) completed.push(await uploadResource(file));
      return completed;
    },
    onSuccess: (resources) => {
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
      pushToast({
        title: resources.length === 1 ? "素材已安全上传" : `${resources.length} 个素材已安全上传`,
        description: "文件保持私有，需要使用时才签发短时访问地址。",
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({ title: "上传失败", description: errorMessage(error), tone: "warning" }),
  });
  const previewMutation = useMutation({
    mutationFn: async (resource: Resource) => ({
      mimeType: resource.mimeType,
      name: resource.originalFilename ?? resource.id,
      ...(await createResourceAccessUrl(
        resource.id,
        resource.thumbnail === null ? "original" : "thumbnail",
      )),
    }),
    onSuccess: (value) =>
      setPreview({ mimeType: value.mimeType, name: value.name, url: value.url }),
    onError: (error) =>
      pushToast({ title: "无法打开预览", description: errorMessage(error), tone: "warning" }),
  });
  const trashMutation = useMutation({
    mutationFn: (resourceId: string) => trashResource(resourceId),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["resources"] });
      pushToast({
        title: "素材已移入回收站",
        description: "未被引用的素材会保留 30 天。",
        tone: "success",
      });
    },
    onError: (error) =>
      pushToast({ title: "无法删除素材", description: errorMessage(error), tone: "warning" }),
  });
  const importMutation = useMutation({
    mutationFn: (resourceId: string) =>
      createDocxImport({
        resourceId,
        cleaningMode: "preserve_structure",
        contentType: "general",
        layoutStrength: "standard",
      }),
    onSuccess: (job) =>
      router.push(
        `/workspace/jobs?focus=${encodeURIComponent(job.jobId)}&article=${encodeURIComponent(job.articleId)}`,
      ),
    onError: (error) =>
      pushToast({
        title: "无法创建 DOCX 导入",
        description: error instanceof Error ? error.message : "请稍后重试",
        tone: "warning",
      }),
  });

  const items = resourcesQuery.data?.items ?? [];
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">PRIVATE ASSETS</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">素材库</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            管理文章图片和 DOCX 原文件。上传、查重、缩略图、引用保护、短时预览和回收站已经接通。
          </p>
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 self-start rounded-control bg-accent px-4 text-[12px] font-semibold text-white shadow-subtle hover:bg-accent-strong">
          {uploadMutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
          ) : (
            <UploadCloud aria-hidden="true" size={15} />
          )}
          {uploadMutation.isPending ? "正在校验并上传…" : "上传素材"}
          <input
            accept="image/png,image/jpeg,image/webp,image/gif,.docx"
            className="sr-only"
            disabled={uploadMutation.isPending}
            multiple
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              if (files.length > 0) uploadMutation.mutate(files);
              event.currentTarget.value = "";
            }}
            type="file"
          />
        </label>
      </section>

      <section className="rounded-card border border-accent/15 bg-accent-soft/60 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-control bg-panel text-accent shadow-subtle">
            <ShieldCheck aria-hidden="true" size={16} />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">默认私有，不暴露永久链接</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              素材只在预览或编辑时签发 5 分钟地址；被文章、原文件或头像引用时禁止删除。
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-panel shadow-subtle">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "全部"],
                ["image", "图片"],
                ["document", "DOCX"],
                ["trash", "回收站"],
              ] as const
            ).map(([value, label]) => (
              <button
                className={`h-8 rounded-control px-3 text-[11px] font-medium ${filter === value ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover"}`}
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="inline-flex h-8 items-center gap-1.5 self-start rounded-control border border-line px-3 text-[11px] text-muted hover:bg-hover"
            onClick={() => void resourcesQuery.refetch()}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={12} />
            刷新
          </button>
        </div>

        {resourcesQuery.isPending ? (
          <div className="grid min-h-72 place-items-center text-[12px] text-muted">
            <span className="inline-flex items-center gap-2">
              <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
              正在读取素材…
            </span>
          </div>
        ) : resourcesQuery.isError ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <Archive aria-hidden="true" className="mx-auto text-danger" size={23} />
              <p className="mt-3 text-[13px] font-semibold text-ink">无法读取素材库</p>
              <p className="mt-1 text-[11px] text-muted">{errorMessage(resourcesQuery.error)}</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <FileUp aria-hidden="true" className="mx-auto text-faint" size={25} />
              <p className="mt-3 text-sm font-semibold text-ink">
                {filter === "trash" ? "回收站为空" : "还没有素材"}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {filter === "trash"
                  ? "删除的未引用素材会在这里保留 30 天。"
                  : "上传图片或 DOCX，素材会安全存入私有对象存储。"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((resource) => (
              <article
                className="rounded-card border border-line bg-panel p-4 transition hover:border-line-strong hover:shadow-subtle"
                key={resource.id}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-control ${resource.resourceType === "image" ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning"}`}
                  >
                    {resource.resourceType === "image" ? (
                      <ImageIcon aria-hidden="true" size={17} />
                    ) : (
                      <FileText aria-hidden="true" size={17} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      className="truncate text-[12px] font-semibold text-ink"
                      title={resource.originalFilename ?? resource.id}
                    >
                      {resource.originalFilename ?? "未命名素材"}
                    </h2>
                    <p className="mt-1 text-[10px] text-faint">
                      {formatBytes(resource.fileSize)} · {formatDate(resource.createdAt)}
                    </p>
                    {resource.width === null ? null : (
                      <p className="mt-1 font-mono text-[10px] text-faint">
                        {resource.width} × {resource.height}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {resource.status === "active" ? (
                    <button
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-control border border-line text-[11px] text-ink hover:bg-hover"
                      onClick={() => previewMutation.mutate(resource)}
                      type="button"
                    >
                      <ExternalLink aria-hidden="true" size={12} />
                      预览
                    </button>
                  ) : (
                    <span className="text-[10px] text-faint">
                      {resource.purgeAfter === null
                        ? "等待清理"
                        : `${formatDate(resource.purgeAfter)} 清理`}
                    </span>
                  )}
                  {resource.status === "active" && resource.resourceType === "document" ? (
                    <button
                      className="inline-flex h-8 flex-1 items-center justify-center rounded-control bg-accent text-[11px] font-semibold text-white disabled:opacity-50"
                      disabled={importMutation.isPending}
                      onClick={() => importMutation.mutate(resource.id)}
                      type="button"
                    >
                      导入文章
                    </button>
                  ) : null}
                  {resource.status === "active" ? (
                    <button
                      aria-label="管理素材"
                      className="grid size-8 place-items-center rounded-control border border-line text-muted hover:bg-hover"
                      onClick={() => setSelected(resource)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={12} />
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog.Root
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        open={selected !== null}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(500px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-panel p-6 shadow-raised">
            <Dialog.Title className="text-base font-semibold text-ink">管理素材</Dialog.Title>
            <Dialog.Description className="mt-1 truncate text-[12px] text-muted">
              {selected?.originalFilename}
            </Dialog.Description>
            <div className="mt-5 rounded-control border border-line bg-panel-muted p-4">
              <p className="text-[11px] font-medium text-ink">引用检查</p>
              {referencesQuery.isPending ? (
                <p className="mt-2 text-[11px] text-muted">正在检查引用…</p>
              ) : referencesQuery.data?.total === 0 ? (
                <p className="mt-2 text-[11px] text-success">没有引用，可以移入回收站。</p>
              ) : (
                <div className="mt-2">
                  <p className="text-[11px] text-warning">
                    当前有 {referencesQuery.data?.total ?? 0} 个引用，不能删除。
                  </p>
                  <ul className="mt-2 space-y-1 text-[10px] text-muted">
                    {referencesQuery.data?.items.slice(0, 5).map((reference) => (
                      <li key={`${reference.kind}-${reference.id}`}>
                        {reference.label} · {reference.kind}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close className="h-9 rounded-control border border-line px-4 text-[12px] text-muted">
                取消
              </Dialog.Close>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-control bg-danger px-4 text-[12px] font-semibold text-white disabled:opacity-45"
                disabled={
                  trashMutation.isPending || referencesQuery.data?.total !== 0 || selected === null
                }
                onClick={() => {
                  if (selected !== null) trashMutation.mutate(selected.id);
                }}
                type="button"
              >
                <Trash2 aria-hidden="true" size={13} />
                移入回收站
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        open={preview !== null}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-card border border-line bg-panel p-4 shadow-raised">
            <Dialog.Title className="mb-3 truncate text-[13px] font-semibold text-ink">
              {preview?.name}
            </Dialog.Title>
            {preview === null ? null : preview.mimeType.startsWith("image/") ? (
              <img
                alt={preview.name}
                className="mx-auto max-h-[75vh] max-w-full rounded-control object-contain"
                src={preview.url}
              />
            ) : (
              <div className="grid min-h-64 place-items-center rounded-control bg-panel-muted p-8 text-center">
                <div>
                  <FileText aria-hidden="true" className="mx-auto text-warning" size={34} />
                  <p className="mt-4 text-[13px] font-semibold text-ink">DOCX 原文件已准备好</p>
                  <p className="mt-1 text-[11px] text-muted">短时地址将在 5 分钟后失效。</p>
                  <a
                    className="mt-5 inline-flex h-9 items-center rounded-control bg-accent px-4 text-[11px] font-semibold text-white"
                    href={preview.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    打开或下载文件
                  </a>
                </div>
              </div>
            )}
            <Dialog.Close className="mt-4 h-9 w-full rounded-control border border-line text-[12px] text-ink">
              关闭预览
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
