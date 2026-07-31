// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultWorkspacePreferences,
  readWorkspacePreferences,
  workspacePreferencesChangeEvent,
  workspacePreferencesStorageKey,
  writeWorkspacePreferences,
} from "./preferences";

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.reduceMotion;
});

describe("workspace preferences", () => {
  it("uses safe defaults and rejects invalid persisted values", () => {
    window.localStorage.setItem(
      workspacePreferencesStorageKey,
      JSON.stringify({
        compactEditor: "yes",
        copyMode: "unsafe",
        reduceMotion: true,
      }),
    );

    expect(readWorkspacePreferences()).toEqual({
      ...defaultWorkspacePreferences,
      reduceMotion: true,
    });
  });

  it("persists settings, applies reduced motion and notifies the shell", () => {
    const listener = vi.fn();
    window.addEventListener(workspacePreferencesChangeEvent, listener);

    writeWorkspacePreferences({
      compactEditor: false,
      copyMode: "wechat_safe",
      reduceMotion: true,
    });

    expect(readWorkspacePreferences()).toEqual({
      compactEditor: false,
      copyMode: "wechat_safe",
      reduceMotion: true,
    });
    expect(document.documentElement.dataset.reduceMotion).toBe("true");
    expect(listener).toHaveBeenCalledOnce();

    window.removeEventListener(workspacePreferencesChangeEvent, listener);
  });
});
