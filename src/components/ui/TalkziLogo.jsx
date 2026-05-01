import React from 'react'

/* ──────────────────────────────────────────────────────────
   Talkzi logo — pure SVG (so it scales and theme-flips cleanly).
   Recreates the chat-bubble + sparkle mark from the brand image.
   ─────────────────────────────────────────────────────────── */

export function TalkziMark({ size = 36, color = '#ffffff', bg = null, style = {} }) {
  return (
    <div
      style={{
        width: size, height: size,
        background: bg,
        borderRadius: bg ? size * 0.25 : 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <svg viewBox="0 0 64 64" width={size * (bg ? 0.65 : 1)} height={size * (bg ? 0.65 : 1)} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer C-curve of the chat bubble */}
        <path
          d="M32 6c14.4 0 26 11.6 26 26S46.4 58 32 58H10l5-7c-5.6-4.7-9-11.7-9-19C6 17.6 17.6 6 32 6z"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Three dots inside the bubble */}
        <circle cx="22" cy="32" r="2.6" fill={color} />
        <circle cx="32" cy="32" r="2.6" fill={color} />
        <circle cx="42" cy="32" r="2.6" fill={color} />
        {/* Sparkle */}
        <path
          d="M50 12 L51.6 16.4 L56 18 L51.6 19.6 L50 24 L48.4 19.6 L44 18 L48.4 16.4 Z"
          fill={color}
        />
      </svg>
    </div>
  )
}

/* Wordmark: icon + "Talkzi" text */
export function TalkziWordmark({ size = 22, color = 'var(--text)' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <TalkziMark size={size * 1.5} color="var(--accent)" />
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: size,
          fontWeight: 800,
          letterSpacing: '-0.4px',
          color,
          lineHeight: 1,
        }}
      >
        Talkzi
      </span>
    </div>
  )
}
