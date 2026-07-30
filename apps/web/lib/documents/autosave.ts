import {
  DocumentClientError,
  type DocumentJson,
  type DocumentSchemaVersion,
  type SaveArticleDocumentResult,
} from "./client";
import type { DocumentDraftStore, LocalDocumentDraft } from "./draft-store";

export type DocumentSaveStatus = "saved" | "saving" | "local_saved" | "error" | "conflict";

export interface DocumentSaveSnapshot {
  readonly status: DocumentSaveStatus;
  readonly documentVersion: number;
  readonly lastSavedAt: string | null;
  readonly errorMessage: string | null;
  readonly conflict: {
    readonly submittedVersion: number;
    readonly currentVersion: number | null;
  } | null;
}

export interface OnlineSource {
  isOnline(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface DocumentAutosaveOptions {
  readonly articleId: string;
  readonly initialVersion: number;
  readonly initialLastTransactionId?: string | null;
  readonly initialLastSavedAt?: string | null;
  readonly draftStore: DocumentDraftStore;
  readonly save: (draft: LocalDocumentDraft) => Promise<SaveArticleDocumentResult>;
  readonly onlineSource?: OnlineSource;
  readonly debounceMs?: number;
  readonly retryMs?: number;
  readonly createTransactionId?: () => string;
  readonly now?: () => Date;
}

function browserOnlineSource(): OnlineSource {
  return {
    isOnline: () => typeof navigator === "undefined" || navigator.onLine,
    subscribe: (listener) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }
      window.addEventListener("online", listener);
      return () => {
        window.removeEventListener("online", listener);
      };
    },
  };
}

function conflictCurrentVersion(error: DocumentClientError): number | null {
  const value = error.details?.currentVersion;
  return typeof value === "number" ? value : null;
}

export class DocumentAutosaveController {
  readonly #articleId: string;
  readonly #initialLastTransactionId: string | null;
  readonly #draftStore: DocumentDraftStore;
  readonly #save: (draft: LocalDocumentDraft) => Promise<SaveArticleDocumentResult>;
  readonly #onlineSource: OnlineSource;
  readonly #debounceMs: number;
  readonly #retryMs: number;
  readonly #createTransactionId: () => string;
  readonly #now: () => Date;
  readonly #listeners = new Set<() => void>();
  readonly #unsubscribeOnline: () => void;

  #snapshot: DocumentSaveSnapshot;
  #pendingDraft: LocalDocumentDraft | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #persistQueue: Promise<void> = Promise.resolve();
  #inFlight = false;
  #conflicted = false;
  #destroyed = false;

  constructor(options: DocumentAutosaveOptions) {
    this.#articleId = options.articleId;
    this.#initialLastTransactionId = options.initialLastTransactionId ?? null;
    this.#draftStore = options.draftStore;
    this.#save = options.save;
    this.#onlineSource = options.onlineSource ?? browserOnlineSource();
    this.#debounceMs = options.debounceMs ?? 800;
    this.#retryMs = options.retryMs ?? 5000;
    this.#createTransactionId = options.createTransactionId ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
    this.#snapshot = {
      status: "saved",
      documentVersion: options.initialVersion,
      lastSavedAt: options.initialLastSavedAt ?? null,
      errorMessage: null,
      conflict: null,
    };
    this.#unsubscribeOnline = this.#onlineSource.subscribe(() => {
      if (!this.#conflicted) {
        void this.flushNow();
      }
    });
  }

  getSnapshot = (): DocumentSaveSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  async initialize(): Promise<LocalDocumentDraft | null> {
    const draft = await this.#draftStore.get(this.#articleId);
    if (draft === null || this.#destroyed) {
      return draft;
    }

    if (
      this.#initialLastTransactionId !== null &&
      draft.lastTransactionId === this.#initialLastTransactionId &&
      this.#snapshot.documentVersion === draft.baseVersion + 1
    ) {
      await this.#draftStore.delete(this.#articleId);
      return null;
    }

    this.#pendingDraft = draft;
    if (draft.baseVersion !== this.#snapshot.documentVersion) {
      this.#conflicted = true;
      this.updateSnapshot({
        status: "conflict",
        errorMessage: "本地草稿基于较旧的服务端版本，请先处理差异",
        conflict: {
          submittedVersion: draft.baseVersion,
          currentVersion: this.#snapshot.documentVersion,
        },
      });
      return draft;
    }

    this.updateSnapshot({
      status: "local_saved",
      errorMessage: null,
      conflict: null,
    });
    if (this.#onlineSource.isOnline()) {
      this.schedule(0);
    }
    return draft;
  }

  async queue(
    document: DocumentJson,
    schemaVersion: DocumentSchemaVersion,
    transactionOrigin = "autosave",
  ): Promise<void> {
    if (this.#destroyed) {
      throw new Error("自动保存会话已关闭");
    }

    const draft: LocalDocumentDraft = {
      articleId: this.#articleId,
      baseVersion: this.#snapshot.documentVersion,
      schemaVersion,
      document: structuredClone(document),
      lastTransactionId: this.#createTransactionId(),
      transactionOrigin,
      savedAt: this.#now().toISOString(),
    };
    this.#pendingDraft = draft;
    this.#persistQueue = this.#persistQueue.then(() => this.#draftStore.put(draft));

    try {
      await this.#persistQueue;
    } catch (error) {
      this.updateSnapshot({
        status: "error",
        errorMessage: error instanceof Error ? error.message : "本地草稿保存失败",
        conflict: null,
      });
      throw error;
    }

    if (this.#conflicted) {
      this.updateSnapshot({
        status: "conflict",
        errorMessage: "存在版本冲突，本地草稿未覆盖远端文档",
      });
      return;
    }

    this.updateSnapshot({
      status: "local_saved",
      errorMessage: null,
      conflict: null,
    });
    if (this.#onlineSource.isOnline()) {
      this.schedule(this.#debounceMs);
    }
  }

  async flushNow(): Promise<void> {
    this.clearTimer();
    if (
      this.#destroyed ||
      this.#inFlight ||
      this.#conflicted ||
      this.#pendingDraft === null ||
      !this.#onlineSource.isOnline()
    ) {
      return;
    }

    await this.#persistQueue;
    const savingDraft = this.#pendingDraft;
    this.#inFlight = true;
    this.updateSnapshot({
      status: "saving",
      errorMessage: null,
      conflict: null,
    });

    try {
      const result = await this.#save(savingDraft);
      this.#snapshot = {
        status: "saved",
        documentVersion: result.documentVersion,
        lastSavedAt: result.lastSavedAt,
        errorMessage: null,
        conflict: null,
      };
      this.emit();

      if (this.#pendingDraft?.lastTransactionId === savingDraft.lastTransactionId) {
        this.#pendingDraft = null;
        await this.#draftStore.delete(this.#articleId);
      } else if (this.#pendingDraft !== null) {
        this.#pendingDraft = {
          ...this.#pendingDraft,
          baseVersion: result.documentVersion,
        };
        await this.#draftStore.put(this.#pendingDraft);
        this.updateSnapshot({
          status: "local_saved",
          errorMessage: null,
          conflict: null,
        });
        this.schedule(this.#debounceMs);
      }
    } catch (error) {
      if (error instanceof DocumentClientError && error.code === "ARTICLE_VERSION_CONFLICT") {
        this.#conflicted = true;
        this.updateSnapshot({
          status: "conflict",
          errorMessage: error.message,
          conflict: {
            submittedVersion: savingDraft.baseVersion,
            currentVersion: conflictCurrentVersion(error),
          },
        });
      } else if (
        !this.#onlineSource.isOnline() ||
        !(error instanceof DocumentClientError) ||
        error.retryable
      ) {
        this.updateSnapshot({
          status: "local_saved",
          errorMessage: error instanceof Error ? error.message : "网络中断，等待恢复后重试",
          conflict: null,
        });
        this.schedule(this.#retryMs);
      } else {
        this.updateSnapshot({
          status: "error",
          errorMessage: error.message,
          conflict: null,
        });
      }
    } finally {
      this.#inFlight = false;
    }
  }

  async discardLocalDraft(documentVersion: number, lastSavedAt: string | null): Promise<void> {
    this.clearTimer();
    this.#pendingDraft = null;
    this.#conflicted = false;
    await this.#draftStore.delete(this.#articleId);
    this.#snapshot = {
      status: "saved",
      documentVersion,
      lastSavedAt,
      errorMessage: null,
      conflict: null,
    };
    this.emit();
  }

  destroy(): void {
    this.#destroyed = true;
    this.clearTimer();
    this.#unsubscribeOnline();
    this.#listeners.clear();
  }

  private schedule(delay: number): void {
    this.clearTimer();
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.flushNow();
    }, delay);
  }

  private clearTimer(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  private updateSnapshot(patch: Partial<DocumentSaveSnapshot>): void {
    this.#snapshot = {
      ...this.#snapshot,
      ...patch,
    };
    this.emit();
  }

  private emit(): void {
    this.#listeners.forEach((listener) => {
      listener();
    });
  }
}
