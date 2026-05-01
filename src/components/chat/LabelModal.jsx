import React, { useState, useEffect } from 'react'
import { Modal, Button, Spinner } from '../ui'
import { useLabels, useConvLabels, useSetConvLabels, useCreateLabel } from '../../hooks'

export default function LabelModal({ open, onClose, convId }) {
  const { data: allLabels = [], isLoading: loadingLabels } = useLabels()
  const { data: convLabels = [], isLoading: loadingConv }  = useConvLabels(convId)
  const setLabels   = useSetConvLabels(convId)
  const createLabel = useCreateLabel()

  const [selected, setSelected] = useState([])
  const [newName, setNewName] = useState('')

  useEffect(() => { if (open) setSelected(convLabels) }, [open, convLabels])

  const toggle = (label) =>
    setSelected(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label])

  const handleSave = async () => {
    await setLabels.mutateAsync(selected)
    onClose()
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    await createLabel.mutateAsync({ name: newName.trim().toLowerCase().replace(/\s+/g, '_') })
    setNewName('')
  }

  const loading = loadingLabels || loadingConv

  return (
    <Modal open={open} onClose={onClose} title="Manage Labels">
      <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        Click labels to toggle them on this conversation.
      </p>

      {/* Label picker */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10,
        background: 'var(--bg3)', borderRadius: 8, minHeight: 52, marginBottom: 12,
      }}>
        {loading && <Spinner />}
        {!loading && !allLabels.length && (
          <span style={{ color: 'var(--text3)', fontSize: 13 }}>No labels yet. Create one below.</span>
        )}
        {allLabels.map(l => (
          <button key={l} onClick={() => toggle(l)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${selected.includes(l) ? 'var(--purple)' : 'var(--border2)'}`,
            background: selected.includes(l) ? 'var(--purple-dim)' : 'var(--bg4)',
            color: selected.includes(l) ? 'var(--purple)' : 'var(--text2)',
            transition: 'all .15s', fontFamily: 'var(--font)',
          }}>{l}</button>
        ))}
      </div>

      {/* Create new */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="New label name..."
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          style={{
            flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px', color: 'var(--text)',
            fontSize: 13, fontFamily: 'var(--font)', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <Button onClick={handleCreate} disabled={createLabel.isPending || !newName.trim()} size="sm">
          {createLabel.isPending ? <Spinner size={12} /> : '+ Add'}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={setLabels.isPending}>
          {setLabels.isPending ? <Spinner size={12} /> : 'Save Labels'}
        </Button>
      </div>
    </Modal>
  )
}
