import React from 'react'
import { RefreshCw, MessageCircle, Clock, AlertCircle, Users, Activity, Inbox, CheckCircle2 } from 'lucide-react'
import { useReports } from '../../hooks'
import { Avatar, Badge, Spinner, Button } from '../ui'
import { useQueryClient } from '@tanstack/react-query'
import { relativeTime } from '../../lib/utils'

export default function ReportsPage() {
  const { data, isLoading, isError } = useReports()
  const qc = useQueryClient()
  const ov = data?.overview || {}
  const agents          = ov.agents || []
  const channels        = ov.channels || {}
  const recent          = ov.recent_activity || []

  const TOP_STATS = [
    { label: 'Open Conversations',  value: ov.open_conversations_count    ?? 0, color: 'var(--green)',  icon: Inbox          },
    { label: 'Pending',             value: ov.pending_conversations_count ?? 0, color: 'var(--amber)',  icon: Clock          },
    { label: 'Unattended',          value: ov.unattended_conversations_count ?? 0, color: 'var(--red)', icon: AlertCircle    },
    { label: 'Agents Online',       value: ov.agents_online ?? 0,                color: 'var(--accent)', icon: Users         },
    { label: 'Resolved',            value: ov.resolved_conversations_count ?? 0, color: 'var(--cyan)',  icon: CheckCircle2  },
    { label: 'Active Last 24h',     value: ov.messages_last_24h ?? 0,            color: 'var(--purple)', icon: Activity     },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, var(--accent), var(--purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px var(--accent-glow)',
          }}>
            <Activity size={14} color="#fff" strokeWidth={2.2} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
            Reports & Analytics
          </span>
        </div>
        <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ['reports'] })}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spinner size={28} />
          </div>
        )}

        {isError && (
          <div style={{
            padding: 18, borderRadius: 10,
            background: 'var(--red-dim)', border: '1px solid var(--red)',
            color: 'var(--red)', fontSize: 13, marginBottom: 18,
          }}>
            ⚠ Could not reach the reports endpoint. Check that the backend is running and configured.
          </div>
        )}

        {!isLoading && (
          <>
            {/* TOP STATS */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14, marginBottom: 22,
            }}>
              {TOP_STATS.map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} style={{
                    background: 'var(--bg2)', border: '1px solid var(--border)',
                    borderRadius: 14, padding: '18px 20px',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    position: 'relative', overflow: 'hidden',
                    animation: 'fadeIn .3s ease both',
                  }}>
                    <div style={{
                      position: 'absolute', top: -20, right: -20, width: 80, height: 80,
                      borderRadius: '50%', background: s.color, opacity: 0.08,
                      filter: 'blur(20px)', pointerEvents: 'none',
                    }} />
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: 'var(--bg3)', color: s.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                    }}>
                      <Icon size={15} strokeWidth={2.2} />
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700,
                      color: s.color, lineHeight: 1, position: 'relative',
                    }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', position: 'relative' }}>
                      {s.label}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Two-column area: agents + channels */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
              gap: 16, marginBottom: 22,
            }}>
              {/* Agents */}
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 14, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '12px 18px', borderBottom: '1px solid var(--border)',
                  fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span>Agent Performance</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    {agents.length} agent{agents.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Agent', 'Status', 'Open', 'Resolved', 'Role'].map(h => (
                          <th key={h} style={{
                            textAlign: 'left', padding: '10px 14px',
                            fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                            textTransform: 'uppercase', letterSpacing: '0.6px',
                            borderBottom: '1px solid var(--border)',
                            background: 'var(--bg3)',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!agents.length && (
                        <tr><td colSpan={5} style={{
                          padding: '40px 20px', textAlign: 'center',
                          color: 'var(--text3)', fontSize: 13,
                        }}>
                          No agents yet. Add some on the <strong>Agents</strong> page.
                        </td></tr>
                      )}
                      {agents.map((a, i) => (
                        <tr key={a.id || i} style={{
                          borderBottom: '1px solid var(--border)',
                          background: i % 2 === 1 ? 'var(--row-odd)' : 'transparent',
                        }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <Avatar name={a.name} size={28} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name || '—'}</div>
                                {a.email && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.email}</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {a.online ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                fontSize: 11, fontWeight: 600,
                                padding: '3px 9px', borderRadius: 20,
                                background: 'var(--green-dim)', color: 'var(--green)',
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
                                Online
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Offline</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <Badge variant="blue">{a.open ?? 0}</Badge>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <Badge variant="open">{a.resolved ?? 0}</Badge>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)', textTransform: 'capitalize' }}>
                            {a.role || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Channels */}
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 14,
              }}>
                <div style={{
                  padding: '12px 18px', borderBottom: '1px solid var(--border)',
                  fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)',
                }}>
                  Channels
                </div>
                <div style={{ padding: '14px 18px' }}>
                  {!Object.keys(channels).length && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', padding: '20px 0', textAlign: 'center' }}>
                      No active conversations
                    </div>
                  )}
                  {Object.entries(channels)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => {
                      const total = Object.values(channels).reduce((s, n) => s + n, 0) || 1
                      const pct = Math.round((count / total) * 100)
                      return (
                        <div key={name} style={{ marginBottom: 12 }}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: 5,
                          }}>
                            <span style={{ fontSize: 13, textTransform: 'capitalize' }}>
                              {name.replace('Channel::', '').replace(/_/g, ' ')}
                            </span>
                            <span style={{
                              fontSize: 11, fontFamily: 'var(--font-mono)',
                              color: 'var(--text2)',
                            }}>{count} · {pct}%</span>
                          </div>
                          <div style={{
                            height: 6, background: 'var(--bg3)', borderRadius: 3,
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%', width: pct + '%',
                              background: 'linear-gradient(90deg, var(--accent), var(--purple))',
                              borderRadius: 3, transition: 'width .3s',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 18px', borderBottom: '1px solid var(--border)',
                fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)',
              }}>
                Recent Activity
              </div>
              {!recent.length && (
                <div style={{
                  padding: 30, textAlign: 'center',
                  color: 'var(--text3)', fontSize: 13,
                }}>
                  No recent activity
                </div>
              )}
              {recent.map((r, i) => (
                <div key={r.id || i} style={{
                  padding: '12px 18px',
                  borderBottom: i === recent.length - 1 ? 'none' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <Avatar name={r.name} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                    <div style={{
                      fontSize: 11, color: 'var(--text3)',
                      display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
                    }}>
                      <Badge variant={r.status === 'open' ? 'open' : r.status === 'pending' ? 'pending' : 'resolved'}>
                        {r.status}
                      </Badge>
                      {r.channel && (
                        <span style={{ textTransform: 'capitalize' }}>
                          · {r.channel.replace('Channel::', '').replace(/_/g, ' ')}
                        </span>
                      )}
                      {r.assignee && <span>· {r.assignee}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                    {relativeTime(r.ts)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
