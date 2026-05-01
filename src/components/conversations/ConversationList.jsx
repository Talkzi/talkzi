import React, { useState } from 'react'
import { Search } from 'lucide-react'
import { useConversations } from '../../hooks'
import { useAuthStore, useUIStore } from '../../store'
import { Avatar, Badge, Spinner } from '../ui'
import { relativeTime } from '../../lib/utils'

const FILTERS = [
  { id: 'open',     label: 'Open'     },
  { id: 'resolved', label: 'Resolved' },
  { id: 'pending',  label: 'Pending'  },
  { id: 'mine',     label: 'Mine', adminOnly: true },
]

function statusVariant(s) {
  return { open: 'open', resolved: 'resolved', pending: 'pending' }[s] || 'blue'
}

export default function ConversationList() {
  const { session, isAdmin } = useAuthStore()
  const { activeConvId, setActiveConvId, convFilter, setConvFilter } = useUIStore()
  const [search, setSearch] = useState('')

  const { data: convs = [], isLoading } = useConversations(convFilter, session?.agent_id)

  const filtered = search
    ? convs.filter(c => (c.meta?.sender?.name || '').toLowerCase().includes(search.toLowerCase()))
    : convs

  return (
    <aside style={{
      width: 'var(--panel-w)', background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Inbox</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
          {isLoading ? 'Loading...' : `${filtered.length} conversations`}
        </div>
      </div>

      {/* Search */}
      <div style={{ margin: '8px 12px', position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
          style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '7px 10px 7px 28px', color: 'var(--text)',
            fontSize: 13, fontFamily: 'var(--font)', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 5, padding: '0 12px 8px', flexWrap: 'wrap' }}>
        {FILTERS.filter(f => !f.adminOnly || isAdmin()).map(f => (
          <button key={f.id} onClick={() => setConvFilter(f.id)}
            style={{
              padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500,
              cursor: 'pointer', border: `1px solid ${convFilter === f.id ? 'var(--accent)' : 'var(--border)'}`,
              background: convFilter === f.id ? 'var(--accent-dim)' : 'transparent',
              color: convFilter === f.id ? 'var(--accent)' : 'var(--text2)',
              transition: 'all .15s', whiteSpace: 'nowrap',
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <Spinner />
          </div>
        )}
        {!isLoading && !filtered.length && (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No conversations found
          </div>
        )}
        {filtered.map(c => <ConvItem key={c.id} conv={c} active={activeConvId === c.id} onSelect={setActiveConvId} />)}
      </div>
    </aside>
  )
}

function ConvItem({ conv, active, onSelect }) {
  const name   = conv.meta?.sender?.name || 'Unknown'
  const status = conv.status
  const labels = conv.labels || []
  const unread = conv.unread_count > 0
  const assignee = conv.meta?.assignee?.name

  return (
    <div
      onClick={() => onSelect(conv.id)}
      style={{
        padding: '10px 12px',
        paddingLeft: active ? 10 : 12,
        borderBottom: '1px solid var(--border)',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        background: active ? 'rgba(91,127,255,0.08)' : 'transparent',
        transition: 'background .12s',
        display: 'flex', gap: 9, alignItems: 'flex-start',
        animation: 'fadeIn 0.15s ease both',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg3)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <Avatar name={name} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
            {relativeTime(conv.last_activity_at)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
          {conv.additional_attributes?.mail_subject || conv.meta?.channel || '—'}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          <Badge variant={statusVariant(status)}>{status}</Badge>
          {unread && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
          {assignee && <span style={{ fontSize: 11, color: 'var(--text3)' }}>{assignee}</span>}
          {labels.slice(0, 2).map(l => (
            <span key={l} style={{
              display: 'inline-flex', alignItems: 'center', padding: '1px 6px',
              borderRadius: 10, fontSize: 10, fontWeight: 600,
              background: 'var(--purple-dim)', color: 'var(--purple)',
              border: '1px solid rgba(155,114,255,0.3)',
            }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
