import React, { useState, useMemo } from 'react'
import { Search, Plus, Edit2, Trash2, Copy, X } from 'lucide-react'
import { useKnowledge, useKnowledgeCategories, useCreateKnowledge, useUpdateKnowledge, useDeleteKnowledge } from '../../hooks'
import { useAuthStore } from '../../store'
import { Badge, Button, Modal, Spinner, Field, Input } from '../ui'
import toast from 'react-hot-toast'

export default function KnowledgePage() {
  const { isAdmin } = useAuthStore()
  const admin = isAdmin()
  const [q, setQ]           = useState('')
  const [cat, setCat]       = useState('')
  const [viewing, setViewing]   = useState(null)
  const [editing, setEditing]   = useState(null) // null | {} | article
  const [editorOpen, setEditorOpen] = useState(false)

  const { data: articles = [], isLoading }  = useKnowledge(q, cat)
  const { data: categories = [] }           = useKnowledgeCategories()
  const createKb  = useCreateKnowledge()
  const updateKb  = useUpdateKnowledge()
  const deleteKb  = useDeleteKnowledge()

  const openNew  = () => { setEditing({}); setEditorOpen(true) }
  const openEdit = (a) => { setEditing(a); setEditorOpen(true); setViewing(null) }

  const handleSave = async (data) => {
    if (editing?.id) await updateKb.mutateAsync({ id: editing.id, ...data })
    else             await createKb.mutateAsync(data)
    setEditorOpen(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this article?')) return
    await deleteKb.mutateAsync(id)
    setViewing(null)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>Knowledge Base</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search articles..."
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px 7px 28px', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', width: 200 }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          {admin && <Button onClick={openNew}><Plus size={14} /> New Article</Button>}
        </div>
      </div>

      {/* Layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '180px 1fr', overflow: 'hidden' }}>
        {/* Category sidebar */}
        <div style={{ borderRight: '1px solid var(--border)', padding: 12, overflowY: 'auto' }}>
          <CatItem label="All Articles" active={cat === ''} onClick={() => setCat('')} />
          {categories.map(c => <CatItem key={c} label={c} active={cat === c} onClick={() => setCat(c)} />)}
        </div>

        {/* Articles */}
        <div style={{ overflowY: 'auto', padding: 16 }}>
          {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner /></div>}
          {!isLoading && !articles.length && (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 40 }}>
              {q ? 'No articles match your search.' : 'No articles yet. Click "+ New Article" to create one.'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {articles.map(a => (
              <ArticleCard key={a.id} article={a} admin={admin}
                onView={() => setViewing(a)}
                onEdit={() => openEdit(a)}
                onDelete={() => handleDelete(a.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* View Modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || ''} width={600}>
        {viewing && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <Badge variant="cyan">{viewing.category || 'General'}</Badge>
              {(viewing.tags || '').split(',').filter(Boolean).map(t => (
                <span key={t} style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--cyan-dim)', color: 'var(--cyan)', fontSize: 11 }}>{t.trim()}</span>
              ))}
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
                Updated {viewing.updated_at ? new Date(viewing.updated_at).toLocaleDateString() : '—'}
              </span>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 1.8, color: 'var(--text2)', whiteSpace: 'pre-wrap', maxHeight: '50vh', overflowY: 'auto' }}>
              {viewing.content}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
              {admin && <Button variant="danger" onClick={() => handleDelete(viewing.id)}><Trash2 size={13} /> Delete</Button>}
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(viewing.content); toast.success('Copied!') }}>
                  <Copy size={13} /> Copy
                </Button>
                {admin && <Button onClick={() => openEdit(viewing)}><Edit2 size={13} /> Edit</Button>}
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* Editor Modal */}
      <ArticleEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        article={editing}
        onSave={handleSave}
        saving={createKb.isPending || updateKb.isPending}
      />
    </div>
  )
}

function CatItem({ label, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
      color: active ? 'var(--accent)' : 'var(--text2)',
      background: active ? 'var(--accent-dim)' : 'transparent',
      fontWeight: active ? 600 : 400, transition: 'all .15s', marginBottom: 2,
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)' } }}
    >{label}</div>
  )
}

function ArticleCard({ article, admin, onView, onEdit, onDelete }) {
  const tags = (article.tags || '').split(',').filter(Boolean)
  return (
    <div onClick={onView} style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
      padding: 16, cursor: 'pointer', transition: 'all .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg3)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg2)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{article.title}</div>
        <Badge variant="cyan" style={{ flexShrink: 0 }}>{article.category || 'General'}</Badge>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
        {article.content}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          By {article.created_by || 'Unknown'} · {article.updated_at ? new Date(article.updated_at).toLocaleDateString() : ''}
        </span>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {tags.map(t => <span key={t} style={{ padding: '2px 7px', borderRadius: 20, background: 'var(--cyan-dim)', color: 'var(--cyan)', fontSize: 11 }}>{t.trim()}</span>)}
        </div>
        {admin && (
          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} style={{ padding: '4px 8px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Edit</button>
            <button onClick={onDelete} style={{ padding: '4px 8px', background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font)' }}>Delete</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ArticleEditor({ open, onClose, article, onSave, saving }) {
  const [form, setForm] = useState({ title: '', category: '', tags: '', content: '' })

  React.useEffect(() => {
    if (open) setForm({
      title:    article?.title    || '',
      category: article?.category || '',
      tags:     article?.tags     || '',
      content:  article?.content  || '',
    })
  }, [open, article])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <Modal open={open} onClose={onClose} title={article?.id ? 'Edit Article' : 'New Article'} width={640}>
      <Field label="Title">
        <Input value={form.title} onChange={set('title')} placeholder="Article title..." />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Category">
          <Input value={form.category} onChange={set('category')} placeholder="e.g. Shipping, Returns" />
        </Field>
        <Field label="Tags (comma separated)">
          <Input value={form.tags} onChange={set('tags')} placeholder="refund, order, tracking" />
        </Field>
      </div>
      <Field label="Content">
        <textarea value={form.content} onChange={set('content')} placeholder="Write your article content here..."
          style={{
            width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 12, color: 'var(--text)', fontSize: 13,
            fontFamily: 'var(--font)', outline: 'none', resize: 'vertical',
            minHeight: 240, lineHeight: 1.7, transition: 'border .15s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={saving || !form.title || !form.content}>
          {saving ? <Spinner size={13} /> : 'Save Article'}
        </Button>
      </div>
    </Modal>
  )
}
