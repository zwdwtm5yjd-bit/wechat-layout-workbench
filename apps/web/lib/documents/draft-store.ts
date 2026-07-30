import type { DocumentJson, DocumentSchemaVersion } from "./client";

export const DOCUMENT_DRAFT_DATABASE = "wechat-layout-local-drafts";
export const DOCUMENT_DRAFT_STORE = "article-document-drafts";

export interface LocalDocumentDraft {
  readonly articleId: string;
  readonly baseVersion: number;
  readonly schemaVersion: DocumentSchemaVersion;
  readonly document: DocumentJson;
  readonly lastTransactionId: string;
  readonly transactionOrigin: string;
  readonly savedAt: string;
}

export interface DocumentDraftStore {
  get(articleId: string): Promise<LocalDocumentDraft | null>;
  put(draft: LocalDocumentDraft): Promise<void>;
  delete(articleId: string): Promise<void>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB 请求失败"));
    });
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => {
      resolve();
    });
    transaction.addEventListener("abort", () => {
      reject(transaction.error ?? new Error("IndexedDB 事务已中止"));
    });
    transaction.addEventListener("error", () => {
      reject(transaction.error ?? new Error("IndexedDB 事务失败"));
    });
  });
}

export class IndexedDbDocumentDraftStore implements DocumentDraftStore {
  readonly #databaseName: string;
  #openPromise?: Promise<IDBDatabase>;

  constructor(databaseName = DOCUMENT_DRAFT_DATABASE) {
    this.#databaseName = databaseName;
  }

  async get(articleId: string): Promise<LocalDocumentDraft | null> {
    const database = await this.open();
    const transaction = database.transaction(DOCUMENT_DRAFT_STORE, "readonly");
    const value = await requestResult(
      transaction.objectStore(DOCUMENT_DRAFT_STORE).get(articleId) as IDBRequest<
        LocalDocumentDraft | undefined
      >,
    );
    await transactionComplete(transaction);
    return value ?? null;
  }

  async put(draft: LocalDocumentDraft): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(DOCUMENT_DRAFT_STORE, "readwrite");
    transaction.objectStore(DOCUMENT_DRAFT_STORE).put(draft);
    await transactionComplete(transaction);
  }

  async delete(articleId: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(DOCUMENT_DRAFT_STORE, "readwrite");
    transaction.objectStore(DOCUMENT_DRAFT_STORE).delete(articleId);
    await transactionComplete(transaction);
  }

  private open(): Promise<IDBDatabase> {
    if (this.#openPromise !== undefined) {
      return this.#openPromise;
    }
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("当前浏览器不支持 IndexedDB"));
    }

    this.#openPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#databaseName, 1);
      request.addEventListener("upgradeneeded", () => {
        if (!request.result.objectStoreNames.contains(DOCUMENT_DRAFT_STORE)) {
          request.result.createObjectStore(DOCUMENT_DRAFT_STORE, {
            keyPath: "articleId",
          });
        }
      });
      request.addEventListener("success", () => {
        resolve(request.result);
      });
      request.addEventListener("error", () => {
        reject(request.error ?? new Error("无法打开本地草稿数据库"));
      });
      request.addEventListener("blocked", () => {
        reject(new Error("本地草稿数据库升级被其他页面阻塞"));
      });
    });

    return this.#openPromise;
  }
}
