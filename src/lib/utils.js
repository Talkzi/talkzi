export function avatarColor(name = '') {
  const colors = ['#5b7fff','#1fd693','#9b72ff','#ff6b6b','#ffb020','#06b6d4','#f472b6','#34d399']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (name.charCodeAt(i) + h * 31) % colors.length
  return colors[Math.abs(h) % colors.length]
}

export function initials(name = '') {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?'
}

export function relativeTime(ts) {
  if (!ts) return ''
  const d = Math.floor((Date.now() - ts * 1000) / 1000)
  if (d < 60)    return 'now'
  if (d < 3600)  return Math.floor(d / 60) + 'm'
  if (d < 86400) return Math.floor(d / 3600) + 'h'
  return Math.floor(d / 86400) + 'd'
}

export function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function clsx(...args) {
  return args.filter(Boolean).join(' ')
}

export function fileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024)       return bytes + ' B'
  if (bytes < 1048576)    return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}
