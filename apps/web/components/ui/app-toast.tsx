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
  readonly tone?: "default" | "success" | "warning";
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
        {messages.map((message) => (
          <Toast.Root
            className="toast-root grid grid-cols-[1fr_auto] gap-x-4 rounded-card border border-line bg-panel px-4 py-3 shadow-raised"
            key={message.id}
            onOpenChange={(open) => {
              if (!open) {
                dismiss(message.id);
              }
            }}
            type="foreground"
          >
            <div>
              <Toast.Title
                className={
                  message.tone === "success"
                    ? "text-sm font-semibold text-success"
                    : message.tone === "warning"
                      ? "text-sm font-semibold text-warning"
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
              className="rounded-control p-1 text-faint transition hover:bg-hover hover:text-ink"
            >
              <X aria-hidden="true" size={16} />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed right-4 bottom-4 z-[100] grid w-[min(380px,calc(100vw-32px))] gap-2 outline-none" />
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
