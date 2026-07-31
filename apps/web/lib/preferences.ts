export interface WorkspacePreferences {
  readonly compactEditor: boolean;
  readonly copyMode: "standard" | "static" | "wechat_safe";
  readonly reduceMotion: boolean;
}

export const workspacePreferencesStorageKey = "one-click-visual:preferences";
export const workspacePreferencesChangeEvent = "workspace-preferences-change";

export const defaultWorkspacePreferences: WorkspacePreferences = {
  compactEditor: true,
  copyMode: "standard",
  reduceMotion: false,
};

export function readWorkspacePreferences(): WorkspacePreferences {
  if (typeof window === "undefined") {
    return defaultWorkspacePreferences;
  }

  try {
    const raw = window.localStorage.getItem(workspacePreferencesStorageKey);
    if (raw === null) {
      return defaultWorkspacePreferences;
    }
    const value = JSON.parse(raw) as Partial<WorkspacePreferences>;
    return {
      compactEditor:
        typeof value.compactEditor === "boolean"
          ? value.compactEditor
          : defaultWorkspacePreferences.compactEditor,
      copyMode:
        value.copyMode === "standard" ||
        value.copyMode === "static" ||
        value.copyMode === "wechat_safe"
          ? value.copyMode
          : defaultWorkspacePreferences.copyMode,
      reduceMotion:
        typeof value.reduceMotion === "boolean"
          ? value.reduceMotion
          : defaultWorkspacePreferences.reduceMotion,
    };
  } catch {
    return defaultWorkspacePreferences;
  }
}

export function applyWorkspacePreferences(preferences: WorkspacePreferences): void {
  document.documentElement.dataset.reduceMotion = preferences.reduceMotion ? "true" : "false";
}

export function writeWorkspacePreferences(preferences: WorkspacePreferences): void {
  window.localStorage.setItem(workspacePreferencesStorageKey, JSON.stringify(preferences));
  applyWorkspacePreferences(preferences);
  window.dispatchEvent(new Event(workspacePreferencesChangeEvent));
}
