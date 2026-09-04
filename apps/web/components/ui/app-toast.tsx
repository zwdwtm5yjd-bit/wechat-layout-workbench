"use client";

import { X } from "lucide-react";
import { Toast } from "radix-ui";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

interface ToastInput {
  readonly description?: string;
  readonly title: string;
  readonly tone?: "default" | "error" | "success" | "warning";
}

interface ToastMessage extends ToastInput {
  readonly id: number;
}

interface ToastContextValue {
  pushToast(input: ToastInput): void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function AppToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const nextId = useRef(0);
  const [messages, setMessages] = useState<readonly ToastMessage[]>([]);

  const pushToast = useCallback((input: ToastInput) => {
    nextId.current += 1;
    setMessages((current) => [...current.slice(-2), { ...input, id: nextId.current }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider duration={5_000} label="通知" swipeDirection="right">
        {children}
        {messages.map((message) => {
          const persistent = message.tone === "error" || message.tone === "warning";

          return (
            <Toast.Root
              className={
                message.tone === "error"
                  ? "toast-root grid grid-cols-[1fr_auto] gap-x-3 rounded-card border border-danger/20 bg-danger-soft px-4 py-3 shadow-raised"
                  : message.tone === "warning"
                    ? "toast-root grid grid-cols-[1fr_auto] gap-x-3 rounded-card border border-warning/20 bg-warning-soft px-4 py-3 shadow-raised"
                    : message.tone === "success"
                      ? "toast-root grid grid-cols-[1fr_auto] gap-x-3 rounded-card border border-success/20 bg-success-soft px-4 py-3 shadow-raised"
                      : "toast-root grid grid-cols-[1fr_auto] gap-x-3 rounded-card border border-line bg-panel px-4 py-3 shadow-raised"
              }
              duration={persistent ? Number.POSITIVE_INFINITY : 5_000}
              key={message.id}
              onOpenChange={(open) => {
                if (!open) {
                  dismiss(message.id);
                }
              }}
              type={persistent ? "foreground" : "background"}
            >
              <div className="self-center">
                <Toast.Title
                  className={
                    message.tone === "success"
                      ? "text-sm font-semibold text-success"
                      : message.tone === "warning"
                        ? "text-sm font-semibold text-warning"
                        : message.tone === "error"
                          ? "text-sm font-semibold text-danger"
                          : "text-sm font-semibold text-ink"
                  }
                >
                  {message.title}
                </Toast.Title>
                {message.description === undefined ? null : (
                  <Toast.Description className="mt-1 text-[13px] leading-5 text-muted">
                    {message.description}
                  </Toast.Description>
                )}
              </div>
              <Toast.Close
                aria-label="关闭通知"
                className="grid size-10 place-items-center self-start rounded-control text-faint transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-95"
              >
                <X aria-hidden="true" size={16} />
              </Toast.Close>
            </Toast.Root>
          );
        })}
        <Toast.Viewport
          className="fixed right-4 bottom-4 z-[100] grid w-[min(380px,calc(100vw-32px))] gap-2 outline-none"
          label="通知（{hotkey}）"
        />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

export function useAppToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error("useAppToast 必须在 AppToastProvider 内使用");
  }

  return context;
}
