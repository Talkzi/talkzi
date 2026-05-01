import React from 'react'
import { useConversation, useConvLabels, useAssignConv, useAgents } from '../../hooks'
import { useUIStore } from '../../store'
import { Avatar, LabelChip, Select, Spinner } from '../ui'

export default function DetailPanel() {
  const { activeConvId, openLabelModal } = useUIStore()
  const { data: conv, isLoading } = useConversation(activeConvId)
  const { data: labels = [] }     = useConvLabels(activeConvId)
  const { data: agentsData }      = useAgents()
  const assignConv = useAssignConv()

  // Supabase agents list
  const agents = agentsData?.agents || []

  const contact  = conv?.meta?.sender || {}
  const name     = contact.name || 'Unknown'

  // Assigned agent from Supabase metadata
  const sbMeta    = conv?._sb || {}
  const assignedTo = sbMeta.assigned_to || ''
  const assignedAgent = sbMeta.assigned_agent
  const sbTags    = sbMeta.tags || []

  if (!activeConvId) return null

  return (
    <aside style={{
      width: 'var(--detail-w)', background: 'var(--bg2)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spinner /></div>
        )}

        {/* ── CONTACT ── */}
        <Section title="Contact">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Avatar name={name} size={38} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{contact.phone_number || '—'}</div>
            </div>
          </div>
          <Row label="Email"    value={contact.email    || '—'} />
          <Row label="Location" value={contact.location || '—'} />
        </Section>

        {/* ── ASSIGN AGENT (Supabase agents) ── */}
        <Section title="Assigned Agent">
          <Select
            value={assignedTo}
            onChange={e => assignConv.mutate({
              id: activeConvId,
              agentId: e.target.value ? parseInt(e.target.value) : null
            })}
          >
            <option value="">Unassigned</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          {assignedAgent && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Avatar name={assignedAgent.name} size={18} />
              {assignedAgent.name}
              <span style={{ color: 'var(--text3)' }}>· {assignedAgent.email}</span>
            </div>
          )}
        </Section>

        {/* ── LABELS ── */}
        <Section title="Labels">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 28 }}>
            {labels.length
              ? labels.map(l => <LabelChip key={l} label={l} />)
              : <span style={{ color: 'var(--text3)', fontSize: 12 }}>None</span>
            }
          </div>
          <button onClick={openLabelModal} style={{
            marginTop: 8, padding: '4px 10px', background: 'transparent',
            border: '1px dashed var(--border2)', borderRadius: 6,
            color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)',
            transition: 'all .15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}
          >+ Manage Labels</button>
        </Section>

        {/* ── TAGS (from Supabase conversations.tags[]) ── */}
        {sbTags.length > 0 && (
          <Section title="Tags">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sbTags.map(t => (
                <span key={t} style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: 'rgba(6,182,212,0.12)', color: '#06b6d4',
                  border: '1px solid rgba(6,182,212,0.3)',
                }}>{t}</span>
              ))}
            </div>
          </Section>
        )}

        {/* ── CONVERSATION ── */}
        <Section title="Conversation">
          <Row label="ID"      value={conv ? `#${conv.id}` : '—'} />
          <Row label="Status"  value={sbMeta.status || conv?.status || '—'} />
          <Row label="Channel" value={conv?.channel || '—'} />
          <Row label="Created" value={conv?.created_at ? new Date(conv.created_at * 1000).toLocaleDateString() : '—'} />
        </Section>
      </div>
    </aside>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}
