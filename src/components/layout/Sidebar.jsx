import React from 'react'
import {
  Mail, Users, BookOpen, BarChart2, UserCog, LogOut,
  Megaphone, Target, Sun, Moon
} from 'lucide-react'
import { useAuthStore, useUIStore, useThemeStore } from '../../store'
import { useConversations } from '../../hooks'
import { avatarColor, initials } from '../../lib/utils'
import { TalkziMark } from '../ui/TalkziLogo'

const NAV = [
  { id: 'inbox',     icon: Mail,       label: 'Inbox',          adminOnly: false },
  { id: 'contacts',  icon: Users,      label: 'Contacts',       adminOnly: false },
  { id: 'broadcast', icon: Megaphone,  label: 'Broadcast',      adminOnly: false },
  { id: 'leads',     icon: Target,     label: 'Leads',          adminOnly: false },
  { id: 'knowledge', icon: BookOpen,   label: 'Knowledge Base', adminOnly: false },
  { id: 'reports',   icon: BarChart2,  label: 'Reports',        adminOnly: true  },
  { id: 'agents',    icon: UserCog,    label: 'Agents',         adminOnly: true  },
]

export default function Sidebar() {
  const { session, clearSession, isAdmin } = useAuthStore()
  const { activeView, setActiveView, convFilter } = useUIStore()
  const { theme, toggleTheme } = useThemeStore()
  const { data: convs = [] } = useConversations(convFilter, session?.agent_id)

  const unread = convs.filter(c => c.unread_count > 0).length
  const admin  = isAdmin()

  const btn = (item) => {
    if (item.adminOnly && !admin) return null
    const active = activeView === item.id
    const Icon   = item.icon
    return (
      <div key={item.id} style={{ position: 'relative' }} className="sb-item">
        <button
          onClick={() => setActiveView(item.id)}
          title={item.label}
          style={{
            width: 38, height: 38, borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none',
            background: active ? 'var(--accent-dim)' : 'transparent',
            color: active ? 'var(--accent)' : 'var(--text2)',
            transition: 'all .15s', position: 'relative',
          }}
          onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text)' }}}
          onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}}
        >
          <Icon size={18} strokeWidth={1.7} />
          {item.id === 'inbox' && unread > 0 && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              minWidth: 15, height: 15, background: 'var(--red)',
              borderRadius: 8, fontSize: 9, fontWeight: 700,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'
            }}>{unread}</span>
          )}
        </button>
        <span className="sb-tip" style={{
          position: 'absolute', left: 46, top: '50%', transform: 'translateY(-50%)',
          background: 'var(--bg4)', border: '1px solid var(--border2)',
          padding: '4px 9px', borderRadius: 6, fontSize: 12, color: 'var(--text)',
          whiteSpace: 'nowrap', pointerEvents: 'none', opacity: 0, zIndex: 100,
          transition: 'opacity .12s',
          boxShadow: 'var(--shadow-pop)',
        }}>{item.label}</span>
      </div>
    )
  }

  return (
    <aside style={{
      width: 'var(--sidebar-w)', background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 0', gap: 2, flexShrink: 0, zIndex: 10,
    }}>
      <style>{`.sb-item:hover .sb-tip { opacity: 1; }`}</style>

      {/* Talkzi Logo */}
      <div style={{
        marginBottom: 10, flexShrink: 0,
        boxShadow: '0 0 18px var(--accent-glow)',
        borderRadius: 10,
      }}>
        <TalkziMark size={36} color="#ffffff" bg="var(--accent)" />
      </div>

      {/* Nav items */}
      {NAV.map(btn)}

      <div style={{ flex: 1 }} />

      {/* Theme toggle */}
      <div style={{ position: 'relative' }} className="sb-item">
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 38, height: 38, borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none',
            background: 'transparent', color: 'var(--text2)', transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' }}
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.7} /> : <Moon size={16} strokeWidth={1.7} />}
        </button>
        <span className="sb-tip" style={{
          position: 'absolute', left: 46, top: '50%', transform: 'translateY(-50%)',
          background: 'var(--bg4)', border: '1px solid var(--border2)',
          padding: '4px 9px', borderRadius: 6, fontSize: 12, color: 'var(--text)',
          whiteSpace: 'nowrap', pointerEvents: 'none', opacity: 0, zIndex: 100,
          transition: 'opacity .12s', boxShadow: 'var(--shadow-pop)',
        }}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      </div>

      {/* Logout */}
      <button
        onClick={() => { if (confirm('Sign out?')) clearSession() }}
        title="Sign out"
        style={{
          width: 38, height: 38, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', border: 'none',
          background: 'transparent', color: 'var(--text3)', transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-dim)'; e.currentTarget.style.color = 'var(--red)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
      >
        <LogOut size={16} strokeWidth={1.7} />
      </button>

      {/* User avatar */}
      <div
        title={`${session?.name} (${session?.role})`}
        style={{
          width: 30, height: 30, borderRadius: '50%', marginTop: 4,
          background: avatarColor(session?.name || ''),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'default', flexShrink: 0,
        }}
      >
        {initials(session?.name || '')}
      </div>
    </aside>
  )
}
