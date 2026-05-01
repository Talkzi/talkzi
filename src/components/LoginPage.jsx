import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Sun, Moon } from 'lucide-react'
import { login } from '../lib/api'
import { useAuthStore, useThemeStore } from '../store'
import { Spinner } from './ui'
import { TalkziMark } from './ui/TalkziLogo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const setSession = useAuthStore(s => s.setSession)
  const { theme, toggleTheme } = useThemeStore()

  const { mutate, isPending, isError } = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => setSession(data),
    onError: () => toast.error('Invalid email or password'),
  })

  const submit = (e) => {
    e?.preventDefault()
    if (!email || !password) { toast.error('Fill in all fields'); return }
    mutate()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 32,
    }}>
      {/* Theme toggle floats top-right */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        style={{
          position: 'fixed', top: 18, right: 18,
          width: 38, height: 38, borderRadius: 10,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          color: 'var(--text2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Background glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
        pointerEvents: 'none', opacity: 0.5,
      }} />

      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 18, padding: '40px 40px 36px', width: 380,
        position: 'relative', animation: 'slideUp 0.3s ease both',
        boxShadow: 'var(--shadow-pop)',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ borderRadius: 12, boxShadow: '0 0 22px var(--accent-glow)' }}>
            <TalkziMark size={48} color="#ffffff" bg="var(--accent)" />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800,
              letterSpacing: '-0.5px', color: 'var(--text)', lineHeight: 1,
            }}>
              Talkzi
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 5 }}>
              Sign in to your workspace
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
              style={{
                width: '100%', background: 'var(--bg3)',
                border: `1px solid ${isError ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 8, padding: '10px 14px',
                color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)',
                outline: 'none', transition: 'border .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = isError ? 'var(--red)' : 'var(--border)'}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', fontWeight: 500, marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', background: 'var(--bg3)',
                border: `1px solid ${isError ? 'var(--red)' : 'var(--border)'}`,
                borderRadius: 8, padding: '10px 14px',
                color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font)',
                outline: 'none', transition: 'border .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = isError ? 'var(--red)' : 'var(--border)'}
            />
          </div>

          {isError && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12, marginTop: -8 }}>
              Invalid email or password.
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              width: '100%', background: 'var(--accent)', border: 'none',
              borderRadius: 8, padding: '11px', color: '#fff',
              fontSize: 14, fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, opacity: isPending ? 0.7 : 1,
              transition: 'opacity .15s',
            }}
          >
            {isPending ? <><Spinner size={14} /> Signing in...</> : 'Sign in'}
          </button>
        </form>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)' }}>
        Talkzi · WhatsApp Support Platform
      </div>
    </div>
  )
}
