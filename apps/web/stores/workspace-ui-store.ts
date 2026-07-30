"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceUiState {
  readonly commandPaletteOpen: boolean;
  readonly sidebarCollapsed: boolean;
  setCommandPaletteOpen(open: boolean): void;
  toggleSidebar(): void;
}

export const useWorkspaceUiStore = create<WorkspaceUiState>()(
  persist(
    (set) => ({
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => {
        set({ commandPaletteOpen: open });
      },
      sidebarCollapsed: false,
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },
    }),
    {
      name: "one-key-visual:workspace-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      skipHydration: true,
    },
  ),
);
