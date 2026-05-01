import React from 'react'
import { MessageCircle } from 'lucide-react'
import ConversationList from '../conversations/ConversationList'
import ChatWindow from '../chat/ChatWindow'
import DetailPanel from '../chat/DetailPanel'
import { useAuthStore, useUIStore } from '../../store'

export default function InboxPage() {
  const { isAdmin } = useAuthStore()
  const { activeConvId } = useUIStore()
  const admin = isAdmin()

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Conversation list */}
      <ConversationList />

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minWidth: 0 }}>
        {activeConvId ? (
          <ChatWindow />
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text3)', gap: 12,
          }}>
            <MessageCircle size={44} strokeWidth={1.2} style={{ opacity: 0.25 }} />
            <div style={{ fontSize: 14 }}>Select a conversation to start</div>
          </div>
        )}

        {/* Detail panel — admin only, only when conv is open */}
        {admin && activeConvId && <DetailPanel />}
      </div>
    </div>
  )
}
