import React, { useEffect } from 'react'
import { useAuthStore, useUIStore, useThemeStore } from './store'
import LoginPage from './components/LoginPage'
import Sidebar from './components/layout/Sidebar'
import InboxPage from './components/conversations/InboxPage'
import ContactsPage from './components/contacts/ContactsPage'
import KnowledgePage from './components/knowledge/KnowledgePage'
import ReportsPage from './components/reports/ReportsPage'
import AgentsPage from './components/agents/AgentsPage'
import BroadcastPage from './components/broadcast/BroadcastPage'
import LeadsPage from './components/leads/LeadsPage'

const VIEWS = {
  inbox:     InboxPage,
  contacts:  ContactsPage,
  broadcast: BroadcastPage,
  leads:     LeadsPage,
  knowledge: KnowledgePage,
  reports:   ReportsPage,
  agents:    AgentsPage,
}

export default function App() {
  const { session } = useAuthStore()
  const { activeView } = useUIStore()
  const { theme } = useThemeStore()

  // Make sure the data-theme attribute reflects the persisted store
  // value once React mounts (the inline script in index.html handles
  // the pre-mount paint, this handles route changes / late hydration).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  if (!session) return <LoginPage />

  const View = VIEWS[activeView] || InboxPage

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <View />
    </div>
  )
}
