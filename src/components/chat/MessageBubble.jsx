import React from 'react'
import { Download, FileText } from 'lucide-react'
import { Avatar } from '../ui'
import { formatTime, fileSize } from '../../lib/utils'

export function MessageBubble({ msg, isOptimistic = false }) {
  const mt     = msg.message_type
  const isNote = mt === 2 || mt === '2' || msg.private === true || msg.private === 'true'
  const isOut  = !isNote && (mt === 1 || mt === '1' || mt === 'outgoing')
  const name   = msg.sender?.name || ''
  const time   = formatTime(msg.created_at)
  const atts   = msg.attachments || []

  if (isNote) {
    return (
      <div style={{ alignSelf: 'stretch', opacity: isOptimistic ? 0.55 : 1, animation: 'msgIn 0.18s ease both', margin: '2px 0' }}>
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderLeft: '4px solid #f59e0b',
          borderRadius: 8,
          padding: '8px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <span>🔒</span>
            <span>Private Note</span>
            {name && <span style={{ fontWeight: 400, textTransform: 'none', color: '#92400e' }}>· {name}</span>}
            <span style={{ marginLeft: 'auto', fontWeight: 400, color: '#b45309', textTransform: 'none', letterSpacing: 0 }}>{time}</span>
          </div>
          <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6, fontStyle: 'italic', wordBreak: 'break-word' }}>
            {atts.length > 0
              ? atts.map((a, i) => <AttachmentBubble key={i} att={a} caption={msg.content} isOut={false} />)
              : msg.content
            }
          </div>
        </div>
      </div>
    )
  }

  const bubbleStyle = isOut
    ? { padding: '9px 12px', borderRadius: 13, borderBottomRightRadius: 4, fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word', maxWidth: 420, background: 'var(--accent)', color: '#fff' }
    : { padding: '9px 12px', borderRadius: 13, borderBottomLeftRadius: 4, fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word', maxWidth: 420, background: 'var(--bg3)', border: '1px solid var(--border)' }

  return (
    <div style={{
      display: 'flex', gap: 8, maxWidth: '75%',
      alignSelf: isOut ? 'flex-end' : 'flex-start',
      flexDirection: isOut ? 'row-reverse' : 'row',
      opacity: isOptimistic ? 0.55 : 1,
      animation: 'msgIn 0.18s ease both',
    }}>
      {!isOut && <Avatar name={name} size={28} style={{ flexShrink: 0, alignSelf: 'flex-end' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: isOut ? 'right' : 'left' }}>{name}</div>
        {atts.length > 0
          ? atts.map((a, i) => <AttachmentBubble key={i} att={a} caption={msg.content} isOut={isOut} />)
          : msg.content && <div style={bubbleStyle}>{msg.content}</div>
        }
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: isOut ? 'right' : 'left' }}>
          {time}{isOptimistic && ' · sending…'}
        </div>
      </div>
    </div>
  )
}

function AttachmentBubble({ att, caption, isOut }) {
  const url  = att.data_url || att.download_url || ''
  const name = att.filename || 'file'
  const type = att.file_type || att.content_type || ''
  const size = fileSize(att.file_size)

  const wrap = { borderRadius: 12, overflow: 'hidden', maxWidth: 280, border: '1px solid var(--border)', background: 'var(--bg3)' }

  if (type.startsWith('image')) return (
    <div style={wrap}>
      <img src={url} alt={name} style={{ width: '100%', display: 'block', cursor: 'pointer', borderRadius: 10 }} onClick={() => window.open(url, '_blank')} />
      {caption && <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text2)' }}>{caption}</div>}
    </div>
  )

  if (type.startsWith('video')) return (
    <div style={wrap}>
      <video src={url} controls style={{ width: '100%', display: 'block' }} />
      {caption && <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text2)' }}>{caption}</div>}
    </div>
  )

  if (type.startsWith('audio')) return (
    <div style={wrap}>
      <audio src={url} controls style={{ width: '100%', padding: 8 }} />
      {caption && <div style={{ padding: '6px 12px 10px', fontSize: 12, color: 'var(--text2)' }}>{caption}</div>}
    </div>
  )

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FileText size={18} color="var(--accent)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{size}</div>
          <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>Download</a>
        </div>
      </div>
      {caption && <div style={{ padding: '0 12px 10px', fontSize: 12, color: 'var(--text2)' }}>{caption}</div>}
    </div>
  )
}

export function DaySeparator({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 11, color: 'var(--text3)' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      {label}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}