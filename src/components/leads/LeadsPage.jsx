import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { Search, Users, HandCoins, Calendar, Star, X, ArrowRight, MessageCircle, RefreshCw } from 'lucide-react'
import { db, LEADS_COLLECTION } from '../../lib/firebase'
import { useUIStore } from '../../store'
import { useContacts } from '../../hooks'
import { Spinner } from '../ui'
import toast from 'react-hot-toast'

/* ──────────────────────────────────────────────────────────
   Column definitions — mirror the original leads-dashboard.html
   ─────────────────────────────────────────────────────────── */
const COLUMNS = [
  { key: 'Lead_ID',                  label: 'Lead ID',   type: 'id' },
  { key: 'Date_Created',             label: 'Created',   type: 'date' },
  { key: 'Last_Updated',             label: 'Updated',   type: 'date' },
  { key: 'Full_Name',                label: 'Name',      type: 'text' },
  { key: 'Phone_Number',             label: 'Phone',     type: 'phone' },
  { key: 'Requirement___Intent',     label: 'Intent',    type: 'intent' },
  { key: 'Budget_Range',             label: 'Budget',    type: 'badge' },
  { key: 'Timeline',                 label: 'Timeline',  type: 'timeline' },
  { key: 'Decision_Maker',           label: 'Decision',  type: 'bool' },
  { key: 'Lead_Score',               label: 'Score',     type: 'score' },
  { key: 'Handoff_Status',           label: 'Handoff',   type: 'handoff' },
  { key: 'Conversation_Summary',     label: 'Summary',   type: 'summary' },
  { key: 'Follow_Up_Required',       label: 'Follow Up', type: 'bool' },
  { key: 'Follow_Up_Date',           label: 'FU Date',   type: 'date' },
  { key: 'Follow_Up_Count',          label: 'FU #',      type: 'number' },
  { key: 'Tags',                     label: 'Tags',      type: 'tags' },
  { key: 'Closed_Date',              label: 'Closed',    type: 'date' },
]

const TAG_COLORS = [
  ['91,127,255',   'var(--accent)'],
  ['155,114,255',  'var(--purple)'],
  ['6,182,212',    'var(--cyan)'],
  ['31,214,147',   'var(--green)'],
  ['255,176,32',   'var(--amber)'],
]

/* ── helpers ──────────────────────────────────────────────── */
function fmtDate(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (isNaN(d)) return v
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function isTrue(v) {
  return v === true || String(v).toLowerCase() === 'yes' || String(v).toLowerCase() === 'true'
}

function scoreColors(n) {
  if (n >= 75) return { color: 'var(--green)', bg: 'var(--green-dim)' }
  if (n >= 45) return { color: 'var(--amber)', bg: 'var(--amber-dim)' }
  return { color: 'var(--red)', bg: 'var(--red-dim)' }
}

/* Normalize a phone number for matching across systems. */
function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '')
}

/* The lead's Phone_Number may contain multiple numbers concatenated
   (e.g. "923087620770 443087620770"), or it may have a different country
   prefix than the contact record (e.g. lead has "92308…" and contact has
   "+92 308…"). To handle these cases we:
     1. extract every digit-run (so "923087620770 443087620770" → ["923087620770","443087620770"])
     2. for each candidate, also keep its last 9 and last 10 digits as suffix tokens
   A contact matches if ANY of its phone tokens match ANY of the lead's tokens.
*/
function phoneTokens(raw) {
  const runs = String(raw || '').match(/\d+/g) || []
  const out = new Set()
  for (const run of runs) {
    if (run.length < 7) continue
    out.add(run)
    if (run.length >= 9)  out.add(run.slice(-9))
    if (run.length >= 10) out.add(run.slice(-10))
  }
  return out
}

function phonesMatch(a, b) {
  const ta = phoneTokens(a)
  const tb = phoneTokens(b)
  for (const x of ta) if (tb.has(x)) return true
  return false
}

/* ──────────────────────────────────────────────────────────
   Cell renderers — return JSX (vs. the original HTML strings).
   ─────────────────────────────────────────────────────────── */
function Cell({ col, lead, onToggleHandoff, onShowSummary, forDetail = false }) {
  const v = lead[col.key]

  switch (col.type) {
    case 'id':
      return <span style={S.mono} className="txt3">{v || '—'}</span>

    case 'date':
      return <span style={{ ...S.mono, color: 'var(--text2)', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(v)}</span>

    case 'phone':
      return <span style={{ ...S.mono, color: 'var(--cyan)', whiteSpace: 'nowrap', fontSize: 12 }}>{v || '—'}</span>

    case 'text':
      return v ? <span style={{ fontSize: 13 }}>{v}</span> : <span style={{ color: 'var(--text3)' }}>—</span>

    case 'intent':
      return v
        ? <span style={{ fontSize: 12, color: 'var(--text2)', display: 'block', lineHeight: 1.4, wordBreak: 'break-word' }}>{v}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>

    case 'timeline':
      return v
        ? <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{v}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>

    case 'score': {
      const n = parseInt(v)
      if (isNaN(n)) return <span style={{ color: 'var(--text3)' }}>—</span>
      const c = scoreColors(n)
      return (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 20,
          fontSize: 12, fontWeight: 700,
          color: c.color, background: c.bg,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
          {n}
        </span>
      )
    }

    case 'handoff': {
      const isHuman = String(v || '').toLowerCase() === 'human'
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleHandoff?.(lead, isHuman ? 'AI' : 'Human') }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20,
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${isHuman ? 'rgba(31,214,147,0.3)' : 'rgba(155,114,255,0.3)'}`,
            background: isHuman ? 'var(--green-dim)' : 'var(--purple-dim)',
            color: isHuman ? 'var(--green)' : 'var(--purple)',
            fontFamily: 'var(--font)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          {isHuman ? 'Human' : 'AI Bot'}
        </button>
      )
    }

    case 'bool':
      if (v === undefined || v === null || v === '') return <span style={{ color: 'var(--text3)' }}>—</span>
      return isTrue(v)
        ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', background: 'var(--green-dim)', padding: '2px 8px', borderRadius: 20 }}>Yes</span>
        : <span style={{ fontSize: 12, color: 'var(--text3)' }}>No</span>

    case 'badge':
      return v
        ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amber)', background: 'var(--amber-dim)', padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{v}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>

    case 'tags': {
      if (!v) return <span style={{ color: 'var(--text3)' }}>—</span>
      const list = Array.isArray(v) ? v : String(v).split(',').map(t => t.trim()).filter(Boolean)
      if (!list.length) return <span style={{ color: 'var(--text3)' }}>—</span>
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {list.map((t, i) => {
            const [rgb, col] = TAG_COLORS[i % TAG_COLORS.length]
            return (
              <span key={i} style={{
                fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 20,
                background: `rgba(${rgb},0.12)`, color: col,
                border: `1px solid ${col}33`,
              }}>{t}</span>
            )
          })}
        </div>
      )
    }

    case 'summary': {
      if (!v) return <span style={{ color: 'var(--text3)' }}>—</span>
      if (forDetail) {
        return <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{v}</span>
      }
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onShowSummary?.(v) }}
          style={{
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: 'var(--accent-dim)', color: 'var(--accent)',
            border: '1px solid rgba(107,33,168,0.3)',
            borderRadius: 20, padding: '3px 10px',
            fontFamily: 'var(--font)',
          }}
        >Summary</button>
      )
    }

    case 'number':
      return (v !== undefined && v !== null && v !== '')
        ? <span style={{ ...S.mono, color: 'var(--text2)', fontSize: 12 }}>{v}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>

    default:
      return v ? <span style={{ fontSize: 13 }}>{v}</span> : <span style={{ color: 'var(--text3)' }}>—</span>
  }
}

/* ──────────────────────────────────────────────────────────
   MAIN PAGE
   ─────────────────────────────────────────────────────────── */
export default function LeadsPage() {
  const [allLeads, setAllLeads]   = useState([])
  const [loading,  setLoading]    = useState(true)
  const [errorMsg, setErrorMsg]   = useState(null)
  const [searchQ,  setSearchQ]    = useState('')
  const [sortKey,  setSortKey]    = useState('Date_Created')
  const [sortDir,  setSortDir]    = useState('desc')
  const [detail,   setDetail]     = useState(null)   // selected lead
  const [summary,  setSummary]    = useState(null)   // string for the summary modal

  const { setActiveView, setActiveConvId } = useUIStore()

  // Pull contacts so we can map lead phone → conversation_id
  const { data: contactsData } = useContacts(1, '')
  const contacts = useMemo(() => {
    return Array.isArray(contactsData) ? contactsData : (contactsData?.payload || [])
  }, [contactsData])

  /* Subscribe to Firebase Realtime DB */
  useEffect(() => {
    const leadsRef = ref(db, LEADS_COLLECTION)
    const unsub = onValue(
      leadsRef,
      (snap) => {
        const data = snap.val()
        if (!data) {
          setAllLeads([])
        } else {
          setAllLeads(Object.entries(data).map(([key, fields]) => ({ ...fields, _docId: key })))
        }
        setLoading(false)
        setErrorMsg(null)
      },
      (err) => {
        console.error(err)
        setErrorMsg(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  /* Click a lead row → open its conversation in the inbox */
  const openConversation = (lead) => {
    // 1. Try lead.conversation_id directly (if your backend writes it onto the Firebase record)
    if (lead.conversation_id) {
      setActiveConvId(lead.conversation_id)
      setActiveView('inbox')
      return
    }

    if (!lead.Phone_Number) {
      toast.error('No phone number on this lead')
      return
    }

    // 2. Smart phone matching — handles multi-number fields (e.g. "923087620770 443087620770"),
    //    different country-code prefixes, spaces, dashes, plus signs.
    const match = contacts.find(c => phonesMatch(c.phone_number, lead.Phone_Number))
    if (match?.conversation_id) {
      setActiveConvId(match.conversation_id)
      setActiveView('inbox')
      return
    }

    toast.error(`No active conversation found for ${lead.Phone_Number}`)
  }

  /* Toggle handoff status (writes back to Firebase) */
  const toggleHandoff = async (lead, next) => {
    try {
      await update(ref(db, `${LEADS_COLLECTION}/${lead._docId}`), { Handoff_Status: next })
      toast.success(`Handed off to ${next}`)
    } catch (e) {
      console.error(e)
      toast.error('Could not update handoff')
    }
  }

  /* Filter + sort */
  const visible = useMemo(() => {
    const filtered = !searchQ ? allLeads : allLeads.filter(l =>
      Object.values(l).some(v => String(v).toLowerCase().includes(searchQ))
    )
    return [...filtered].sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [allLeads, searchQ, sortKey, sortDir])

  /* Stats — same calculation as the original */
  const stats = useMemo(() => {
    const total = allLeads.length
    const human = allLeads.filter(l => String(l.Handoff_Status || '').toLowerCase() === 'human').length
    const fu    = allLeads.filter(l => isTrue(l.Follow_Up_Required)).length
    const avg   = total ? Math.round(allLeads.reduce((s, l) => s + (parseInt(l.Lead_Score) || 0), 0) / total) : 0
    return { total, human, fu, avg }
  }, [allLeads])

  const STAT_CARDS = [
    { icon: Users,     label: 'Total Leads',         value: stats.total, color: 'var(--accent)', dim: 'var(--accent-dim)' },
    { icon: HandCoins, label: 'Handed to Human',     value: stats.human, color: 'var(--green)',  dim: 'var(--green-dim)'  },
    { icon: Calendar,  label: 'Follow Ups Pending',  value: stats.fu,    color: 'var(--amber)',  dim: 'var(--amber-dim)'  },
    { icon: Star,      label: 'Avg Lead Score',      value: stats.avg,   color: 'var(--purple)', dim: 'var(--purple-dim)' },
  ]

  const onSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* ── Header ── */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px var(--accent-glow)',
          }}>
            <Users size={14} color="#fff" strokeWidth={2.2} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>Leads</span>
          <span style={{
            background: 'var(--accent-dim)', color: 'var(--accent)',
            border: '1px solid rgba(107,33,168,0.25)',
            borderRadius: 6, padding: '2px 9px',
            fontSize: 11, fontWeight: 600,
          }}>{visible.length} / {allLeads.length}</span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Live pill */}
          <div style={{
            background: 'var(--green-dim)', color: 'var(--green)',
            border: '1px solid rgba(31,214,147,0.2)',
            borderRadius: 7, padding: '5px 12px',
            fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--green)',
              boxShadow: '0 0 7px var(--green)',
              animation: 'pulse 2s ease infinite',
            }} />
            Live
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value.toLowerCase())}
              placeholder="Search leads…"
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '7px 12px 7px 30px',
                color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)',
                outline: 'none', width: 220,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 32px' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {STAT_CARDS.map(s => {
            const Icon = s.icon
            return (
              <div key={s.label} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '20px 22px',
                display: 'flex', flexDirection: 'column', gap: 8,
                position: 'relative', overflow: 'hidden',
                animation: 'fadeIn .35s ease both',
              }}>
                <div style={{
                  position: 'absolute', top: -24, right: -24, width: 90, height: 90,
                  borderRadius: '50%', background: s.dim, filter: 'blur(22px)',
                  pointerEvents: 'none',
                }} />
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: s.dim, color: s.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  <Icon size={16} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 600, color: s.color, lineHeight: 1, position: 'relative' }}>
                  {loading ? '—' : s.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', position: 'relative' }}>{s.label}</div>
              </div>
            )
          })}
        </div>

        {/* Table card */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 18, overflow: 'hidden',
          animation: 'fadeIn .4s .1s ease both',
        }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>All Leads</span>
            <span style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              {visible.length} / {allLeads.length}
            </span>
          </div>

          {loading && (
            <div style={{ padding: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: 'var(--text3)' }}>
              <Spinner size={28} />
              <span>Connecting to Firebase…</span>
            </div>
          )}

          {!loading && errorMsg && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>
              ⚠ Firebase error: {errorMsg}
            </div>
          )}

          {!loading && !errorMsg && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {COLUMNS.map(col => (
                      <th
                        key={col.key}
                        onClick={() => onSort(col.key)}
                        style={{
                          padding: '10px 14px', textAlign: 'left',
                          fontWeight: 600, fontSize: 11, letterSpacing: '0.06em',
                          color: sortKey === col.key ? 'var(--accent)' : 'var(--text3)',
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                          borderBottom: '1px solid var(--border)',
                          background: 'var(--bg3)', cursor: 'pointer', userSelect: 'none',
                        }}
                      >
                        {col.label}
                        <span style={{ marginLeft: 4, opacity: 0.7 }}>
                          {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                        </span>
                      </th>
                    ))}
                    <th style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontWeight: 600, fontSize: 11, letterSpacing: '0.06em',
                      color: 'var(--text3)', textTransform: 'uppercase',
                      borderBottom: '1px solid var(--border)', background: 'var(--bg3)',
                    }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {!visible.length && (
                    <tr><td colSpan={COLUMNS.length + 1} style={{
                      padding: 50, textAlign: 'center', color: 'var(--text3)',
                    }}>No leads found</td></tr>
                  )}
                  {visible.map((lead, i) => (
                    <tr
                      key={lead._docId}
                      onClick={() => openConversation(lead)}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 1 ? 'var(--row-odd)' : 'transparent',
                        cursor: 'pointer',
                        animation: `rowIn .22s ease both`,
                        animationDelay: `${i * 0.018}s`,
                        transition: 'background .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'var(--row-odd)' : 'transparent'}
                    >
                      {COLUMNS.map(col => (
                        <td key={col.key} style={tdStyleFor(col.type)}>
                          <Cell
                            col={col} lead={lead}
                            onToggleHandoff={toggleHandoff}
                            onShowSummary={(s) => setSummary(s)}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDetail(lead) }}
                          style={{
                            padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                            border: '1px solid var(--border2)', background: 'var(--bg3)',
                            color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel ── */}
      {detail && (
        <DetailPanel
          lead={detail}
          onClose={() => setDetail(null)}
          onToggleHandoff={toggleHandoff}
          onOpenConv={() => { openConversation(detail); setDetail(null) }}
          onShowSummary={(s) => setSummary(s)}
        />
      )}

      {/* ── Summary modal ── */}
      {summary && (
        <div onClick={() => setSummary(null)} style={overlayStyle}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 14, padding: 22, maxWidth: 560, width: '90%',
            boxShadow: 'var(--shadow-pop)', animation: 'slideUp .2s ease both',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Conversation Summary</span>
              <button onClick={() => setSummary(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>{summary}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────
   Detail slide-over panel
   ─────────────────────────────────────────────────────────── */
function DetailPanel({ lead, onClose, onToggleHandoff, onOpenConv, onShowSummary }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 90, animation: 'fadeIn .2s ease both',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 460, maxWidth: '92vw',
        background: 'var(--bg2)', borderLeft: '1px solid var(--border2)',
        zIndex: 100, overflowY: 'auto',
        animation: 'slideIn .25s ease both',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Lead Detail</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', display: 'flex',
          }}><X size={16} /></button>
        </div>

        {/* Hero */}
        <div style={{
          padding: '24px 22px', borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, var(--accent-dim) 0%, transparent 100%)',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
            {lead.Full_Name || 'Unknown'}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--cyan)', marginTop: 4 }}>
            {lead.Phone_Number || '—'}
          </div>
          <div style={{ marginTop: 12 }}>
            <Cell col={{ key: 'Lead_Score', type: 'score' }} lead={lead} forDetail />
          </div>

          <button
            onClick={onOpenConv}
            style={{
              marginTop: 16,
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)',
            }}
          >
            <MessageCircle size={13} /> Open conversation <ArrowRight size={13} />
          </button>
        </div>

        {/* Rows */}
        <div style={{ padding: '6px 0' }}>
          {COLUMNS.filter(c => !['Full_Name', 'Phone_Number', 'Lead_Score'].includes(c.key)).map(col => (
            <div key={col.key} style={{
              padding: '10px 22px', borderBottom: '1px solid var(--border)',
              display: 'grid', gridTemplateColumns: '110px 1fr', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', paddingTop: 3 }}>
                {col.label}
              </span>
              <div>
                <Cell
                  col={col} lead={lead} forDetail
                  onToggleHandoff={onToggleHandoff}
                  onShowSummary={onShowSummary}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ──────────────────────────────────────────────────────────
   Style helpers
   ─────────────────────────────────────────────────────────── */
const S = {
  mono: { fontFamily: 'var(--font-mono)', fontSize: 11 },
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
  zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
  animation: 'fadeIn .15s ease both',
}

function tdStyleFor(type) {
  const base = { padding: '10px 14px', verticalAlign: 'middle' }
  switch (type) {
    case 'id':
    case 'date':
    case 'phone':
    case 'score':
    case 'handoff':
    case 'badge':
    case 'timeline':
      return { ...base, whiteSpace: 'nowrap' }
    case 'bool':
    case 'number':
      return { ...base, whiteSpace: 'nowrap', textAlign: 'center' }
    case 'intent':
      return { ...base, maxWidth: 380 }
    case 'text':
      return { ...base, maxWidth: 160 }
    case 'tags':
      return { ...base, minWidth: 120, maxWidth: 200 }
    case 'summary':
      return { ...base, minWidth: 110 }
    default:
      return base
  }
}
