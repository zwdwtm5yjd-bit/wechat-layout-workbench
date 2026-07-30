"use client";

import {
  Bell,
  Blocks,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  FileText,
  HardDrive,
  ImageUp,
  LayoutDashboard,
  Menu,
  Paintbrush,
  Plus,
  Radio,
  Search,
  Settings,
  Sparkles,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu, Tooltip } from "radix-ui";
import { useEffect, useState, type ReactNode } from "react";

import { getCurrentUser, logout, type AuthUser } from "../lib/auth/client";
import { useWorkspaceUiStore } from "../stores/workspace-ui-store";
import { ProductMark } from "./product-mark";
import { useAppToast } from "./ui/app-toast";

interface NavigationItem {
  readonly href?: string;
  readonly icon: LucideIcon;
  readonly label: string;
}

const navigationItems: readonly NavigationItem[] = [
  { href: "/workspace", icon: LayoutDashboard, label: "工作台" },
  { href: "/workspace/articles", icon: FileText, label: "文章" },
  { icon: Paintbrush, label: "主题" },
  { icon: Blocks, label: "组件" },
  { icon: Sparkles, label: "SVG 互动" },
  { icon: Radio, label: "公众号" },
  { icon: ImageUp, label: "素材更新" },
  { icon: Settings, label: "设置" },
];

export function WorkspaceShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const { pushToast } = useAppToast();
  const collapsed = useWorkspaceUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useWorkspaceUiStore((state) => state.toggleSidebar);
  const setCommandPaletteOpen = useWorkspaceUiStore((state) => state.setCommandPaletteOpen);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    void useWorkspaceUiStore.persist.rehydrate();
    let active = true;

    void getCurrentUser()
      .then((session) => {
        if (active) {
          setCurrentUser(session.user);
        }
      })
      .catch(() => {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.replace(`/login?next=${encodeURIComponent(next)}`);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // 即使服务端会话已过期，也清理当前页面并回到登录入口。
    } finally {
      window.location.replace("/login");
    }
  };

  const announceFoundationBoundary = (label: string) => {
    pushToast({
      description: "页面入口已经预留，将在对应业务任务中接入。",
      title: `${label}暂未开放`,
    });
  };
  const pageHeading = pathname.startsWith("/workspace/articles/")
    ? { description: "自动保存与版本保护", title: "文章文档" }
    : pathname.startsWith("/workspace/imports/")
      ? { description: "安全清洗与结构确认", title: "导入文章" }
      : pathname === "/workspace/articles"
        ? { description: "搜索、状态与回收站", title: "文章" }
        : { description: "快速开始与最近工作", title: "工作台" };

  return (
    <div className="min-h-screen bg-canvas">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-panel transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[72px]" : "w-56"
        }`}
      >
        <div className={`flex h-16 items-center ${collapsed ? "justify-center px-3" : "px-5"}`}>
          <Link aria-label="返回工作台" href="/workspace">
            <ProductMark compact={collapsed} />
          </Link>
        </div>
        <nav aria-label="主导航" className="flex-1 space-y-1 px-2.5 py-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/workspace"
                ? pathname === item.href
                : item.href !== undefined &&
                  (pathname === item.href || pathname.startsWith(`${item.href}/`));
            const navigationClassName = `flex h-10 w-full items-center rounded-control text-[13px] font-medium transition ${
              collapsed ? "justify-center px-0" : "gap-3 px-3"
            } ${
              active
                ? "bg-accent-soft text-accent-strong"
                : "text-muted hover:bg-hover hover:text-ink"
            }`;
            const navigationControl =
              item.href === undefined ? (
                <button
                  className={navigationClassName}
                  onClick={() => {
                    announceFoundationBoundary(item.label);
                  }}
                  type="button"
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
                  {collapsed ? null : <span>{item.label}</span>}
                </button>
              ) : (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={navigationClassName}
                  href={item.href}
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={1.9} />
                  {collapsed ? null : <span>{item.label}</span>}
                </Link>
              );

            return collapsed ? (
              <Tooltip.Root key={item.label}>
                <Tooltip.Trigger asChild>{navigationControl}</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="z-50 rounded-md bg-zinc-900 px-2.5 py-1.5 text-[11px] text-white shadow-raised"
                    side="right"
                    sideOffset={8}
                  >
                    {item.label}
                    <Tooltip.Arrow className="fill-zinc-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ) : (
              <div key={item.label}>{navigationControl}</div>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-line px-2.5 py-3">
          <button
            className={`flex h-10 w-full items-center rounded-control text-muted transition hover:bg-hover hover:text-ink ${
              collapsed ? "justify-center" : "gap-3 px-3"
            }`}
            onClick={() => {
              announceFoundationBoundary("存储状态");
            }}
            type="button"
          >
            <HardDrive aria-hidden="true" size={17} />
            {collapsed ? null : <span className="text-[13px]">存储状态</span>}
          </button>
          <button
            className={`flex h-10 w-full items-center rounded-control text-muted transition hover:bg-hover hover:text-ink ${
              collapsed ? "justify-center" : "gap-3 px-3"
            }`}
            onClick={() => {
              announceFoundationBoundary("帮助中心");
            }}
            type="button"
          >
            <CircleHelp aria-hidden="true" size={17} />
            {collapsed ? null : <span className="text-[13px]">帮助</span>}
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="打开用户菜单"
                className={`flex h-11 w-full items-center rounded-control transition hover:bg-hover ${
                  collapsed ? "justify-center" : "gap-3 px-2"
                }`}
                type="button"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-white">
                  <UserRound aria-hidden="true" size={15} />
                </span>
                {collapsed ? null : (
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {currentUser?.displayName ?? "正在验证…"}
                    </span>
                    <span className="block truncate text-[11px] text-faint">
                      {currentUser?.email ?? "私有工作台"}
                    </span>
                  </span>
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                className="z-50 min-w-48 rounded-control border border-line bg-panel p-1.5 shadow-raised"
                side="right"
                sideOffset={8}
              >
                <DropdownMenu.Label className="px-2 py-1.5 text-[11px] text-faint">
                  {currentUser === null
                    ? "正在验证会话"
                    : `${currentUser.displayName} · ${currentUser.role}`}
                </DropdownMenu.Label>
                <DropdownMenu.Item
                  className="rounded-md px-2 py-2 text-[13px] text-muted outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink"
                  onSelect={() => {
                    announceFoundationBoundary("账号设置");
                  }}
                >
                  账号设置
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className="rounded-md px-2 py-2 text-[13px] text-muted outline-none data-[highlighted]:bg-hover data-[highlighted]:text-ink"
                  disabled={loggingOut}
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleLogout();
                  }}
                >
                  {loggingOut ? "正在退出…" : "退出登录"}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <button
          aria-label={collapsed ? "展开导航" : "收起导航"}
          className="absolute top-20 -right-3 grid size-6 place-items-center rounded-full border border-line bg-panel text-faint shadow-subtle transition hover:text-ink"
          onClick={toggleSidebar}
          type="button"
        >
          {collapsed ? (
            <ChevronsRight aria-hidden="true" size={13} />
          ) : (
            <ChevronsLeft aria-hidden="true" size={13} />
          )}
        </button>
      </aside>

      <div
        className={`min-h-screen transition-[padding] duration-200 ${
          collapsed ? "lg:pl-[72px]" : "lg:pl-56"
        }`}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-panel/95 px-4 backdrop-blur-md sm:px-6 lg:px-7">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <ProductMark compact />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-ink">{pageHeading.title}</p>
              <p className="hidden text-[11px] text-faint sm:block">{pageHeading.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="hidden h-9 min-w-56 items-center gap-2 rounded-control border border-line bg-panel-muted px-3 text-left text-[12px] text-muted transition hover:border-line-strong md:flex"
              onClick={() => {
                setCommandPaletteOpen(true);
              }}
              type="button"
            >
              <Search aria-hidden="true" size={15} />
              <span className="flex-1">搜索或执行命令</span>
              <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] text-faint">
                ⌘ K
              </kbd>
            </button>
            <Link
              aria-label="导入文章"
              className="hidden h-9 items-center gap-2 rounded-control border border-line bg-panel px-3 text-[12px] font-medium text-ink transition hover:bg-hover sm:flex"
              href="/workspace/imports/paste"
            >
              <Upload aria-hidden="true" size={15} />
              导入
            </Link>
            <Link
              className="flex h-9 items-center gap-2 rounded-control bg-accent px-3.5 text-[12px] font-semibold text-white shadow-subtle transition hover:bg-accent-strong"
              href="/workspace/articles?new=1"
            >
              <Plus aria-hidden="true" size={15} />
              <span className="hidden sm:inline">新建排版</span>
              <span className="sm:hidden">新建</span>
            </Link>
            <button
              aria-label="通知"
              className="grid size-9 place-items-center rounded-control border border-line text-muted transition hover:bg-hover hover:text-ink"
              onClick={() => {
                announceFoundationBoundary("通知中心");
              }}
              type="button"
            >
              <Bell aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="打开菜单"
              className="grid size-9 place-items-center rounded-control border border-line text-muted transition hover:bg-hover hover:text-ink lg:hidden"
              onClick={() => {
                setCommandPaletteOpen(true);
              }}
              type="button"
            >
              <Menu aria-hidden="true" size={17} />
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
