"use client";

import { FilePlus2, FileUp, LayoutDashboard, Search, Settings, SwatchBook, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState } from "react";

import { useWorkspaceUiStore } from "../stores/workspace-ui-store";
import { useAppToast } from "./ui/app-toast";

interface CommandItem {
  readonly description: string;
  readonly href?: string;
  readonly icon: typeof Search;
  readonly label: string;
}

const commands: readonly CommandItem[] = [
  {
    description: "返回工作台首页",
    href: "/workspace",
    icon: LayoutDashboard,
    label: "打开工作台",
  },
  {
    description: "创建一篇空白文章",
    icon: FilePlus2,
    label: "新建排版",
  },
  {
    description: "从 Word 或 WPS 导入",
    href: "/workspace/imports/paste?source=word",
    icon: FileUp,
    label: "导入文章",
  },
  {
    description: "浏览可用主题",
    href: "/workspace/themes",
    icon: SwatchBook,
    label: "打开主题中心",
  },
  {
    description: "管理工作台偏好",
    href: "/workspace/settings",
    icon: Settings,
    label: "打开设置",
  },
];

export function CommandPalette() {
  const router = useRouter();
  const { pushToast } = useAppToast();
  const open = useWorkspaceUiStore((state) => state.commandPaletteOpen);
  const setOpen = useWorkspaceUiStore((state) => state.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleCommands = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");

    return normalizedQuery === ""
      ? commands
      : commands.filter((command) =>
          `${command.label} ${command.description}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedQuery),
        );
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const execute = (command: CommandItem) => {
    setOpen(false);

    if (command.href !== undefined) {
      router.push(command.href);
      return;
    }

    pushToast({
      description: "交互入口已经就绪，业务能力将在对应开发任务中接入。",
      title: `${command.label}暂未开放`,
      tone: "warning",
    });
  };

  return (
    <Dialog.Root onOpenChange={setOpen} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-zinc-950/30 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby="command-palette-description"
          className="dialog-content fixed top-[14vh] left-1/2 z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-card border border-line bg-panel shadow-raised"
        >
          <Dialog.Title className="sr-only">命令面板</Dialog.Title>
          <Dialog.Description className="sr-only" id="command-palette-description">
            搜索页面和常用操作，使用上下方向键选择，回车执行。
          </Dialog.Description>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search aria-hidden="true" className="text-faint" size={19} />
            <input
              aria-label="搜索命令"
              autoFocus
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((index) =>
                    visibleCommands.length === 0 ? 0 : (index + 1) % visibleCommands.length,
                  );
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((index) =>
                    visibleCommands.length === 0
                      ? 0
                      : (index - 1 + visibleCommands.length) % visibleCommands.length,
                  );
                } else if (event.key === "Enter") {
                  const command = visibleCommands[activeIndex];
                  if (command !== undefined) {
                    event.preventDefault();
                    execute(command);
                  }
                }
              }}
              placeholder="搜索页面或执行命令…"
              value={query}
            />
            <Dialog.Close
              aria-label="关闭命令面板"
              className="rounded-control p-1.5 text-faint transition hover:bg-hover hover:text-ink"
            >
              <X aria-hidden="true" size={17} />
            </Dialog.Close>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {visibleCommands.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">没有匹配的命令</p>
            ) : (
              visibleCommands.map((command, index) => {
                const Icon = command.icon;

                return (
                  <button
                    className={`flex w-full items-center gap-3 rounded-control px-3 py-3 text-left transition ${
                      activeIndex === index ? "bg-accent-soft" : "hover:bg-hover"
                    }`}
                    key={command.label}
                    onClick={() => {
                      execute(command);
                    }}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                    type="button"
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-control border ${
                        activeIndex === index
                          ? "border-indigo-200 bg-panel text-accent"
                          : "border-line bg-panel-muted text-muted"
                      }`}
                    >
                      <Icon aria-hidden="true" size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{command.label}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted">
                        {command.description}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-line bg-panel-muted px-4 py-2 text-[11px] text-faint">
            <span>↑↓ 选择 · Enter 执行 · Esc 关闭</span>
            <span>全局命令</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
