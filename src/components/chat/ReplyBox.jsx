import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Image, Video, Mic, FileText, X, Send, Square, Pause, Play } from 'lucide-react'
import { useSendMessage, useSendAttachment } from '../../hooks'
import { Spinner } from '../ui'
import toast from 'react-hot-toast'

const FILE_TYPES = [
  { type: 'image',    accept: 'image/*',  Icon: Image,    title: 'Image'    },
  { type: 'video',    accept: 'video/*',  Icon: Video,    title: 'Video'    },
  { type: 'document', accept: '*/*',      Icon: FileText, title: 'Document' },
]

/* ──────────────────────────────────────────────────────────
   Reply box with realtime voice recording (MediaRecorder API)
   - Click mic → starts recording from the browser's microphone
   - Live timer + waveform-style pulse while recording
   - Click stop → preview with playback, send, or discard
   ─────────────────────────────────────────────────────────── */

const ReplyBox = forwardRef(function ReplyBox({ convId }, ref) {
  const [mode, setMode] = useState('reply')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState(null)

  // Recording state
  const [recState, setRecState]       = useState('idle') // idle | recording | paused | preview
  const [recTime, setRecTime]         = useState(0)
  const [audioBlob, setAudioBlob]     = useState(null)
  const [audioUrl, setAudioUrl]       = useState(null)
  const mediaRecorderRef              = useRef(null)
  const recordedChunksRef             = useRef([])
  const streamRef                     = useRef(null)
  const timerRef                      = useRef(null)

  const fileRefs = useRef({})

  const isNote  = mode === 'note'
  const sendMsg = useSendMessage(convId)
  const sendAtt = useSendAttachment(convId)
  const sending = sendMsg.isPending || sendAtt.isPending

  useImperativeHandle(ref, () => ({
    setContent: (content) => setText(content)
  }))

  /* Cleanup recorder + stream on unmount or conv change */
  useEffect(() => {
    return () => {
      stopStream()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // If user switches conversation while recording, discard
    if (recState !== 'idle') discardRecording()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId])

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  function pickMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
    }
    return ''
  }

  async function startRecording() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone is not supported on this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMimeType()
      const rec  = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = rec
      recordedChunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mime || 'audio/webm' })
        recordedChunksRef.current = []
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        setRecState('preview')
        stopStream()
      }
      rec.start(250) // 250 ms timeslices for smoother data flow
      setRecTime(0)
      setRecState('recording')
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000)
    } catch (err) {
      console.error(err)
      if (err?.name === 'NotAllowedError') toast.error('Microphone permission denied')
      else toast.error('Could not start recording')
      stopStream()
    }
  }

  function pauseResume() {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (recState === 'recording') {
      rec.pause()
      clearInterval(timerRef.current)
      setRecState('paused')
    } else if (recState === 'paused') {
      rec.resume()
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000)
      setRecState('recording')
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current
    if (!rec) return
    if (timerRef.current) clearInterval(timerRef.current)
    if (rec.state !== 'inactive') rec.stop()
  }

  function discardRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    const rec = mediaRecorderRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch {}
    }
    stopStream()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null); setAudioUrl(null)
    setRecState('idle'); setRecTime(0)
  }

  async function sendVoiceNote() {
    if (!audioBlob || !convId) return
    const ext = (audioBlob.type.split('/')[1] || 'webm').split(';')[0]
    const filename = `voice-${Date.now()}.${ext}`
    const audioFile = new File([audioBlob], filename, { type: audioBlob.type })
    try {
      await sendAtt.mutateAsync({ file: audioFile, fileType: 'audio', caption: text, isPrivate: isNote })
      setText('')
      discardRecording()
    } catch (e) {
      // toast handled by mutation onError
    }
  }

  const handleSend = async () => {
    if (!convId || sending) return
    if (recState === 'preview') return sendVoiceNote()
    if (file) {
      await sendAtt.mutateAsync({ file, fileType, caption: text, isPrivate: isNote })
      setFile(null); setFileType(null); setText('')
    } else if (text.trim()) {
      await sendMsg.mutateAsync({ content: text.trim(), isPrivate: isNote })
      setText('')
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend() }
  }

  const handleFileChange = (e, type) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f); setFileType(type); e.target.value = ''
  }

  const fmtTime = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  // ── RECORDING UI: replaces the textarea while recording or in preview ──
  const isRec = recState === 'recording' || recState === 'paused'

  return (
    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, padding: '10px 12px' }}>
      <div style={{ display: 'flex', marginBottom: 8, background: 'var(--bg3)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {['reply', 'note'].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            border: 'none', fontFamily: 'var(--font)', transition: 'all .15s',
            background: mode === m ? 'var(--bg4)' : 'transparent',
            color: mode === m ? 'var(--text)' : 'var(--text2)',
          }}>{m === 'note' ? 'Private Note' : 'Reply'}</button>
        ))}
      </div>

      {file && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: 'var(--bg4)', border: '1px solid var(--border2)',
          borderRadius: 8, marginBottom: 6,
        }}>
          <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📎 {file.name}
          </span>
          <button onClick={() => { setFile(null); setFileType(null) }} style={{
            background: 'var(--red-dim)', border: 'none', borderRadius: 4,
            width: 20, height: 20, cursor: 'pointer', color: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={12} /></button>
        </div>
      )}

      {/* RECORDING BAR — shown during recording or preview */}
      {isRec && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px', borderRadius: 10,
          border: `1px solid ${recState === 'recording' ? 'var(--red)' : 'var(--amber)'}`,
          background: recState === 'recording' ? 'var(--red-dim)' : 'var(--amber-dim)',
          marginBottom: 6,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: recState === 'recording' ? 'var(--red)' : 'var(--amber)',
            animation: recState === 'recording' ? 'pulse 1.1s ease infinite' : 'none',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14,
            color: recState === 'recording' ? 'var(--red)' : 'var(--amber)',
          }}>{fmtTime(recTime)}</span>

          {/* Animated bars */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 3, height: 22 }}>
            {Array.from({ length: 22 }).map((_, i) => (
              <div key={i} style={{
                flex: 1,
                height: recState === 'recording' ? `${30 + Math.random() * 70}%` : '40%',
                background: recState === 'recording' ? 'var(--red)' : 'var(--amber)',
                opacity: 0.55 + Math.random() * 0.45,
                borderRadius: 2,
                animation: recState === 'recording'
                  ? `pulse ${0.6 + (i % 5) * 0.15}s ease infinite`
                  : 'none',
              }} />
            ))}
          </div>

          <button title={recState === 'recording' ? 'Pause' : 'Resume'} onClick={pauseResume} style={iconBtn}>
            {recState === 'recording' ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button title="Stop" onClick={stopRecording} style={{
            ...iconBtn, background: 'var(--red)', color: '#fff', border: 'none',
          }}>
            <Square size={12} fill="#fff" />
          </button>
          <button title="Discard" onClick={discardRecording} style={iconBtn}>
            <X size={14} />
          </button>
        </div>
      )}

      {recState === 'preview' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 10,
          border: '1px solid var(--border2)', background: 'var(--bg4)',
          marginBottom: 6,
        }}>
          <Mic size={14} color="var(--accent)" />
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>
            Voice note · {fmtTime(recTime)}
          </span>
          <audio src={audioUrl} controls style={{ flex: 1, height: 32, maxWidth: 280 }} />
          <button title="Discard" onClick={discardRecording} style={{
            ...iconBtn, background: 'var(--red-dim)', color: 'var(--red)',
            borderColor: 'rgba(255,77,109,0.3)',
          }}><X size={13} /></button>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
          placeholder={
            isRec ? 'Recording…' :
            recState === 'preview' ? 'Add a caption (optional)…' :
            isNote ? 'Write a private note (not visible to customer)...' :
            'Type a message... (Ctrl+Enter to send)'
          }
          rows={3}
          disabled={isRec}
          style={{
            width: '100%', background: 'var(--bg3)',
            border: `1px solid ${isNote ? 'rgba(255,176,32,0.35)' : 'var(--border)'}`,
            borderRadius: 10, padding: '10px 12px 42px', color: 'var(--text)',
            fontSize: 13, fontFamily: 'var(--font)', outline: 'none',
            resize: 'none', minHeight: 80, maxHeight: 180, lineHeight: 1.5, transition: 'border .15s',
            opacity: isRec ? 0.6 : 1,
          }}
          onFocus={e => e.target.style.borderColor = isNote ? 'var(--amber)' : 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = isNote ? 'rgba(255,176,32,0.35)' : 'var(--border)'}
        />
        <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* File type buttons */}
          {FILE_TYPES.map(({ type, accept, Icon, title }) => (
            <React.Fragment key={type}>
              <button title={title} disabled={isRec || recState === 'preview'} onClick={() => fileRefs.current[type]?.click()} style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isRec ? 'not-allowed' : 'pointer', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text3)', transition: 'all .15s',
                opacity: isRec || recState === 'preview' ? 0.4 : 1,
              }}
                onMouseEnter={e => { if (!isRec) { e.currentTarget.style.background='var(--bg4)'; e.currentTarget.style.color='var(--text)' } }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)' }}
              ><Icon size={13} /></button>
              <input type="file" accept={accept} ref={el => fileRefs.current[type] = el}
                onChange={e => handleFileChange(e, type)} style={{ display: 'none' }} />
            </React.Fragment>
          ))}

          {/* MIC: starts recording (hidden during recording/preview because there's a control bar) */}
          {recState === 'idle' && (
            <button title="Record voice message" onClick={startRecording} style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text3)', transition: 'all .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
            >
              <Mic size={13} />
            </button>
          )}

          <div style={{ flex: 1 }} />
          <button onClick={handleSend} disabled={sending || isRec || (!text.trim() && !file && recState !== 'preview')} style={{
            padding: '5px 14px', background: 'var(--accent)', border: 'none',
            borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: (sending || isRec || (!text.trim() && !file && recState !== 'preview')) ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5,
            opacity: (sending || isRec || (!text.trim() && !file && recState !== 'preview')) ? 0.4 : 1,
            transition: 'opacity .15s', flexShrink: 0,
          }}>
            {sending ? <><Spinner size={12} /> Sending</> : <><Send size={12} /> Send</>}
          </button>
        </div>
      </div>
    </div>
  )
})

const iconBtn = {
  width: 28, height: 28, borderRadius: 7,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', border: '1px solid var(--border2)',
  background: 'var(--bg2)', color: 'var(--text)',
  flexShrink: 0,
  transition: 'all .15s',
  padding: 0,
}

export default ReplyBox
