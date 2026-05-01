import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
      isAdmin: () => get().session?.role === 'admin',
    }),
    { name: 'cd_session' }
  )
)

/* ── THEME ──
   Persisted across reloads. The data-theme attribute on <html>
   is what actually controls the CSS variables.
*/
export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', next)
        set({ theme: next })
      },
    }),
    {
      name: 'talkzi_theme',
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme)
        }
      },
    }
  )
)

export const useUIStore = create((set) => ({
  activeView: 'inbox',
  setActiveView: (view) => set({ activeView: view }),

  activeConvId: null,
  setActiveConvId: (id) => set({ activeConvId: id }),

  convFilter: 'open',
  setConvFilter: (f) => set({ convFilter: f }),

  kbPanelOpen: false,
  toggleKbPanel: () => set((s) => ({ kbPanelOpen: !s.kbPanelOpen })),
  closeKbPanel: () => set({ kbPanelOpen: false }),

  labelModalOpen: false,
  openLabelModal: () => set({ labelModalOpen: true }),
  closeLabelModal: () => set({ labelModalOpen: false }),
}))
