import React, { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { useKnowledge } from '../../hooks'
import { Spinner } from '../ui'

export default function KbChatPanel({ onUse }) {
  const [q, setQ] = useState('')
  const { data: articles = [], isLoading } = useKnowledge()

  const filtered = useMemo(() => {
    if (!q) return articles
    const ql = q.toLowerCase()
    return articles.filter(a =>
      (a.title || '').toLowerCase().includes(ql) ||
      (a.content || '').toLowerCase().includes(ql) ||
      (a.tags || '').toLowerCase().includes(ql)
    )
  }, [articles, q])

  return (
    <div style={{
      borderTop: '1px solid var(--border)', background: 'var(--bg2)',
      flexShrink: 0, animation: 'slideUp 0.2s ease both',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', flexShrink: 0 }}>📚 Knowledge Base</span>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search articles..."
          autoFocus
          style={{
            flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '4px 8px', color: 'var(--text)',
            fontSize: 12, fontFamily: 'var(--font)', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Articles */}
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '6px 8px' }}>
        {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spinner /></div>}
        {!isLoading && !filtered.length && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, padding: '16px 0' }}>
            {q ? 'No articles match your search' : 'No articles yet'}
          </div>
        )}
        {filtered.map(a => (
          <div key={a.id}
            style={{
              padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg3)',
              marginBottom: 5, transition: 'all .15s',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg3)' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {(a.content || '').substring(0, 80)}…
              </div>
            </div>
            <button
              onClick={() => onUse(a.content)}
              style={{
                fontSize: 10, padding: '3px 8px', background: 'var(--accent)',
                border: 'none', borderRadius: 4, color: '#fff',
                cursor: 'pointer', fontFamily: 'var(--font)', fontWeight: 600,
                flexShrink: 0,
              }}
            >Use</button>
          </div>
        ))}
      </div>
    </div>
  )
}
