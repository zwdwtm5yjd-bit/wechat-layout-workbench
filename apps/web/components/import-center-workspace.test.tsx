// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDocxImport } from "../lib/imports/client";
import { getJob } from "../lib/jobs/client";
import { uploadResource } from "../lib/resources/client";
import { ImportCenterWorkspace } from "./import-center-workspace";
import { AppToastProvider } from "./ui/app-toast";

const push = vi.fn();
const jobId = "019c0fb5-7d53-7f66-bfb7-f70c0e462601";
const articleId = "019c0fb5-7d53-7f66-bfb7-f70c0e462602";
const resourceId = "019c0fb5-7d53-7f66-bfb7-f70c0e462603";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../lib/imports/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/imports/client")>("../lib/imports/client");
  return { ...actual, createDocxImport: vi.fn() };
});
vi.mock("../lib/jobs/client", async () => {
  const actual = await vi.importActual<typeof import("../lib/jobs/client")>("../lib/jobs/client");
  return { ...actual, getJob: vi.fn() };
});
vi.mock("../lib/resources/client", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/resources/client")>("../lib/resources/client");
  return { ...actual, uploadResource: vi.fn() };
});

function Providers({ children }: { readonly children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <AppToastProvider>{children}</AppToastProvider>
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.mocked(createDocxImport).mockReset();
  vi.mocked(getJob).mockReset();
  vi.mocked(uploadResource).mockReset();
  window.history.replaceState(null, "", "/");
});

describe("ImportCenterWorkspace", () => {
  it("shows DOCX progress in place and opens structure review automatically", async () => {
    vi.mocked(uploadResource).mockResolvedValue({ id: resourceId } as never);
    vi.mocked(createDocxImport).mockResolvedValue({ jobId, articleId });
    vi.mocked(getJob).mockResolvedValue({
      id: jobId,
      articleId,
      status: "success",
      progress: 100,
      latestMessage: "DOCX 解析完成，等待结构确认",
      errorMessage: null,
    } as never);
    render(<ImportCenterWorkspace />, { wrapper: Providers });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /上传 DOCX/ }));
    const file = new File(["docx-bytes"], "活动稿.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await user.upload(screen.getByLabelText(/选择 DOCX 文件/), file);
    await user.click(screen.getByRole("button", { name: /开始安全导入/ }));

    await waitFor(() => expect(uploadResource).toHaveBeenCalledWith(file));
    await waitFor(() => expect(createDocxImport).toHaveBeenCalled());
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/workspace/imports/${articleId}/structure`),
    );
  });
});
