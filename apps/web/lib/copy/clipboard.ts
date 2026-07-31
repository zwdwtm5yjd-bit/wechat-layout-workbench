export interface WechatCopyPayload {
  readonly html: string;
  readonly plainText: string;
}

export type ClipboardWriteFailureReason =
  | "CLIPBOARD_API_UNAVAILABLE"
  | "HTML_MIME_UNSUPPORTED"
  | "INSECURE_CONTEXT"
  | "USER_ACTIVATION_REQUIRED"
  | "CLIPBOARD_WRITE_FAILED";

export type ClipboardWriteResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly detail?: string;
      readonly reason: ClipboardWriteFailureReason;
    };

interface ClipboardItemConstructor {
  new (items: Readonly<Record<string, Blob>>): ClipboardItem;
  readonly supports?: (type: string) => boolean;
}

export interface ClipboardRuntime {
  readonly ClipboardItem: ClipboardItemConstructor | undefined;
  readonly isSecureContext: boolean;
  readonly userActivationActive: boolean | undefined;
  readonly write: ((items: ClipboardItem[]) => Promise<void>) | undefined;
}

function browserRuntime(): ClipboardRuntime {
  const item =
    typeof globalThis.ClipboardItem === "undefined" ? undefined : globalThis.ClipboardItem;
  return {
    ClipboardItem: item,
    isSecureContext: globalThis.isSecureContext,
    userActivationActive: navigator.userActivation?.isActive,
    write:
      navigator.clipboard?.write === undefined
        ? undefined
        : navigator.clipboard.write.bind(navigator.clipboard),
  };
}

export async function writeWechatClipboard(
  payload: WechatCopyPayload,
  runtime: ClipboardRuntime = browserRuntime(),
): Promise<ClipboardWriteResult> {
  if (!runtime.isSecureContext) {
    return { ok: false, reason: "INSECURE_CONTEXT" };
  }
  if (runtime.userActivationActive === false) {
    return { ok: false, reason: "USER_ACTIVATION_REQUIRED" };
  }
  if (runtime.ClipboardItem === undefined || runtime.write === undefined) {
    return { ok: false, reason: "CLIPBOARD_API_UNAVAILABLE" };
  }
  if (
    typeof runtime.ClipboardItem.supports === "function" &&
    !runtime.ClipboardItem.supports("text/html")
  ) {
    return { ok: false, reason: "HTML_MIME_UNSUPPORTED" };
  }

  try {
    const item = new runtime.ClipboardItem({
      "text/html": new Blob([payload.html], {
        type: "text/html;charset=utf-8",
      }),
      "text/plain": new Blob([payload.plainText], {
        type: "text/plain;charset=utf-8",
      }),
    });
    await runtime.write([item]);
    return { ok: true };
  } catch (error) {
    const detail =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      typeof error.name === "string"
        ? error.name
        : undefined;
    return {
      ok: false,
      reason: "CLIPBOARD_WRITE_FAILED",
      ...(detail === undefined ? {} : { detail }),
    };
  }
}

export function selectManualCopyContent(element: HTMLElement): boolean {
  const selection = globalThis.getSelection();
  if (selection === null) {
    return false;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  element.focus();
  return true;
}
