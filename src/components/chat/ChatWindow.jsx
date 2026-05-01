import React, { useEffect, useRef, useState } from 'react'
import { RefreshCw, Tag, BookOpen, ArrowLeftRight, CheckCircle, RotateCcw } from 'lucide-react'
import { useMessages, useConversation, useResolveConv, useReopenConv, useConvLabels } from '../../hooks'
import { useUIStore, useAuthStore } from '../../store'
import { MessageBubble, DaySeparator } from './MessageBubble'
import ReplyBox from './ReplyBox'
import KbChatPanel from './KbChatPanel'
import LabelModal from './LabelModal'
import { Avatar, Badge, IconButton, Spinner } from '../ui'
import { formatDate } from '../../lib/utils'
import TransferDropdown from './TransferDropdown'

function groupByDay(msgs) {
  const groups = []
  let lastDay = null
  for (const m of msgs) {
    const day = m.created_at ? formatDate(m.created_at) : null
    if (day && day !== lastDay) { groups.push({ type: 'day', label: day }); lastDay = day }
    groups.push({ type: 'msg', msg: m })
  }
  return groups
}

export default function ChatWindow() {
  const { activeConvId, kbPanelOpen, toggleKbPanel, closeKbPanel, labelModalOpen, openLabelModal, closeLabelModal } = useUIStore()
  const { isAdmin } = useAuthStore()
  const messagesEndRef = useRef(null)
  const replyRef = useRef(null)
  const [transferOpen, setTransferOpen] = useState(false)

  const { data: conv,     isLoading: convLoading } = useConversation(activeConvId)
  const { data: messages, isLoading: msgsLoading, refetch } = useMessages(activeConvId)
  const { data: convLabels = [] } = useConvLabels(activeConvId)
  const resolveConv = useResolveConv()
  const reopenConv  = useReopenConv()

  const admin = isAdmin()
  const status = conv?.status || 'open'
  const contact = conv?.meta?.sender || {}
  const contactName = contact.name || 'Unknown'
  const assignee = conv?.meta?.assignee?.name

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Inject KB content into reply box
  const handleKbUse = (content) => {
    closeKbPanel()
    if (replyRef.current?.setContent) replyRef.current.setContent(content)
  }

  if (!activeConvId) return null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--bg2)', flexShrink: 0,
      }}>
        <Avatar name={contactName} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{contactName}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
            <span>{conv?.channel || 'WhatsApp'}</span>
            <span>·</span>
            <Badge variant={status === 'open' ? 'open' : status === 'resolved' ? 'resolved' : 'pending'}>{status}</Badge>
            {assignee && <><span>·</span><span>{assignee}</span></>}
            {convLabels.map(l => (
              <span key={l} style={{
                padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                background: 'var(--purple-dim)', color: 'var(--purple)',
                border: '1px solid rgba(155,114,255,0.3)',
              }}>{l}</span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Resolve / Reopen */}
          {status === 'resolved' ? (
            <button
              onClick={() => reopenConv.mutate(activeConvId)}
              disabled={reopenConv.isPending}
              style={{
                padding: '6px 13px', background: 'var(--amber-dim)', border: '1px solid var(--amber)',
                borderRadius: 8, color: 'var(--amber)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <RotateCcw size={13} /> Reopen
            </button>
          ) : (
            <button
              onClick={() => resolveConv.mutate(activeConvId)}
              disabled={resolveConv.isPending}
              style={{
                padding: '6px 13px', background: 'var(--green-dim)', border: '1px solid var(--green)',
                borderRadius: 8, color: 'var(--green)', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <CheckCircle size={13} /> Resolve
            </button>
          )}

          {/* Transfer (admin only) */}
          {admin && (
            <div style={{ position: 'relative' }}>
              <IconButton title="Transfer" onClick={() => setTransferOpen(o => !o)}>
                <ArrowLeftRight size={15} />
              </IconButton>
              {transferOpen && (
                <TransferDropdown convId={activeConvId} onClose={() => setTransferOpen(false)} />
              )}
            </div>
          )}

          {/* Labels (admin only) */}
          {admin && (
            <IconButton title="Labels" onClick={openLabelModal}>
              <Tag size={15} />
            </IconButton>
          )}

          {/* KB Toggle */}
          <IconButton title="Knowledge Base" active={kbPanelOpen} onClick={toggleKbPanel}>
            <BookOpen size={15} />
          </IconButton>

          {/* Refresh */}
          <IconButton title="Refresh" onClick={() => refetch()}>
            <RefreshCw size={14} />
          </IconButton>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {msgsLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>}
        {!msgsLoading && !messages?.length && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 32 }}>
            No messages yet
          </div>
        )}
        {!msgsLoading && groupByDay(messages || []).map((item, i) =>
          item.type === 'day'
            ? <DaySeparator key={`day-${i}`} label={item.label} />
            : <MessageBubble key={item.msg.id || i} msg={item.msg} />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── KB PANEL (above reply box) ── */}
      {kbPanelOpen && <KbChatPanel onUse={handleKbUse} />}

      {/* ── REPLY BOX ── */}
      <ReplyBox convId={activeConvId} ref={replyRef} />

      {/* ── LABEL MODAL ── */}
      <LabelModal open={labelModalOpen} onClose={closeLabelModal} convId={activeConvId} />
    </div>
  )
}
