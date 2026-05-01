import React, { useEffect, useRef } from 'react'
import { useAgents, useAssignConv } from '../../hooks'
import { Spinner } from '../ui'

export default function TransferDropdown({ convId, onClose }) {
  const { data, isLoading } = useAgents()
  const assign = useAssignConv()
  const ref = useRef()
  const agents = data?.chatwoot_agents || []

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleAssign = (agentId) => {
    assign.mutate({ id: convId, agentId })
    onClose()
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4,
      background: 'var(--bg3)', border: '1px solid var(--border2)',
      borderRadius: 10, width: 200, zIndex: 50, padding: 6,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      animation: 'slideUp 0.15s ease both',
    }}>
      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}><Spinner /></div>}
      {!isLoading && !agents.length && (
        <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text3)' }}>No agents available</div>
      )}
      {agents.map(a => (
        <div key={a.id} onClick={() => handleAssign(a.id)}
          style={{
            padding: '8px 10px', borderRadius: 7, cursor: 'pointer',
            fontSize: 13, transition: 'background .12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {a.name}
        </div>
      ))}
    </div>
  )
}
