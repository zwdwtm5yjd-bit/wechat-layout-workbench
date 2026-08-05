"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  cancelJob,
  JobClientError,
  listJobs,
  retryJob,
  type Job,
  type JobStatus,
} from "../lib/jobs/client";
import { useAppToast } from "./ui/app-toast";

const filters: readonly { readonly label: string; readonly value?: JobStatus }[] = [
  { label: "全部" },
  { label: "排队中", value: "queued" },
  { label: "执行中", value: "running" },
  { label: "已完成", value: "success" },
  { label: "失败", value: "failed" },
  { label: "已取消", value: "cancelled" },
];

const statusLabels: Record<JobStatus, string> = {
  queued: "排队中",
  running: "执行中",
  success: "已完成",
  failed: "失败",
  cancelled: "已取消",
  retry_pending: "等待重试",
};

function jobTypeLabel(jobType: string): string {
  if (jobType === "import.docx.parse") return "DOCX 解析";
  if (jobType === "import.webpage.fetch") return "网页导入";
  if (jobType === "maintenance.probe") return "系统自检";
  return jobType;
}

function statusTone(status: JobStatus): string {
  if (status === "success") return "bg-success-soft text-success";
  if (status === "failed") return "bg-danger-soft text-danger";
  if (status === "running" || status === "retry_pending") return "bg-accent-soft text-accent";
  if (status === "cancelled") return "bg-panel-muted text-faint";
  return "bg-warning-soft text-warning";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function JobCenter() {
  const queryClient = useQueryClient();
  const { pushToast } = useAppToast();
  const [status, setStatus] = useState<JobStatus | undefined>();
  const [focusId, setFocusId] = useState<string | null>(null);
  const jobsQuery = useQuery({
    queryKey: ["jobs", status],
    queryFn: () => listJobs({ ...(status === undefined ? {} : { status }), pageSize: 50 }),
    refetchInterval: (query) => {
      const jobs = query.state.data?.items ?? [];
      return jobs.some((job) => ["queued", "running", "retry_pending"].includes(job.status))
        ? 1_500
        : 10_000;
    },
  });

  useEffect(() => {
    setFocusId(new URLSearchParams(window.location.search).get("focus"));
  }, []);

  const action = useMutation({
    mutationFn: ({ id, kind }: { readonly id: string; readonly kind: "cancel" | "retry" }) =>
      kind === "cancel" ? cancelJob(id) : retryJob(id),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      pushToast({
        title: variables.kind === "cancel" ? "任务已取消" : "任务已重新入队",
        tone: "success",
      });
    },
    onError: (error) => {
      pushToast({
        title: "任务操作失败",
        description: error instanceof JobClientError ? error.message : "请稍后重试",
        tone: "warning",
      });
    },
  });

  const jobs = jobsQuery.data?.items ?? [];
  const runningCount = jobs.filter((job) =>
    ["queued", "running", "retry_pending"].includes(job.status),
  ).length;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[12px] font-medium text-accent">BACKGROUND JOBS</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">任务中心</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            查看 DOCX 解析、网页抓取等后台任务的实时进度，失败任务可重试，运行任务可取消。
          </p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-panel px-3 py-1.5 text-[11px] text-muted shadow-subtle">
          {runningCount > 0 ? (
            <LoaderCircle aria-hidden="true" className="animate-spin text-accent" size={13} />
          ) : (
            <CheckCircle2 aria-hidden="true" className="text-success" size={13} />
          )}
          {runningCount > 0 ? `${runningCount} 个任务处理中` : "当前没有运行任务"}
        </span>
      </section>

      <section className="rounded-card border border-line bg-panel shadow-subtle">
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1" role="tablist">
            {filters.map((filter) => (
              <button
                aria-selected={status === filter.value}
                className={`h-8 rounded-control px-3 text-[11px] font-medium ${status === filter.value ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover"}`}
                key={filter.label}
                onClick={() => setStatus(filter.value)}
                role="tab"
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button
            className="inline-flex h-8 items-center gap-1.5 self-start rounded-control border border-line px-3 text-[11px] text-muted hover:bg-hover"
            onClick={() => void jobsQuery.refetch()}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={12} />
            刷新
          </button>
        </div>

        {jobsQuery.isPending ? (
          <div className="grid min-h-72 place-items-center text-[12px] text-muted">
            <span className="inline-flex items-center gap-2">
              <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
              正在读取任务…
            </span>
          </div>
        ) : jobsQuery.isError ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto text-danger" size={22} />
              <p className="mt-3 text-[13px] font-semibold text-ink">无法读取任务</p>
              <p className="mt-1 text-[11px] text-muted">
                {jobsQuery.error instanceof JobClientError
                  ? jobsQuery.error.message
                  : "任务服务暂时不可用"}
              </p>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 text-center">
            <div>
              <Clock3 aria-hidden="true" className="mx-auto text-faint" size={24} />
              <p className="mt-3 text-sm font-semibold text-ink">还没有后台任务</p>
              <p className="mt-1 text-[12px] text-muted">
                上传 DOCX 或导入网页后，任务会显示在这里。
              </p>
              <Link
                className="mt-4 inline-flex text-[12px] font-medium text-accent"
                href="/workspace/imports/paste"
              >
                去导入文章
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {jobs.map((job) => (
              <JobRow
                busy={action.isPending && action.variables?.id === job.id}
                focused={focusId === job.id}
                job={job}
                key={job.id}
                onAction={(kind) => action.mutate({ id: job.id, kind })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function JobRow({
  busy,
  focused,
  job,
  onAction,
}: {
  readonly busy: boolean;
  readonly focused: boolean;
  readonly job: Job;
  readonly onAction: (kind: "cancel" | "retry") => void;
}) {
  const canCancel = ["queued", "running", "retry_pending"].includes(job.status);
  return (
    <article
      className={`px-5 py-4 transition ${focused ? "bg-accent-soft/50" : "hover:bg-hover/60"}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-control bg-panel-muted text-muted">
          <FileSearch aria-hidden="true" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-semibold text-ink">{jobTypeLabel(job.jobType)}</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone(job.status)}`}
            >
              {statusLabels[job.status]}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted">
            {job.latestMessage ?? job.errorMessage ?? "任务已创建"}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 max-w-sm flex-1 overflow-hidden rounded-full bg-panel-muted">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <span className="w-8 font-mono text-[10px] text-faint">{job.progress}%</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:ml-4">
          <span className="mr-2 hidden text-[10px] text-faint sm:inline">
            {formatTime(job.updatedAt)}
          </span>
          {job.status === "success" && job.articleId !== null ? (
            <Link
              className="inline-flex h-8 items-center rounded-control bg-accent px-3 text-[11px] font-semibold text-white"
              href={`/workspace/imports/${encodeURIComponent(job.articleId)}/structure`}
            >
              确认结构
            </Link>
          ) : null}
          {job.status === "failed" ? (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-[11px] text-ink hover:bg-hover disabled:opacity-50"
              disabled={busy}
              onClick={() => onAction("retry")}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={12} />
              重试
            </button>
          ) : null}
          {canCancel ? (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-[11px] text-muted hover:bg-hover disabled:opacity-50"
              disabled={busy}
              onClick={() => onAction("cancel")}
              type="button"
            >
              <Ban aria-hidden="true" size={12} />
              取消
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
