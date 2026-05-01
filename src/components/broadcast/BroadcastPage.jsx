import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, Upload, Search, Plus, Trash2, Eye, Copy, ChevronRight,
  CheckCircle, XCircle, AlertCircle, Megaphone, FileText,
  Users, BarChart2, Settings, X, RefreshCw, Zap, Clock,
  ArrowRight, MessageSquare, Phone
} from 'lucide-react'
import { Spinner, Avatar } from '../ui'

// ── tiny helpers ────────────────────────────────────────
const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WA_API)
  ? import.meta.env.VITE_WA_API
  : 'http://localhost:5000/api'

async function waGet(path) {
  const r = await fetch(API + path)
  return r.json()
}
async function waPost(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

function statusColor(s) {
  if (!s) return 'var(--text3)'
  const m = { approved: 'var(--green)', rejected: 'var(--red)', pending: 'var(--amber)' }
  return m[s.toLowerCase()] || 'var(--text3)'
}
function statusBg(s) {
  const m = { approved: 'var(--green-dim)', rejected: 'var(--red-dim)', pending: 'var(--amber-dim)' }
  return m[(s || '').toLowerCase()] || 'var(--bg3)'
}

// ──────────────────────────────────────────────────────────
//  Meta Approval Validator — same 12 rules as the original
//  whatsapp-broadcast.html validateTemplate(). Returns
//  { issues: string[], warnings: string[] } in real time.
// ──────────────────────────────────────────────────────────
function validateMetaTemplate({ body, name, category, footer, btnUrl, headerType, header, samples }) {
  const issues = []
  const warnings = []
  const bodyLower = (body || '').toLowerCase()

  // 1. Body length
  if (body.length > 1024) issues.push(`Body is ${body.length} chars — Meta hard limit is 1024.`)
  else if (body.length > 550) warnings.push(`Body is ${body.length} chars — over 550 increases rejection risk.`)

  // 2. Variables
  const vars = [...body.matchAll(/\{\{(\d+)\}\}/g)].map(m => parseInt(m[1]))
  const uniqueVars = [...new Set(vars)].sort((a, b) => a - b)

  if (/^\s*\{\{\d+\}\}/.test(body)) issues.push('Body cannot START with a variable {{N}} — add real text before it.')
  if (/\{\{\d+\}\}\s*$/.test(body)) issues.push('Body cannot END with a variable {{N}} — add real text after it.')
  if (uniqueVars.length > 0 && body.replace(/\{\{\d+\}\}/g, '').trim().length < 20)
    issues.push('Too many variables and not enough real text — Meta sees this as a spam template.')
  if (uniqueVars.length > 0 && body.length / uniqueVars.length < 15)
    warnings.push(`${uniqueVars.length} variable(s) in a very short body looks suspicious to Meta.`)
  for (let i = 0; i < uniqueVars.length; i++) {
    if (uniqueVars[i] !== i + 1) {
      issues.push(`Variables must be sequential: {{1}},{{2}},{{3}}… Found {{${uniqueVars[i]}}} out of order.`)
      break
    }
  }
  const missingSamples = uniqueVars.filter(n => !(samples?.[n] || '').trim())
  if (missingSamples.length)
    issues.push(`Sample values missing for ${missingSamples.map(n => `{{${n}}}`).join(', ')} — Meta auto-rejects without them.`)

  // 3. Spam phrases
  ;['guaranteed','act now','limited time','click here','buy now','free!!!','you have been selected','winner','you won','claim now']
    .forEach(w => { if (bodyLower.includes(w)) warnings.push(`Spam phrase detected: "${w}" — high rejection risk.`) })

  // 4. Punctuation / caps
  if ((body.match(/!/g) || []).length > 3) warnings.push('More than 3 exclamation marks (!) looks spammy to Meta.')
  if ((body.match(/\?/g) || []).length > 3) warnings.push('More than 3 question marks (?) looks spammy to Meta.')
  if (/[A-Z]{5,}/.test(body)) warnings.push('Avoid long ALL CAPS words — Meta flags these as spam.')

  // 5. Emojis
  const emojiCount = [...body].filter(c => c.codePointAt(0) > 65535 || (c.codePointAt(0) >= 127744 && c.codePointAt(0) <= 129782)).length
  if (emojiCount > 10) issues.push(`${emojiCount} emojis found — Meta hard limit is 10 in body.`)
  else if (emojiCount > 5) warnings.push(`${emojiCount} emojis — keep under 10 to be safe.`)

  // 6. Banned URL shorteners
  ;['bit.ly','tinyurl','t.co','goo.gl','ow.ly','short.io','wa.me','buff.ly']
    .forEach(s => { if (body.includes(s) || (btnUrl || '').includes(s))
      issues.push(`URL shortener "${s}" is banned by Meta. Use your full domain URL.`) })

  // 7. Template name
  if (name && !/^[a-z0-9_]+$/.test(name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')))
    warnings.push('Template name will be normalized to lowercase letters, numbers, and underscores.')

  // 8. Header rules
  if (headerType === 'text' && header && /[\*\_\~]/.test(header))
    issues.push('Header text cannot contain bold (*), italic (_), or strikethrough (~).')
  if (headerType === 'text' && header && /\{\{\d+\}\}/.test(header))
    warnings.push('Variables in the header are tricky — Meta often rejects these. Keep header as plain fixed text.')

  // 9. Footer length
  if (footer && footer.length > 60) warnings.push(`Footer is ${footer.length} chars — keep under 60.`)

  // 10. Category mismatch
  const promoWords = ['offer','discount','sale','% off','promo','deal','shop now','coupon','eid','diwali','christmas','cashback']
  if (promoWords.some(w => bodyLower.includes(w)) && category === 'Utility')
    warnings.push('Promotional words found but category is Utility — switch to Marketing or Meta may reclassify.')

  // 11. Marketing opt-out
  if (category === 'Marketing' && footer && !footer.toLowerCase().includes('stop'))
    warnings.push('Marketing templates should include opt-out wording in the footer (e.g. "Reply STOP").')
  if (category === 'Marketing' && !footer)
    warnings.push('Add a footer with opt-out for Marketing templates — recommended by Meta.')

  // 12. Very short body
  if (body.length > 0 && body.replace(/\{\{\d+\}\}/g, '').trim().length < 15)
    warnings.push('Body text (excluding variables) is very short. Meta needs enough context.')

  return { issues, warnings }
}

// ──────────────────────────────────────────────────────────
//  Real-time approval analysis card — drops into the editor
//  next to the form. Status banner + 0-100 score + every
//  issue / warning surfaced live as the user types.
// ──────────────────────────────────────────────────────────
function ApprovalAnalysisCard({ validation, bodyLen }) {
  const { issues, warnings } = validation

  let status, statusColor, statusBg, statusBorder, statusIcon, statusText
  if (bodyLen === 0) {
    status = 'idle'
    statusColor = 'var(--text2)'
    statusBg    = 'var(--bg3)'
    statusBorder= 'var(--border)'
    statusIcon  = '○'
    statusText  = 'Start typing — analysis updates in real time'
  } else if (issues.length > 0) {
    status = 'reject'
    statusColor = 'var(--red)'
    statusBg    = 'var(--red-dim)'
    statusBorder= 'rgba(255,77,109,0.4)'
    statusIcon  = '✗'
    statusText  = `Will Be Rejected — ${issues.length} blocking issue${issues.length === 1 ? '' : 's'}`
  } else if (warnings.length > 0) {
    status = 'risky'
    statusColor = 'var(--amber)'
    statusBg    = 'var(--amber-dim)'
    statusBorder= 'rgba(255,176,32,0.4)'
    statusIcon  = '!'
    statusText  = `Risky — ${warnings.length} warning${warnings.length === 1 ? '' : 's'} may cause rejection`
  } else {
    status = 'ok'
    statusColor = 'var(--green)'
    statusBg    = 'var(--green-dim)'
    statusBorder= 'rgba(31,214,147,0.4)'
    statusIcon  = '✓'
    statusText  = 'Looks good — ready to submit to Meta'
  }

  const score = bodyLen === 0
    ? 0
    : Math.max(0, Math.min(100, 100 - issues.length * 25 - warnings.length * 8))
  const scoreColor =
    score >= 85 ? 'var(--green)' :
    score >= 60 ? 'var(--amber)' :
                  'var(--red)'

  return (
    <div style={{
      background: statusBg,
      border: `1px solid ${statusBorder}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      transition: 'background .2s ease, border-color .2s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, marginBottom: bodyLen === 0 || (issues.length === 0 && warnings.length === 0) ? 0 : 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: statusBorder, color: statusColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700,
          }}>{statusIcon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px',
                          textTransform: 'uppercase', color: 'var(--text3)' }}>
              Meta Approval Analysis
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: statusColor, marginTop: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {statusText}
            </div>
          </div>
        </div>
        {bodyLen > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ position: 'relative', width: 44, height: 44 }}>
              <svg viewBox="0 0 36 36" width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none"
                  stroke={scoreColor} strokeWidth="3"
                  strokeDasharray={`${(score / 100) * 94.25} 94.25`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray .35s ease, stroke .25s ease' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)',
                color: scoreColor,
              }}>{score}</div>
            </div>
          </div>
        )}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div style={{ marginBottom: warnings.length > 0 ? 10 : 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.5px',
            textTransform: 'uppercase', color: 'var(--red)',
            marginBottom: 5,
          }}>Blocking Issues ({issues.length})</div>
          {issues.map((m, i) => (
            <div key={i} style={{
              fontSize: 12, color: 'var(--red)', padding: '4px 0',
              borderBottom: i < issues.length - 1 ? '1px solid rgba(255,77,109,0.15)' : 'none',
              display: 'flex', gap: 6, alignItems: 'flex-start',
            }}>
              <span style={{ flexShrink: 0 }}>•</span><span>{m}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.5px',
            textTransform: 'uppercase', color: 'var(--amber)',
            marginBottom: 5,
          }}>Warnings ({warnings.length})</div>
          {warnings.map((m, i) => (
            <div key={i} style={{
              fontSize: 12, color: 'var(--amber)', padding: '4px 0',
              borderBottom: i < warnings.length - 1 ? '1px solid rgba(255,176,32,0.15)' : 'none',
              display: 'flex', gap: 6, alignItems: 'flex-start',
            }}>
              <span style={{ flexShrink: 0 }}>•</span><span>{m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── sub-views ───────────────────────────────────────────
const TABS = [
  { id: 'broadcast', icon: Megaphone, label: 'Broadcast' },
  { id: 'templates', icon: FileText,  label: 'Templates'  },
  { id: 'contacts',  icon: Users,     label: 'Contacts'   },
  { id: 'analytics', icon: BarChart2, label: 'Analytics'  },
  { id: 'settings',  icon: Settings,  label: 'Settings'   },
]

// ════════════════════════════════════════════════════════
//  MAIN BROADCAST PAGE
// ════════════════════════════════════════════════════════
export default function BroadcastPage() {
  const [tab, setTab]           = useState('broadcast')
  const [templates, setTemplates] = useState([])
  const [contacts, setContacts]   = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)
  const [accountInfo, setAccountInfo] = useState(null)
  const [connected, setConnected]     = useState(null) // null=checking, true, false
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const me = await waGet('/me')
      if (me.phone && !me.phoneError) {
        setConnected(true)
        setAccountInfo(me)
      } else {
        setConnected(false)
      }
      const tplRes = await waGet('/templates')
      if (tplRes.data) {
        setTemplates(tplRes.data.map((t, i) => {
          const body   = t.components?.find(c => c.type === 'BODY')
          const header = t.components?.find(c => c.type === 'HEADER')
          const footer = t.components?.find(c => c.type === 'FOOTER')
          const btn    = t.components?.find(c => c.type === 'BUTTONS')
          return {
            id: t.id || String(i),
            name: t.name, category: t.category || 'Utility',
            lang: t.language || 'en',
            status: (t.status || 'pending').toLowerCase(),
            body: body?.text || '',
            header: header?.text || '', headerType: header ? (header.format || 'TEXT').toLowerCase() : 'none',
            footer: footer?.text || '',
            btnText: btn?.buttons?.[0]?.text || '',
            btnUrl:  btn?.buttons?.[0]?.url  || '',
          }
        }))
      }
    } catch (_) {
      setConnected(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const addCampaign = (c) => setCampaigns(prev => [c, ...prev])
  const addContact  = (c) => setContacts(prev => [...prev, c])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* ── Header bar ── */}
      <div style={{
        padding: '0 20px', height: 50, borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px var(--accent-glow)',
          }}>
            <Megaphone size={14} color="#fff" strokeWidth={2} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Broadcast</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => {
            const active = tab === t.id
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: 'none', transition: 'all .15s',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text2)',
                fontFamily: 'var(--font)',
              }}>
                <Icon size={12} strokeWidth={2} />{t.label}
              </button>
            )
          })}
        </div>

        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading ? <Spinner size={12} /> : null}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            background: connected ? 'var(--green-dim)' : connected === false ? 'var(--red-dim)' : 'var(--bg3)',
            color: connected ? 'var(--green)' : connected === false ? 'var(--red)' : 'var(--text3)',
            border: `1px solid ${connected ? 'rgba(31,214,147,0.3)' : connected === false ? 'rgba(255,77,109,0.3)' : 'var(--border)'}`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {connected ? (accountInfo?.phone?.display_phone_number || 'Connected') : connected === false ? 'Not Connected' : 'Checking…'}
          </div>
          <button onClick={reload} title="Refresh" style={{
            width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)',
            background: 'transparent', cursor: 'pointer', color: 'var(--text2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {tab === 'broadcast'  && <BroadcastTab   templates={templates} contacts={contacts} addCampaign={addCampaign} campaigns={campaigns} showToast={showToast} />}
        {tab === 'templates'  && <TemplatesTab   templates={templates} setTemplates={setTemplates} showToast={showToast} />}
        {tab === 'contacts'   && <ContactsTab    contacts={contacts} setContacts={setContacts} addContact={addContact} showToast={showToast} />}
        {tab === 'analytics'  && <AnalyticsTab   campaigns={campaigns} templates={templates} />}
        {tab === 'settings'   && <SettingsTab    accountInfo={accountInfo} showToast={showToast} />}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--bg4)', border: `1px solid ${toast.type === 'success' ? 'rgba(31,214,147,0.3)' : toast.type === 'error' ? 'rgba(255,77,109,0.3)' : 'var(--border2)'}`,
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, fontWeight: 500, zIndex: 9999,
          color: toast.type === 'success' ? 'var(--green)' : toast.type === 'error' ? 'var(--red)' : 'var(--amber)',
          animation: 'fadeIn .2s ease',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {toast.type === 'success' ? <CheckCircle size={14} /> : toast.type === 'error' ? <XCircle size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: BROADCAST
// ════════════════════════════════════════════════════════
function BroadcastTab({ templates, contacts, addCampaign, campaigns, showToast }) {
  const [csvData, setCsvData]       = useState(null)
  const [csvFile, setCsvFile]       = useState('')
  const [selTemplate, setSelTemplate] = useState(null)
  const [mapPhone, setMapPhone]     = useState('')
  const [mapVar1, setMapVar1]       = useState('')
  const [mapVar2, setMapVar2]       = useState('')
  const [schedDate, setSchedDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [schedTime, setSchedTime]   = useState('09:00')
  const [sending, setSending]       = useState(false)
  const [progress, setProgress]     = useState(null) // { done, total }
  const [tplSearch, setTplSearch]   = useState('')
  const fileRef = useRef()

  const approved = templates.filter(t => t.status === 'approved')
    .filter(t => !tplSearch || t.name.includes(tplSearch.toLowerCase()))

  const handleCSV = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim().replace(/"/g, '')))
      setCsvData({ headers, rows, total: rows.length })
      // auto-detect
      headers.forEach(h => {
        const lh = h.toLowerCase()
        if (lh.includes('phone') || lh.includes('mobile') || lh.includes('number')) setMapPhone(h)
        if (lh.includes('name')) setMapVar1(h)
        if (lh.includes('order') || lh.includes('id')) setMapVar2(h)
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const fakeEv = { target: { files: [file], value: '' } }
    handleCSV(fakeEv)
  }

  const startBroadcast = async () => {
    if (!selTemplate) { showToast('Select a template first', 'warn'); return }
    const tpl = templates.find(t => t.id === selTemplate)
    if (!tpl) return

    let contactList = []
    if (csvData) {
      const ph = csvData.headers.indexOf(mapPhone)
      const v1 = csvData.headers.indexOf(mapVar1)
      const v2 = csvData.headers.indexOf(mapVar2)
      contactList = csvData.rows.map(r => ({
        to: ph >= 0 ? r[ph] : '',
        parameters: [v1 >= 0 ? r[v1] : '', v2 >= 0 ? r[v2] : ''].filter(Boolean),
      })).filter(c => c.to.replace(/\D/g, '').length >= 7)
    } else {
      contactList = contacts.filter(c => c.status === 'active').map(c => ({
        to: c.phone, parameters: [c.name],
      }))
    }

    if (!contactList.length) { showToast('No valid contacts to send', 'warn'); return }

    setSending(true)
    setProgress({ done: 0, total: contactList.length })

    try {
      const res = await waPost('/broadcast', {
        template: tpl.name, language: tpl.lang, contacts: contactList,
      })
      setProgress({ done: res.sent, total: contactList.length })
      addCampaign({
        name: `Broadcast ${new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}`,
        template: tpl.name, sent: contactList.length,
        delivered: res.sent, read: 0, failed: res.failed || 0,
        date: new Date().toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }),
        errors: res.errors || [],
      })
      if (res.failed) showToast(`Done! ${res.sent} sent · ${res.failed} failed`, 'warn')
      else showToast(`Broadcast complete — ${res.sent} messages sent ✓`, 'success')
    } catch (e) {
      showToast('Broadcast failed — is server.py running?', 'error')
    }
    setSending(false)
    setTimeout(() => setProgress(null), 2000)
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* ── Left Panel ── */}
      <div style={{
        width: 360, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* Section: CSV Upload */}
          <SectionLabel>Recipient List</SectionLabel>
          <div
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)' }}
            onDrop={e => { e.currentTarget.style.borderColor = 'var(--border2)'; handleDrop(e) }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed var(--border2)', borderRadius: 10,
              padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
              transition: 'all .2s', background: 'var(--bg3)', marginBottom: 10,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-glow)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSV} />
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px',
            }}>
              <Upload size={16} color="var(--accent)" />
            </div>
            {csvFile ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>📋 {csvFile}</div>
                <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 3 }}>{csvData?.total} contacts loaded</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Drop CSV file here</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>or click to browse · .csv supported</div>
              </div>
            )}
          </div>

          {/* CSV preview */}
          {csvData && (
            <div style={{ background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--border)', marginBottom: 12, overflow: 'hidden' }}>
              <div style={{
                padding: '8px 12px', background: 'var(--bg4)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Preview</span>
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600,
                  background: 'var(--green-dim)', color: 'var(--green)',
                }}>{csvData.total} rows</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>{csvData.headers.map(h => (
                      <th key={h} style={{ padding: '6px 10px', background: 'var(--bg4)', color: 'var(--text2)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {csvData.rows.slice(0, 4).map((r, i) => (
                      <tr key={i}>{r.map((c, j) => (
                        <td key={j} style={{ padding: '5px 10px', borderTop: '1px solid var(--border)', color: 'var(--text)' }}>{c}</td>
                      ))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.rows.length > 4 && (
                <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)' }}>
                  +{csvData.rows.length - 4} more rows
                </div>
              )}
            </div>
          )}

          {/* Column Mapping */}
          {csvData && (
            <div style={{ marginBottom: 14 }}>
              <SectionLabel>Column Mapping</SectionLabel>
              {[
                { label: 'Phone number', val: mapPhone, set: setMapPhone },
                { label: '{{1}} variable', val: mapVar1, set: setMapVar1 },
                { label: '{{2}} variable', val: mapVar2, set: setMapVar2 },
              ].map(({ label, val, set }) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: '100px auto 1fr', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '4px 8px', borderRadius: 6, textAlign: 'center' }}>{label}</span>
                  <ArrowRight size={12} color="var(--text3)" />
                  <select value={val} onChange={e => set(e.target.value)} style={inputStyle}>
                    <option value="">— skip —</option>
                    {csvData.headers.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Template picker */}
          <SectionLabel>Choose Template</SectionLabel>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input value={tplSearch} onChange={e => setTplSearch(e.target.value)}
              placeholder="Search templates…" style={{ ...inputStyle, paddingLeft: 28 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
            {approved.length === 0 && (
              <div style={{ padding: '14px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                No approved templates found
              </div>
            )}
            {approved.map(t => (
              <div key={t.id} onClick={() => setSelTemplate(t.id === selTemplate ? null : t.id)}
                style={{
                  padding: '10px 12px', borderRadius: 9,
                  border: `1px solid ${selTemplate === t.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selTemplate === t.id ? 'var(--accent-dim)' : 'var(--bg3)',
                  cursor: 'pointer', transition: 'all .15s',
                }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{t.category} · {t.lang}</div>
                {t.body && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body.substring(0, 60)}…</div>}
              </div>
            ))}
          </div>

          {/* Schedule */}
          <SectionLabel>Schedule <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={inputStyle} />
            <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Send button */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {progress && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginBottom: 5 }}>
                <span>Sending…</span>
                <span>{progress.done}/{progress.total}</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: 'var(--green)',
                  width: `${(progress.done / progress.total) * 100}%`, borderRadius: 2, transition: 'width .4s',
                }} />
              </div>
            </div>
          )}
          <button onClick={startBroadcast} disabled={sending || !selTemplate}
            style={{
              width: '100%', padding: '11px', background: selTemplate ? 'linear-gradient(135deg,#25d366,#128C7E)' : 'var(--bg3)',
              border: 'none', borderRadius: 10, color: selTemplate ? '#fff' : 'var(--text3)',
              fontSize: 14, fontWeight: 700, cursor: selTemplate && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'var(--font)', transition: 'all .2s',
            }}>
            {sending ? <Spinner size={14} /> : <Send size={14} />}
            {sending ? 'Sending…' : 'Send Broadcast'}
          </button>
        </div>
      </div>

      {/* ── Right: Campaign Overview ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>Campaign Overview</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Real-time delivery analytics</div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '16px 20px', flexShrink: 0 }}>
          {[
            { label: 'Total Sent', val: campaigns.reduce((s, c) => s + c.sent, 0), color: 'var(--green)' },
            { label: 'Delivered', val: campaigns.length ? Math.round(campaigns.reduce((s, c) => s + c.delivered, 0) / Math.max(campaigns.reduce((s, c) => s + c.sent, 0), 1) * 100) + '%' : '—', color: 'var(--accent)' },
            { label: 'Failed', val: campaigns.reduce((s, c) => s + c.failed, 0), color: 'var(--red)' },
            { label: 'Campaigns', val: campaigns.length, color: 'var(--amber)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Campaign list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Recent Campaigns</div>
          {campaigns.length === 0 && (
            <div style={{
              padding: '40px 20px', textAlign: 'center',
              color: 'var(--text3)', fontSize: 13, background: 'var(--bg2)',
              borderRadius: 10, border: '1px solid var(--border)',
            }}>
              <Megaphone size={32} strokeWidth={1.2} style={{ opacity: .25, marginBottom: 10 }} />
              <div>No campaigns yet. Send your first broadcast.</div>
            </div>
          )}
          {campaigns.map((c, i) => {
            const tot = Math.max(c.sent, 1)
            const dp = Math.round((c.delivered / tot) * 100)
            const fp = Math.round((c.failed / tot) * 100)
            return (
              <div key={i} style={{
                background: 'var(--bg2)', borderRadius: 10,
                padding: '14px 16px', border: '1px solid var(--border)',
                marginBottom: 8, display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 9,
                  background: 'rgba(37,211,102,0.12)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Send size={16} color="#25d366" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{c.date} · {c.sent.toLocaleString()} recipients · {c.template}</div>
                  {/* progress bars */}
                  <div style={{ display: 'flex', gap: 3, marginTop: 8, height: 4 }}>
                    <div style={{ width: `${dp}%`, maxWidth: '70%', height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                    <div style={{ width: `${fp}%`, maxWidth: '20%', height: '100%', background: 'var(--red)', borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                    {[
                      { color: 'var(--accent)', label: `${c.delivered} delivered` },
                      { color: 'var(--red)',    label: `${c.failed} failed` },
                    ].map(({ color, label }) => (
                      <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text2)' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />{label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {[Copy, BarChart2].map((Icon, k) => (
                    <button key={k} style={{
                      width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                      background: 'var(--bg3)', cursor: 'pointer', color: 'var(--text2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}><Icon size={12} /></button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: TEMPLATES
// ════════════════════════════════════════════════════════
function TemplatesTab({ templates, setTemplates, showToast }) {
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState(null) // template obj
  const [isNew, setIsNew]         = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  // form state
  const [form, setForm] = useState({
    name: '', category: 'Marketing', lang: 'en',
    headerType: 'none', header: '', body: '', footer: '',
    btnText: '', btnUrl: '',
  })
  const [samples, setSamples] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filtered = templates.filter(t =>
    !search || t.name.includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase())
  )

  const openTemplate = (t) => {
    setSelected(t); setIsNew(false)
    setForm({
      name: t.name, category: t.category, lang: t.lang || 'en',
      headerType: t.headerType || 'none', header: t.header || '',
      body: t.body || '', footer: t.footer || '',
      btnText: t.btnText || '', btnUrl: t.btnUrl || '',
    })
    setSamples({})
  }
  const openNew = () => {
    setSelected(null); setIsNew(true)
    setForm({ name: '', category: 'Marketing', lang: 'en', headerType: 'none', header: '', body: '', footer: '', btnText: '', btnUrl: '' })
    setSamples({})
  }

  // detect variables in body
  const vars = [...new Set([...form.body.matchAll(/\{\{(\d+)\}\}/g)].map(m => parseInt(m[1])))].sort((a, b) => a - b)

  // Real-time Meta approval analysis
  const validation = React.useMemo(() => validateMetaTemplate({
    body: form.body, name: form.name, category: form.category,
    footer: form.footer, btnUrl: form.btnUrl,
    headerType: form.headerType, header: form.header,
    samples,
  }), [form.body, form.name, form.category, form.footer, form.btnUrl, form.headerType, form.header, samples])

  const handleSave = async () => {
    if (!form.name || !form.body) { showToast('Name and body are required', 'warn'); return }
    setSaving(true)
    const name = form.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const components = []
    if (form.headerType !== 'none' && form.header)
      components.push({ type: 'HEADER', format: form.headerType.toUpperCase(), text: form.header })
    const bodyComp = { type: 'BODY', text: form.body }
    if (vars.length) bodyComp.example = { body_text: [vars.map(n => samples[n] || `sample_${n}`)] }
    components.push(bodyComp)
    if (form.footer) components.push({ type: 'FOOTER', text: form.footer })
    if (form.btnText) {
      const btn = form.btnUrl
        ? { type: 'URL', text: form.btnText, url: form.btnUrl }
        : { type: 'QUICK_REPLY', text: form.btnText }
      components.push({ type: 'BUTTONS', buttons: [btn] })
    }
    try {
      const res = await waPost('/create_template', { name, category: form.category, language: form.lang, components })
      if (res.id || res.success) {
        const obj = { id: res.id || name, name, category: form.category, lang: form.lang, status: 'pending', ...form }
        setTemplates(prev => isNew ? [obj, ...prev] : prev.map(t => t.id === selected?.id ? obj : t))
        setSelected(obj); setIsNew(false)
        showToast(`Template "${name}" submitted for review ✓`, 'success')
      } else {
        showToast('Meta error: ' + (res.error?.error_user_msg || res.error?.message || 'Unknown error'), 'error')
      }
    } catch (_) {
      showToast('Cannot reach server.py', 'error')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!confirm(`Delete template "${selected.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await waPost('/delete_template', { name: selected.name })
      if (res.deleted || res.success) {
        setTemplates(prev => prev.filter(t => t.id !== selected.id))
        setSelected(null); setIsNew(false)
        showToast(`Template "${selected.name}" deleted`, 'success')
      } else {
        showToast('Delete error: ' + (res.error?.message || 'Unknown'), 'error')
      }
    } catch (_) {
      showToast('Cannot reach server.py', 'error')
    }
    setDeleting(false)
  }

  // preview body with bold formatting
  const previewBody = form.body
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    || '<span style="color:var(--text3)">Your message preview…</span>'

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Template List */}
      <div style={{
        width: 280, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <button onClick={openNew} style={{
            width: '100%', padding: '8px', background: 'linear-gradient(135deg,#25d366,#128C7E)',
            border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'var(--font)', marginBottom: 10,
          }}>
            <Plus size={13} /> New Template
          </button>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search templates…" style={{ ...inputStyle, paddingLeft: 28, width: '100%' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {filtered.map(t => (
            <div key={t.id} onClick={() => openTemplate(t)}
              style={{
                padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                border: `1px solid ${selected?.id === t.id ? 'rgba(37,211,102,0.3)' : 'transparent'}`,
                background: selected?.id === t.id ? 'var(--bg3)' : 'transparent',
                marginBottom: 2, transition: 'all .15s',
              }}
              onMouseEnter={e => { if (selected?.id !== t.id) e.currentTarget.style.background = 'var(--bg3)' }}
              onMouseLeave={e => { if (selected?.id !== t.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.body.substring(0, 50)}{t.body.length > 50 ? '…' : ''}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600,
                  background: statusBg(t.status), color: statusColor(t.status),
                }}>{t.status}</span>
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{t.category}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
              No templates found
            </div>
          )}
        </div>
      </div>

      {/* Template Editor */}
      {(selected || isNew) ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Editor header */}
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            background: 'var(--bg2)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {isNew ? 'New Template' : `Edit: ${selected?.name}`}
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              {!isNew && <button onClick={handleDelete} disabled={deleting} style={{ ...ghostBtn, color: 'var(--red)', borderColor: 'rgba(255,77,109,.3)' }}>
                {deleting ? <Spinner size={12} /> : <Trash2 size={12} />} Delete
              </button>}
              <button onClick={() => { setSelected(null); setIsNew(false) }} style={ghostBtn}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={primaryBtn}>
                {saving ? <Spinner size={12} /> : <CheckCircle size={12} />}
                {saving ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <FieldLabel>Template Name</FieldLabel>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. order_confirmation" style={inputStyle} />
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Lowercase, underscores only</div>
                </div>
                <div>
                  <FieldLabel>Category</FieldLabel>
                  <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
                    <option>Marketing</option><option>Utility</option><option>Authentication</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Language</FieldLabel>
                  <select value={form.lang} onChange={e => set('lang', e.target.value)} style={inputStyle}>
                    {[['en','English'],['ur','Urdu'],['ar','Arabic'],['es','Spanish'],['fr','French'],['hi','Hindi']].map(([v,l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Header Type</FieldLabel>
                  <select value={form.headerType} onChange={e => set('headerType', e.target.value)} style={inputStyle}>
                    <option value="none">None</option><option value="text">Text</option>
                    <option value="image">Image</option><option value="document">Document</option>
                  </select>
                </div>
              </div>

              {form.headerType !== 'none' && (
                <div style={{ marginBottom: 14 }}>
                  <FieldLabel>Header Content</FieldLabel>
                  <input value={form.header} onChange={e => set('header', e.target.value)}
                    placeholder="Header text or media URL…" style={inputStyle} />
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Body Message</FieldLabel>
                <textarea value={form.body} onChange={e => set('body', e.target.value)}
                  rows={5} placeholder="Hello {{1}}, your order {{2}} is confirmed!"
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, minHeight: 100 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {['{{1}}','{{2}}','{{3}}','{{4}}','{{5}}'].map(v => (
                      <button key={v} onClick={() => set('body', form.body + v)}
                        style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontFamily: 'monospace', cursor: 'pointer', background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--green)' }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{form.body.length}/1024</span>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Footer <span style={{ fontWeight: 400, color: 'var(--text3)', textTransform: 'none' }}>(optional)</span></FieldLabel>
                <input value={form.footer} onChange={e => set('footer', e.target.value)}
                  placeholder="Reply STOP to unsubscribe" style={inputStyle} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <FieldLabel>CTA Button <span style={{ fontWeight: 400, color: 'var(--text3)', textTransform: 'none' }}>(optional)</span></FieldLabel>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input value={form.btnText} onChange={e => set('btnText', e.target.value)} placeholder="Button label" style={inputStyle} />
                  <input value={form.btnUrl} onChange={e => set('btnUrl', e.target.value)} placeholder="https://…" style={inputStyle} />
                </div>
              </div>

              {/* Sample values — required by Meta */}
              {vars.length > 0 && (
                <div style={{
                  background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.2)',
                  borderRadius: 10, padding: 14, marginBottom: 14,
                }}>
                  <FieldLabel style={{ color: '#25d366' }}>
                    Sample Values <span style={{ color: 'var(--red)', fontWeight: 700 }}>REQUIRED by Meta</span>
                  </FieldLabel>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>
                    Meta rejects templates without sample values for each variable.
                  </div>
                  {vars.map(n => (
                    <div key={n} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#25d366', fontFamily: 'monospace' }}>{'{{' + n + '}}'}</span>
                      <input value={samples[n] || ''} onChange={e => setSamples(s => ({ ...s, [n]: e.target.value }))}
                        placeholder={`Sample for {{${n}}}`} style={inputStyle} />
                    </div>
                  ))}
                </div>
              )}

              {/* Real-time Meta approval analysis */}
              <ApprovalAnalysisCard validation={validation} bodyLen={form.body.length} />
            </div>

            {/* Phone preview */}
            <div style={{
              width: 280, background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
              padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 14 }}>
                Live Preview
              </div>
              <div style={{
                width: 220, background: '#0b141a', borderRadius: 24,
                border: '2px solid var(--bg4)', overflow: 'hidden',
                boxShadow: '0 20px 60px rgba(0,0,0,.5)',
              }}>
                <div style={{ height: 8, background: '#111' }} />
                <div>
                  <div style={{ background: '#1f2c34', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#075E54', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>YB</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#e9edef' }}>Your Business</div>
                      <div style={{ fontSize: 9, color: '#8696a0' }}>WhatsApp Business</div>
                    </div>
                  </div>
                  <div style={{ padding: '10px 8px', minHeight: 200 }}>
                    <div style={{
                      maxWidth: '90%', background: '#1f2c34',
                      borderRadius: '4px 12px 12px 12px', padding: '8px 10px',
                    }}>
                      {(form.headerType === 'image' || form.headerType === 'document') && (
                        <div style={{ width: '100%', height: 60, background: 'linear-gradient(135deg,#075e54,#128c7e)', borderRadius: 4, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={20} color="rgba(255,255,255,.5)" />
                        </div>
                      )}
                      {form.headerType === 'text' && form.header && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#e9edef', marginBottom: 5 }}>{form.header}</div>
                      )}
                      <div style={{ fontSize: 10, lineHeight: 1.55, color: '#e9edef' }} dangerouslySetInnerHTML={{ __html: previewBody }} />
                      {form.footer && <div style={{ fontSize: 9, color: '#8696a0', marginTop: 4 }}>{form.footer}</div>}
                      <div style={{ fontSize: 9, color: '#8696a0', marginTop: 3, textAlign: 'right' }}>10:42 AM ✓✓</div>
                      {form.btnText && (
                        <div style={{ marginTop: 5, padding: '4px 8px', background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,.25)', borderRadius: 5, textAlign: 'center', fontSize: 9, color: '#25d366', fontWeight: 600 }}>
                          🔗 {form.btnText}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', flexDirection: 'column', gap: 10 }}>
          <FileText size={40} strokeWidth={1.2} style={{ opacity: .2 }} />
          <div style={{ fontSize: 13 }}>Select or create a template</div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: CONTACTS
// ════════════════════════════════════════════════════════
function ContactsTab({ contacts, setContacts, showToast }) {
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  const filtered = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase())
      const rows = lines.slice(1)
      const added = []
      rows.forEach(line => {
        const cols = line.split(',').map(c => c.trim().replace(/"/g, ''))
        const obj = {}
        headers.forEach((h, i) => obj[h] = cols[i] || '')
        added.push({
          name: obj.name || obj.first_name || 'Unknown',
          phone: obj.phone || obj.mobile || obj.number || '—',
          email: obj.email || '—',
          status: 'active', tags: 'imported',
          added: new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        })
      })
      setContacts(prev => [...prev, ...added])
      showToast(`${added.length} contacts imported ✓`, 'success')
      setImporting(false)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const exportCSV = () => {
    const rows = [['Name', 'Phone', 'Email', 'Status', 'Tags', 'Added'],
      ...contacts.map(c => [c.name, c.phone, c.email, c.status, c.tags, c.added])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'contacts.csv' })
    a.click()
  }

  const toggleStatus = (i) => {
    setContacts(prev => prev.map((c, idx) =>
      idx === i ? { ...c, status: c.status === 'active' ? 'blocked' : 'active' } : c
    ))
  }

  const removeContact = (i) => {
    setContacts(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--bg2)',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…" style={{ ...inputStyle, paddingLeft: 28, width: '100%' }} />
        </div>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
        <button onClick={() => fileRef.current?.click()} disabled={importing} style={primaryBtn}>
          {importing ? <Spinner size={12} /> : <Upload size={12} />}
          {importing ? 'Importing…' : 'Import CSV'}
        </button>
        <button onClick={exportCSV} style={ghostBtn}>Export CSV</button>
        <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
          {contacts.length} contacts
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Phone', 'Email', 'Status', 'Tags', 'Added', ''].map(h => (
                  <th key={h} style={{
                    padding: '9px 13px', textAlign: 'left', fontSize: 10,
                    fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
                    letterSpacing: '.5px', background: 'var(--bg3)',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                  {contacts.length === 0 ? 'No contacts yet — import a CSV to get started.' : 'No contacts match your search.'}
                </td></tr>
              )}
              {filtered.map((c, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={c.name} size={26} />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'rgba(37,211,102,0.1)', color: '#25d366',
                      borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600,
                    }}>
                      <Phone size={9} /> {c.phone}
                    </span>
                  </td>
                  <td style={{ padding: '9px 13px', color: 'var(--text2)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>{c.email}</td>
                  <td style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                      background: c.status === 'active' ? 'var(--green-dim)' : 'var(--red-dim)',
                      color: c.status === 'active' ? 'var(--green)' : 'var(--red)',
                    }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '9px 13px', color: 'var(--text3)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{c.tags}</td>
                  <td style={{ padding: '9px 13px', color: 'var(--text3)', fontSize: 11, borderBottom: '1px solid var(--border)' }}>{c.added}</td>
                  <td style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => toggleStatus(contacts.indexOf(c))} title={c.status === 'active' ? 'Block' : 'Unblock'}
                        style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {c.status === 'active' ? <XCircle size={11} /> : <CheckCircle size={11} />}
                      </button>
                      <button onClick={() => removeContact(contacts.indexOf(c))} title="Remove"
                        style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid rgba(255,77,109,.3)', background: 'transparent', cursor: 'pointer', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 0', fontSize: 10, color: 'var(--text3)' }}>
          CSV format: <code style={{ fontFamily: 'var(--font-mono)' }}>name, phone, email</code> — optional: tags, status
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: ANALYTICS
// ════════════════════════════════════════════════════════
function AnalyticsTab({ campaigns, templates }) {
  const total    = campaigns.reduce((s, c) => s + c.sent, 0)
  const delivered = campaigns.reduce((s, c) => s + c.delivered, 0)
  const failed   = campaigns.reduce((s, c) => s + c.failed, 0)
  const dlvRate  = total ? Math.round((delivered / total) * 100) : 0
  const failRate = total ? Math.round((failed / total) * 100) : 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Analytics</div>

      {/* Overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Sent',  val: total.toLocaleString(),     color: 'var(--text)',    icon: Send },
          { label: 'Delivered',   val: delivered.toLocaleString(), color: 'var(--green)',   icon: CheckCircle },
          { label: 'Failed',      val: failed.toLocaleString(),    color: 'var(--red)',     icon: XCircle },
          { label: 'Campaigns',   val: campaigns.length,           color: 'var(--accent)',  icon: Megaphone },
        ].map(({ label, val, color, icon: Icon }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Icon size={14} color={color} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Rate bars */}
      {total > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Delivery Performance</div>
          {[
            { label: 'Delivery Rate', pct: dlvRate, color: 'var(--green)' },
            { label: 'Failure Rate',  pct: failRate, color: 'var(--red)' },
          ].map(({ label, pct, color }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 5 }}>
                <span>{label}</span><span style={{ fontWeight: 700, color }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .5s' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign table */}
      {campaigns.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>Campaign History</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Campaign', 'Template', 'Sent', 'Delivered', 'Failed', 'Date'].map(h => (
                  <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.4px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={i}>
                  {[c.name, c.template, c.sent, c.delivered, c.failed, c.date].map((v, j) => (
                    <td key={j} style={{ padding: '9px 14px', fontSize: 12, color: j === 3 ? 'var(--green)' : j === 4 ? 'var(--red)' : 'var(--text)', borderBottom: '1px solid var(--border)' }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {campaigns.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <BarChart2 size={36} strokeWidth={1.2} style={{ opacity: .2, marginBottom: 10 }} />
          <div>No campaign data yet. Run your first broadcast!</div>
        </div>
      )}

      {/* Template stats */}
      {templates.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Template Library</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['approved','pending','rejected'].map(s => {
              const count = templates.filter(t => t.status === s).length
              return (
                <div key={s} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: statusBg(s), color: statusColor(s) }}>
                  {count} {s}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  TAB: SETTINGS
// ════════════════════════════════════════════════════════
function SettingsTab({ accountInfo, showToast }) {
  const [testing, setTesting] = useState(false)
  const [toggles, setToggles] = useState({
    rateLimit: true, retry: true, optOut: true, webhooks: false,
  })
  const toggle = (k) => setToggles(t => ({ ...t, [k]: !t[k] }))

  const testConn = async () => {
    setTesting(true)
    try {
      const d = await waGet('/me')
      if (d.phoneError) { showToast('Error: ' + d.phoneError, 'error') }
      else showToast('Connected: ' + d.phone.verified_name + ' (' + d.phone.display_phone_number + ')', 'success')
    } catch (_) {
      showToast('Cannot reach server.py — is it running?', 'error')
    }
    setTesting(false)
  }

  const phone = accountInfo?.phone
  const waba  = accountInfo?.waba

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, marginBottom: 18 }}>Settings</div>

        {/* Live account info */}
        {phone && (
          <div style={{ background: 'var(--bg2)', border: '1px solid rgba(37,211,102,.25)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#25d366', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
              <CheckCircle size={14} /> Account Info (Live)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              {[
                ['Phone Number', phone.display_phone_number],
                ['Business Name', phone.verified_name],
                ['Quality Rating', phone.quality_rating],
                ['WABA Name', waba?.name],
                ['Currency', waba?.currency],
                ['Timezone', waba?.timezone_id],
                ['Account Status', waba?.account_review_status],
                ['Verification', phone.code_verification_status],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 600 }}>{val || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Credentials */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>WhatsApp Business API</div>
          {[
            { label: 'Phone Number ID', val: '999181363279176', placeholder: 'Enter Phone Number ID' },
            { label: 'WABA ID', val: '3141505256037886', placeholder: 'Enter WABA ID' },
          ].map(({ label, val, placeholder }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <FieldLabel>{label}</FieldLabel>
              <input defaultValue={val} placeholder={placeholder} style={inputStyle} />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <FieldLabel>Access Token</FieldLabel>
            <input type="password" defaultValue="(stored in server.py)" style={inputStyle} />
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Token is securely stored in server.py</div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => showToast('Credentials are stored in server.py', 'warn')} style={primaryBtn}>
              Save Configuration
            </button>
            <button onClick={testConn} disabled={testing} style={ghostBtn}>
              {testing ? <Spinner size={12} /> : <Zap size={12} />}
              Test Connection
            </button>
          </div>
        </div>

        {/* Sending Rules */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Sending Rules</div>
          {[
            { key: 'rateLimit', title: 'Rate Limiting',    desc: 'Respect 1,000 messages/second limit' },
            { key: 'retry',     title: 'Retry on Failure', desc: 'Auto-retry failed messages up to 3×' },
            { key: 'optOut',    title: 'Opt-out Filtering', desc: 'Skip contacts who replied STOP' },
            { key: 'webhooks',  title: 'Delivery Webhooks', desc: 'Receive real-time delivery reports' },
          ].map(({ key, title, desc }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{desc}</div>
              </div>
              <div
                onClick={() => toggle(key)}
                style={{
                  width: 38, height: 21, borderRadius: 11, cursor: 'pointer', position: 'relative',
                  background: toggles[key] ? 'var(--green)' : 'var(--bg4)',
                  transition: 'background .25s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', width: 17, height: 17, background: '#fff',
                  borderRadius: '50%', top: 2,
                  left: toggles[key] ? 19 : 2, transition: 'left .25s',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Webhook config */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Webhook Configuration</div>
          <div style={{ marginBottom: 12 }}>
            <FieldLabel>Webhook URL</FieldLabel>
            <input type="url" placeholder="https://your-server.com/webhook" style={inputStyle} />
          </div>
          <div>
            <FieldLabel>Verify Token</FieldLabel>
            <input placeholder="Your secret verify token" style={inputStyle} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared small components ──────────────────────────────
const inputStyle = {
  width: '100%', padding: '8px 12px',
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 12,
  fontFamily: 'var(--font)', outline: 'none',
}

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', border: '1px solid var(--border2)',
  background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font)',
}

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', border: 'none',
  background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font)',
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function FieldLabel({ children, style }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px', ...style }}>
      {children}
    </div>
  )
}
