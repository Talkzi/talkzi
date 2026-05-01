import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as api from '../lib/api'
// ── CONVERSATIONS ─────────────────────────────────────────────────────────────
export function useConversations(filter = 'open', agentId = null) {
  const params = { status: filter === 'mine' ? 'open' : filter }
  if (filter === 'mine' && agentId) { params.assignee_type = 'assigned'; params.agent_id = agentId }
  return useQuery({
    queryKey: ['conversations', filter, agentId],
    queryFn: () => api.getConversations(params),
    refetchInterval: 20_000,
    select: (d) => d.data?.payload || [],
  })
}

export function useConversation(id) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.getConversation(id),
    enabled: !!id,
    staleTime: 5_000,
  })
}

export function useResolveConv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.resolveConv,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['conversation', id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversation resolved')
    },
    onError: (e) => toast.error(e.message || 'Failed to resolve'),
  })
}

export function useReopenConv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.reopenConv,
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['conversation', id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Conversation reopened')
    },
    onError: (e) => toast.error(e.message || 'Failed to reopen'),
  })
}

export function useAssignConv() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, agentId }) => api.assignConv(id, agentId),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['conversation', id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Agent assigned')
    },
    onError: () => toast.error('Assignment failed'),
  })
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────
export function useMessages(convId) {
  return useQuery({
    queryKey: ['messages', convId],
    queryFn: () => api.getMessages(convId),
    enabled: !!convId,
    refetchInterval: 8_000,
    select: (d) => d.payload || [],
  })
}

export function useSendMessage(convId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ content, isPrivate }) => api.sendMessage(convId, content, isPrivate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', convId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (e) => toast.error(e.message || 'Send failed'),
  })
}

export function useSendAttachment(convId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, fileType, caption, isPrivate }) =>
      api.sendAttachment(convId, file, fileType, caption, isPrivate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', convId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('File sent')
    },
    onError: () => toast.error('Upload failed'),
  })
}

// ── LABELS ────────────────────────────────────────────────────────────────────
export function useLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: api.getLabels,
    select: (d) => {
      if (Array.isArray(d)) return d.map(l => l.name || l)
      if (Array.isArray(d?.payload)) return d.payload.map(l => typeof l === 'string' ? l : (l.name || l.title))
      return []
    },
  })
}

export function useConvLabels(convId) {
  return useQuery({
    queryKey: ['conv-labels', convId],
    queryFn: () => api.getConvLabels(convId),
    enabled: !!convId,
    select: (d) => d.payload || [],
  })
}

export function useSetConvLabels(convId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (labels) => api.setConvLabels(convId, labels),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conv-labels', convId] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Labels updated')
    },
    onError: () => toast.error('Failed to update labels'),
  })
}

export function useCreateLabel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, color }) => api.createLabel(name, color),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labels'] })
      toast.success('Label created')
    },
    onError: () => toast.error('Failed to create label'),
  })
}

// ── CONTACTS ──────────────────────────────────────────────────────────────────
export function useContacts(page = 1, q = '') {
  return useQuery({
    queryKey: ['contacts', page, q],
    queryFn: () => api.getContacts(page, q),
    select: (d) => d.payload || d || [],
  })
}

// ── AGENTS (Supabase-only) ────────────────────────────────────────────────────
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
    staleTime: 60_000,
    select: (d) => ({ agents: d?.agents || [] }),
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Agent added')
    },
    onError: (e) => toast.error(e.message || 'Failed to add agent'),
  })
}

export function useDeleteAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      toast.success('Agent removed')
    },
    onError: () => toast.error('Failed to remove agent'),
  })
}

// ── KNOWLEDGE BASE ────────────────────────────────────────────────────────────
export function useKnowledge(q = '', cat = '') {
  return useQuery({
    queryKey: ['knowledge', q, cat],
    queryFn: () => api.getKnowledge(q, cat),
    staleTime: 30_000,
  })
}

export function useKnowledgeCategories() {
  return useQuery({
    queryKey: ['knowledge-categories'],
    queryFn: api.getKnowledgeCategories,
    staleTime: 60_000,
  })
}

export function useCreateKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createKnowledge,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge'] }); toast.success('Article created') },
    onError: () => toast.error('Failed to create article'),
  })
}

export function useUpdateKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.updateKnowledge(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge'] }); toast.success('Article updated') },
    onError: () => toast.error('Failed to update article'),
  })
}

export function useDeleteKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteKnowledge,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge'] }); toast.success('Article deleted') },
    onError: () => toast.error('Failed to delete article'),
  })
}

// ── REPORTS ───────────────────────────────────────────────────────────────────
export function useReports() {
  return useQuery({
    queryKey: ['reports'],
    queryFn: api.getReports,
    refetchInterval: 60_000,
  })
}
