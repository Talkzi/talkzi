import React from 'react'
import { avatarColor, initials } from '../../lib/utils'
import { X } from 'lucide-react'

/* ── AVATAR ── */
export function Avatar({ name = '', size = 34, style = {} }) {
  const s = {
    width: size, height: size, borderRadius: '50%',
    background: avatarColor(name),
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0,
    ...style
  }
  return <div style={s}>{initials(name)}</div>
}

/* ── BADGE ── */
const BADGE_VARIANTS = {
  open:     { bg: 'var(--green-dim)',  color: 'var(--green)'  },
  resolved: { bg: 'var(--red-dim)',    color: 'var(--red)'    },
  pending:  { bg: 'var(--amber-dim)',  color: 'var(--amber)'  },
  blue:     { bg: 'var(--accent-dim)', color: 'var(--accent)' },
  purple:   { bg: 'var(--purple-dim)', color: 'var(--purple)' },
  cyan:     { bg: 'var(--cyan-dim)',   color: 'var(--cyan)'   },
  pink:     { bg: 'var(--pink-dim)',   color: 'var(--pink)'   },
}
export function Badge({ variant = 'blue', children, style = {} }) {
  const v = BADGE_VARIANTS[variant] || BADGE_VARIANTS.blue
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: v.bg, color: v.color,
      ...style
    }}>
      {children}
    </span>
  )
}

/* ── LABEL CHIP ── */
export function LabelChip({ label, onRemove }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: 'var(--purple-dim)', color: 'var(--purple)',
      border: '1px solid rgba(155,114,255,0.3)',
    }}>
      {label}
      {onRemove && (
        <button onClick={() => onRemove(label)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--purple)', fontSize: 14, lineHeight: 1, opacity: 0.7, padding: 0
        }}>×</button>
      )}
    </span>
  )
}

/* ── SPINNER ── */
export function Spinner({ size = 16 }) {
  return (
    <div style={{
      width: size, height: size,
      border: '2px solid var(--border2)',
      borderTopColor: 'var(--accent)',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
      flexShrink: 0,
    }} />
  )
}

/* ── ICON BUTTON ── */
export function IconButton({ children, active, onClick, title, style = {} }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text2)',
        transition: 'all .15s', flexShrink: 0,
        ...style
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' } }}
    >
      {children}
    </button>
  )
}

/* ── MODAL ── */
export function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.15s ease both',
      }}
    >
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 16, padding: 24, width, maxWidth: '95vw',
        maxHeight: '85vh', overflowY: 'auto',
        animation: 'slideUp 0.2s ease both',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ── FORM FIELD ── */
export function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

export function Input({ style = {}, ...props }) {
  return (
    <input
      style={{
        width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '10px 14px', color: 'var(--text)',
        fontSize: 14, fontFamily: 'var(--font)', outline: 'none',
        transition: 'border .15s', ...style
      }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
      {...props}
    />
  )
}

export function Select({ style = {}, children, ...props }) {
  return (
    <select
      style={{
        width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '9px 12px', color: 'var(--text)',
        fontSize: 13, fontFamily: 'var(--font)', outline: 'none', cursor: 'pointer', ...style
      }}
      {...props}
    >
      {children}
    </select>
  )
}

/* ── BUTTON ── */
export function Button({ variant = 'primary', size = 'md', children, style = {}, ...props }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontFamily: 'var(--font)', fontWeight: 600, transition: 'opacity .15s',
    ...({ sm: { padding: '5px 11px', fontSize: 12 }, md: { padding: '8px 16px', fontSize: 13 }, lg: { padding: '10px 20px', fontSize: 14 } }[size])
  }
  const variants = {
    primary: { background: 'var(--accent)', color: '#fff' },
    secondary: { background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)' },
    danger: { background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red)' },
    success: { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid var(--green)' },
    amber: { background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid var(--amber)' },
  }
  return (
    <button style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      {...props}
    >
      {children}
    </button>
  )
}

/* ── EMPTY STATE ── */
export function Empty({ icon, text }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: 'var(--text3)' }}>
      <div style={{ opacity: 0.3 }}>{icon}</div>
      <p style={{ fontSize: 13 }}>{text}</p>
    </div>
  )
}
