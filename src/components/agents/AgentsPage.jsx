import React, { useState } from 'react'
import { Plus, Trash2, Shield, User } from 'lucide-react'
import { useAgents, useCreateAgent, useDeleteAgent } from '../../hooks'
import { Avatar, Badge, Button, Modal, Field, Input, Select, Spinner } from '../ui'

export default function AgentsPage() {
  const { data, isLoading } = useAgents()
  const createAgent = useCreateAgent()
  const deleteAgent = useDeleteAgent()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' })

  const agents = data?.agents || []
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) return
    await createAgent.mutateAsync({ name: form.name, email: form.email, password: form.password, role: form.role })
    setOpen(false)
    setForm({ name: '', email: '', password: '', role: 'agent' })
  }

  const handleDelete = (id) => {
    if (!confirm('Remove this agent?')) return
    deleteAgent.mutate(id)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>Agents</div>
        <Button onClick={() => setOpen(true)}><Plus size={14} /> Add Agent</Button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Agents', value: agents.length, color: 'var(--accent)' },
            { label: 'Admins', value: agents.filter(a => a.role === 'admin').length, color: 'var(--purple)' },
            { label: 'Agents', value: agents.filter(a => a.role === 'agent').length, color: 'var(--green)' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Agents table */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Added', 'Actions'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px',
                    fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                    textTransform: 'uppercase', letterSpacing: '0.6px',
                    borderBottom: '1px solid var(--border)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center' }}><Spinner /></td></tr>}
              {!isLoading && !agents.length && (
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                  No agents yet. Add one above.
                </td></tr>
              )}
              {agents.map(a => (
                <tr key={a.id}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background .12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={a.name} size={28} />
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text2)', fontSize: 13 }}>{a.email}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: a.role === 'admin' ? 'rgba(155,114,255,0.15)' : 'rgba(31,214,147,0.15)',
                      color: a.role === 'admin' ? 'var(--purple)' : 'var(--green)',
                      border: `1px solid ${a.role === 'admin' ? 'rgba(155,114,255,0.3)' : 'rgba(31,214,147,0.3)'}`,
                    }}>
                      {a.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                      {a.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => handleDelete(a.id)} style={{
                      padding: '5px 10px', background: 'var(--red-dim)', border: '1px solid var(--red)',
                      borderRadius: 6, color: 'var(--red)', fontSize: 12, cursor: 'pointer',
                      fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Agent Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add New Agent">
        <Field label="Full Name">
          <Input value={form.name} onChange={set('name')} placeholder="Ahmed Khan" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} placeholder="ahmed@company.com" />
        </Field>
        <Field label="Password">
          <Input type="password" value={form.password} onChange={set('password')} placeholder="Set a password" />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={set('role')}>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={createAgent.isPending || !form.name || !form.email || !form.password}>
            {createAgent.isPending ? <Spinner size={13} /> : 'Add Agent'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
