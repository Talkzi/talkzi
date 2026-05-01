import React, { useState, useRef, useMemo } from 'react'
import { Search, Upload, MessageCircle, CheckCircle, AlertCircle, X, Filter } from 'lucide-react'
import { useContacts } from '../../hooks'
import { useUIStore } from '../../store'
import { Avatar, Spinner } from '../ui'

const FILTERS = [
  { id: 'all',     label: 'All Contacts' },
  { id: 'ongoing', label: 'Ongoing Conversations' },
  { id: 'no_conv', label: 'No Conversation' },
]

export default function ContactsPage() {
  const [page, setPage]               = useState(1)
  const [q, setQ]                     = useState('')
  const [debouncedQ, setDebouncedQ]   = useState('')
  const [filter, setFilter]           = useState('ongoing')
  const [importing, setImporting]     = useState(false)
  const [importResult, setImportResult] = useState(null)
  const timer   = useRef()
  const fileRef = useRef()
  const { setActiveView, setActiveConvId } = useUIStore()

  const { data: payload, isLoading, refetch } = useContacts(page, debouncedQ)
  const allContacts = useMemo(() => {
    return Array.isArray(payload) ? payload : (payload?.payload || [])
  }, [payload])

  // Apply filter
  const contacts = useMemo(() => {
    if (filter === 'ongoing') return allContacts.filter(c => c.conversation_id)
    if (filter === 'no_conv') return allContacts.filter(c => !c.conversation_id)
    return allContacts
  }, [allContacts, filter])

  // Counts for the filter pills
  const counts = useMemo(() => ({
    all:     allContacts.length,
    ongoing: allContacts.filter(c => c.conversation_id).length,
    no_conv: allContacts.filter(c => !c.conversation_id).length,
  }), [allContacts])

  const handleSearch = (v) => {
    setQ(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { setDebouncedQ(v); setPage(1) }, 400)
  }

  const handleContactClick = (c) => {
    if (c.conversation_id) {
      setActiveConvId(c.conversation_id)
      setActiveView('inbox')
    }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const BASE = import.meta.env.VITE_API_BASE || '/api'
      const r = await fetch(`${BASE}/contacts/import`, { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Import failed')
      setImportResult({ success: true, inserted: data.inserted, errors: data.errors || [] })
      refetch()
    } catch (err) {
      setImportResult({ success: false, message: err.message })
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>Contacts</div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input value={q} onChange={e => handleSearch(e.target.value)}
              placeholder="Search contacts..."
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '7px 12px 7px 28px', color: 'var(--text)',
                fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: 220,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* CSV Import */}
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              color: 'var(--accent)', cursor: importing ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)', opacity: importing ? 0.6 : 1,
            }}
          >
            {importing ? <Spinner size={13} /> : <Upload size={13} />}
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div style={{
        padding: '10px 20px 0', display: 'flex', alignItems: 'center',
        gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10,
        background: 'var(--bg2)',
      }}>
        <Filter size={13} color="var(--text3)" />
        {FILTERS.map(f => {
          const active = filter === f.id
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '4px 11px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              background: active ? 'var(--accent-dim)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text2)',
              transition: 'all .15s', fontFamily: 'var(--font)',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {f.label}
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: active ? 'rgba(107,33,168,0.18)' : 'var(--bg3)',
                color: active ? 'var(--accent)' : 'var(--text3)',
                padding: '1px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center',
              }}>{counts[f.id]}</span>
            </button>
          )
        })}
      </div>

      {/* Import result banner */}
      {importResult && (
        <div style={{
          margin: '12px 20px 0',
          padding: '10px 14px', borderRadius: 8,
          display: 'flex', alignItems: 'flex-start', gap: 8,
          background: importResult.success ? 'var(--green-dim)' : 'var(--red-dim)',
          border: `1px solid ${importResult.success ? 'var(--green)' : 'var(--red)'}`,
          fontSize: 13,
          color: importResult.success ? 'var(--green)' : 'var(--red)',
        }}>
          {importResult.success
            ? <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            : <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          }
          <div style={{ flex: 1 }}>
            {importResult.success
              ? <>Imported {importResult.inserted} contacts successfully.{importResult.errors?.length > 0 && ` ${importResult.errors.length} rows skipped.`}</>
              : importResult.message
            }
          </div>
          <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* CSV hint */}
      <div style={{ padding: '8px 20px 0', fontSize: 11, color: 'var(--text3)' }}>
        CSV columns: <code style={{ fontFamily: 'var(--font-mono)' }}>name, phone_number, email</code>
        &nbsp;·&nbsp; Click any row with an active conversation to open it.
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Phone', 'Email', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px',
                    fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                    textTransform: 'uppercase', letterSpacing: '0.6px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--bg3)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center' }}><Spinner /></td></tr>
              )}
              {!isLoading && !contacts.length && (
                <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  {filter === 'ongoing'
                    ? 'No contacts with ongoing conversations.'
                    : filter === 'no_conv'
                      ? 'All contacts have active conversations 🎉'
                      : 'No contacts found. Import a CSV to get started.'}
                </td></tr>
              )}
              {contacts.map((c, i) => (
                <tr key={c.id}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    transition: 'background .12s',
                    background: i % 2 === 1 ? 'var(--row-odd)' : 'transparent',
                    cursor: c.conversation_id ? 'pointer' : 'default',
                  }}
                  onClick={() => handleContactClick(c)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'var(--row-odd)' : 'transparent'}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Avatar name={c.name} size={30} />
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{c.name || '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {c.phone_number || '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 13 }}>
                    {c.email || '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {c.conversation_id ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: 'var(--accent-dim)', color: 'var(--accent)',
                        border: '1px solid rgba(107,33,168,0.3)',
                      }}>
                        <MessageCircle size={11} /> Open chat #{c.conversation_id}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)', fontSize: 12 }}>No conversation</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={pgBtnStyle(page <= 1)}>← Prev</button>
          <span style={{ padding: '7px 14px', fontSize: 13, color: 'var(--text2)' }}>Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={contacts.length < 25} style={pgBtnStyle(contacts.length < 25)}>Next →</button>
        </div>
      </div>
    </div>
  )
}

const pgBtnStyle = (disabled) => ({
  padding: '7px 14px', background: 'transparent',
  border: '1px solid var(--border2)', borderRadius: 8,
  color: disabled ? 'var(--text3)' : 'var(--text2)',
  fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'var(--font)', opacity: disabled ? 0.4 : 1, transition: 'all .15s',
})
