/* ============================================================================
   Icon set — stroke-first glyphs on a 24×24 grid, sized and weighted to sit
   naturally next to SF Pro text the way SF Symbols do.
   ========================================================================== */

export type IconName =
  | 'home' | 'home.fill' | 'dumbbell' | 'dumbbell.fill' | 'fork' | 'fork.fill'
  | 'scale' | 'scale.fill' | 'gear' | 'gear.fill'
  | 'chevron.right' | 'chevron.left' | 'chevron.down' | 'chevron.up'
  | 'check' | 'check.circle.fill' | 'xmark' | 'xmark.circle.fill'
  | 'plus' | 'minus' | 'play.fill' | 'pause.fill' | 'stop.fill'
  | 'timer' | 'clock' | 'flame.fill' | 'arrow.up' | 'arrow.down'
  | 'ellipsis' | 'info' | 'bell' | 'person' | 'trash' | 'camera'
  | 'drop.fill' | 'bolt.fill' | 'calendar' | 'swap' | 'share' | 'book'
  | 'moon' | 'sun' | 'envelope' | 'ruler' | 'target' | 'chart.bar'
  | 'chart.line' | 'lock' | 'pencil' | 'search' | 'star.fill' | 'seal.fill'
  | 'note' | 'photo' | 'reset' | 'question' | 'heart.fill' | 'list'
  | 'paintbrush' | 'hand.raised' | 'sparkle' | 'arrow.right' | 'video'
  | 'message' | 'message.fill' | 'send.fill'

interface Part {
  d: string
  fill?: boolean
}

/** Build a cog outline procedurally — hand-written gear paths never look even. */
function gear(rOuter: number, rInner: number, teeth = 8): string {
  const cx = 12
  const cy = 12
  const step = (Math.PI * 2) / teeth
  const half = step * 0.19
  const pts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2
    const corners: [number, number][] = [
      [a - half, rOuter],
      [a + half, rOuter],
      [a + half + step * 0.13, rInner],
      [a + step - half - step * 0.13, rInner],
    ]
    for (const [ang, r] of corners) {
      pts.push(`${(cx + Math.cos(ang) * r).toFixed(2)} ${(cy + Math.sin(ang) * r).toFixed(2)}`)
    }
  }
  return `M${pts[0]}L${pts.slice(1).join('L')}Z`
}

const GEAR = gear(9.1, 6.9)

const ICONS: Record<IconName, Part[]> = {
  /* ------------------------------ tab bar ------------------------------- */
  home: [{ d: 'M3.2 10.6 12 3.4l8.8 7.2' }, { d: 'M5.6 9.3V19a1.7 1.7 0 0 0 1.7 1.7h2.9v-5.4h3.6v5.4h2.9A1.7 1.7 0 0 0 18.4 19V9.3' }],
  'home.fill': [{ d: 'M11.02 2.72a1.55 1.55 0 0 1 1.96 0l8.2 6.72a1 1 0 0 1-.63 1.77H20v8a2 2 0 0 1-2 2h-3.4v-5.1a2.6 2.6 0 0 0-5.2 0v5.1H6a2 2 0 0 1-2-2v-8h-.55a1 1 0 0 1-.63-1.77Z', fill: true }],
  dumbbell: [{ d: 'M4 10v4M7.2 7.2v9.6M16.8 7.2v9.6M20 10v4M7.2 12h9.6' }],
  'dumbbell.fill': [
    { d: 'M3 10.6a1.3 1.3 0 0 1 2.6 0v2.8a1.3 1.3 0 0 1-2.6 0ZM18.4 10.6a1.3 1.3 0 0 1 2.6 0v2.8a1.3 1.3 0 0 1-2.6 0Z', fill: true },
    { d: 'M6 8.4a1.6 1.6 0 0 1 3.2 0v7.2a1.6 1.6 0 0 1-3.2 0ZM14.8 8.4a1.6 1.6 0 0 1 3.2 0v7.2a1.6 1.6 0 0 1-3.2 0Z', fill: true },
    { d: 'M8.6 10.9h6.8v2.2H8.6Z', fill: true },
  ],
  fork: [
    { d: 'M6.2 3v4.6a2.6 2.6 0 0 0 5.2 0V3M8.8 10.2V21M6.2 3v4.4M11.4 3v4.4' },
    { d: 'M17.6 3.4c1.7 2.1 2.6 4.8 2.6 7.6h-4.4V5.9c0-1 .6-1.9 1.8-2.5Z' },
    { d: 'M18 11v10' },
  ],
  'fork.fill': [
    { d: 'M5.4 2.6a.9.9 0 0 1 1.8 0v4.2h1.1V2.6a.9.9 0 0 1 1.8 0v4.2h1.1V2.6a.9.9 0 0 1 1.8 0v5a3 3 0 0 1-2.4 2.94v10.3a1.3 1.3 0 0 1-2.6 0V10.54A3 3 0 0 1 5.4 7.6Z', fill: true },
    { d: 'M17.3 2.3c2.1 2.2 3.2 5.4 3.2 8.7a.9.9 0 0 1-.9.9h-1.3v8.9a1.3 1.3 0 0 1-2.6 0V5.6c0-1.3.5-2.4 1.6-3.3Z', fill: true },
  ],
  scale: [
    { d: 'M4.6 4.4h14.8a2 2 0 0 1 2 2v11.2a2 2 0 0 1-2 2H4.6a2 2 0 0 1-2-2V6.4a2 2 0 0 1 2-2Z' },
    { d: 'M5.8 15.6a6.2 6.2 0 0 1 12.4 0' },
    { d: 'M12 15.6 16 10.6' },
  ],
  'scale.fill': [
    { d: 'M4.6 3.4h14.8a3 3 0 0 1 3 3v11.2a3 3 0 0 1-3 3H4.6a3 3 0 0 1-3-3V6.4a3 3 0 0 1 3-3ZM12 8.4a7.2 7.2 0 0 0-7.2 7.2 1 1 0 0 0 2 0 5.2 5.2 0 0 1 7.86-4.48l-3.44 4.3a1 1 0 0 0 1.56 1.25l3.85-4.81A7.18 7.18 0 0 0 12 8.4Z', fill: true },
  ],
  gear: [{ d: GEAR }, { d: 'M12 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z' }],
  'gear.fill': [{ d: `${GEAR}M12 14.9a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8Z`, fill: true }],

  /* ----------------------------- navigation ----------------------------- */
  'chevron.right': [{ d: 'M9.2 4.8 16.4 12l-7.2 7.2' }],
  'chevron.left': [{ d: 'M14.8 4.8 7.6 12l7.2 7.2' }],
  'chevron.down': [{ d: 'M4.8 9.2 12 16.4l7.2-7.2' }],
  'chevron.up': [{ d: 'M4.8 14.8 12 7.6l7.2 7.2' }],
  'arrow.right': [{ d: 'M4 12h15M13 6l6 6-6 6' }],

  /* ------------------------------- actions ------------------------------ */
  check: [{ d: 'M4.6 12.6 9.6 17.6 19.6 6.4' }],
  'check.circle.fill': [{ d: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm4.94 6.52a1.1 1.1 0 0 0-1.56.06l-4.6 5.13-2.13-2.13a1.1 1.1 0 1 0-1.56 1.56l2.95 2.95a1.1 1.1 0 0 0 1.6-.04l5.36-5.98a1.1 1.1 0 0 0-.06-1.55Z', fill: true }],
  xmark: [{ d: 'M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8' }],
  'xmark.circle.fill': [{ d: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm3.4 5.2L12 10.6 8.6 7.2 7.2 8.6l3.4 3.4-3.4 3.4 1.4 1.4 3.4-3.4 3.4 3.4 1.4-1.4-3.4-3.4 3.4-3.4Z', fill: true }],
  plus: [{ d: 'M12 4.8v14.4M4.8 12h14.4' }],
  minus: [{ d: 'M4.8 12h14.4' }],
  'play.fill': [{ d: 'M8.2 5.3a1 1 0 0 1 1.53-.85l9.2 5.85a1 1 0 0 1 0 1.7l-9.2 5.85a1 1 0 0 1-1.53-.85Z', fill: true }],
  'pause.fill': [{ d: 'M7.4 5h2.8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7.4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm6.4 0h2.8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2.8a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z', fill: true }],
  'stop.fill': [{ d: 'M7 6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5Z', fill: true }],
  reset: [{ d: 'M20 5.5v5h-5' }, { d: 'M19.6 10.4A8 8 0 1 0 20 14' }],
  swap: [{ d: 'M4 8.5h13.5M14 5l3.5 3.5L14 12M20 15.5H6.5M10 12l-3.5 3.5L10 19' }],
  share: [{ d: 'M12 3.4v12.2M8 7.4 12 3.4l4 4' }, { d: 'M5.4 12.6V19a1.8 1.8 0 0 0 1.8 1.8h9.6A1.8 1.8 0 0 0 18.6 19v-6.4' }],
  trash: [{ d: 'M4.4 6.6h15.2M9.6 6.6V5.2a1.4 1.4 0 0 1 1.4-1.4h2a1.4 1.4 0 0 1 1.4 1.4v1.4' }, { d: 'M6.4 6.6l.85 12.1a1.7 1.7 0 0 0 1.7 1.6h6.1a1.7 1.7 0 0 0 1.7-1.6l.85-12.1' }, { d: 'M10.4 10.4v6M13.6 10.4v6' }],
  pencil: [{ d: 'M4 20.2l1.1-4.2L16.6 4.5a2.2 2.2 0 0 1 3.1 3.1L8.2 19.1Z' }, { d: 'M15.2 5.9l2.9 2.9' }],
  search: [{ d: 'M11 18.4a7.4 7.4 0 1 0 0-14.8 7.4 7.4 0 0 0 0 14.8ZM16.4 16.4 21 21' }],
  camera: [{ d: 'M4.6 7.8h2.9l1.3-2.2h6.4l1.3 2.2h2.9A1.8 1.8 0 0 1 21.2 9.6v8.2a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8V9.6a1.8 1.8 0 0 1 1.8-1.8Z' }, { d: 'M12 16.8a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z' }],
  photo: [{ d: 'M4.4 4.6h15.2a1.8 1.8 0 0 1 1.8 1.8v11.2a1.8 1.8 0 0 1-1.8 1.8H4.4a1.8 1.8 0 0 1-1.8-1.8V6.4a1.8 1.8 0 0 1 1.8-1.8Z' }, { d: 'M2.8 16.2 8 11.4l4.2 3.8 3.4-2.8 5.6 4.6' }, { d: 'M9 9.4a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0Z' }],
  video: [{ d: 'M3.4 7.4h10.4a1.8 1.8 0 0 1 1.8 1.8v5.6a1.8 1.8 0 0 1-1.8 1.8H3.4a1.8 1.8 0 0 1-1.8-1.8V9.2a1.8 1.8 0 0 1 1.8-1.8Z' }, { d: 'M15.6 12.4l5-3.2v5.6l-5-3.2Z' }],

  /* -------------------------------- state ------------------------------- */
  timer: [{ d: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z' }, { d: 'M12 9.2V13l2.6 1.7' }, { d: 'M9.6 2.8h4.8' }],
  clock: [{ d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' }, { d: 'M12 6.8V12l3.4 2.2' }],
  calendar: [{ d: 'M5 5.4h14a1.8 1.8 0 0 1 1.8 1.8v11.4A1.8 1.8 0 0 1 19 20.4H5a1.8 1.8 0 0 1-1.8-1.8V7.2A1.8 1.8 0 0 1 5 5.4Z' }, { d: 'M3.2 10h17.6M8 3.6v3.4M16 3.6v3.4' }],
  'flame.fill': [{ d: 'M12.6 2.1a.7.7 0 0 0-1.16.42c-.28 2.05-1.2 3.3-2.28 4.6C7.9 8.6 6.5 10.3 6.5 13.3a5.5 5.5 0 0 0 11 0c0-2.36-1-4.1-2.03-5.5-.5.86-1.1 1.4-1.72 1.4-.7 0-1.02-.55-1.02-1.62 0-1.55.4-3.4-.13-5.48Z', fill: true }],
  'bolt.fill': [{ d: 'M13.9 2.2a.55.55 0 0 1 1 .43l-1.2 6.07h4.16a.7.7 0 0 1 .56 1.12l-8.32 12.01a.55.55 0 0 1-1-.43l1.2-6.9H6.14a.7.7 0 0 1-.56-1.12Z', fill: true }],
  'drop.fill': [{ d: 'M12 2.6c-.4 0-.75.2-.96.5C9.5 5.4 5.8 10 5.8 14a6.2 6.2 0 0 0 12.4 0c0-4-3.7-8.6-5.24-10.9a1.16 1.16 0 0 0-.96-.5Z', fill: true }],
  'heart.fill': [{ d: 'M12 20.6C7 17 3.4 13.9 3.4 10.2A4.8 4.8 0 0 1 12 7.3a4.8 4.8 0 0 1 8.6 2.9c0 3.7-3.6 6.8-8.6 10.4Z', fill: true }],
  'star.fill': [{ d: 'M12 2.8l2.86 5.8 6.4.93-4.63 4.51 1.09 6.37L12 17.4l-5.72 3.01 1.09-6.37L2.74 9.53l6.4-.93Z', fill: true }],
  'seal.fill': [{ d: 'M12 1.8l2.42 1.85 3.02-.3 1.16 2.81 2.8 1.16-.3 3.02L23 12l-1.9 2.42.3 3.02-2.8 1.16-1.16 2.81-3.02-.3L12 22.2l-2.42-1.85-3.02.3-1.16-2.81-2.8-1.16.3-3.02L1 12l1.9-2.66-.3-3.02 2.8-1.16 1.16-2.81 3.02.3Zm4.36 6.9a1 1 0 0 0-1.42.06l-3.86 4.3-1.83-1.83a1 1 0 1 0-1.42 1.42l2.58 2.58a1 1 0 0 0 1.45-.04l4.56-5.08a1 1 0 0 0-.06-1.41Z', fill: true }],
  sparkle: [{ d: 'M12 3l1.7 4.6L18.3 9.3 13.7 11 12 15.6 10.3 11 5.7 9.3 10.3 7.6Z' }, { d: 'M18.4 15l.75 2.05L21.2 17.8l-2.05.75L18.4 20.6l-.75-2.05L15.6 17.8l2.05-.75Z' }],

  /* ------------------------------ misc chrome --------------------------- */
  ellipsis: [{ d: 'M6.6 13.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM12 13.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6ZM17.4 13.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z', fill: true }],
  info: [{ d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' }, { d: 'M12 11v5.4M12 7.6v.8' }],
  question: [{ d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' }, { d: 'M9.6 9.4a2.4 2.4 0 1 1 3.2 2.26c-.5.2-.8.68-.8 1.22v.72M12 16.6v.6' }],
  bell: [{ d: 'M17.8 15.2v-4.4a5.8 5.8 0 1 0-11.6 0v4.4L4.6 18h14.8Z' }, { d: 'M9.9 20.2a2.3 2.3 0 0 0 4.2 0' }],
  person: [{ d: 'M12 11.6a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' }, { d: 'M4.6 20.4a7.4 7.4 0 0 1 14.8 0' }],
  envelope: [{ d: 'M4.4 5.4h15.2a1.8 1.8 0 0 1 1.8 1.8v9.6a1.8 1.8 0 0 1-1.8 1.8H4.4a1.8 1.8 0 0 1-1.8-1.8V7.2a1.8 1.8 0 0 1 1.8-1.8Z' }, { d: 'M3 6.6l9 6 9-6' }],
  lock: [{ d: 'M6.6 10.4h10.8a1.6 1.6 0 0 1 1.6 1.6v7a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 19v-7a1.6 1.6 0 0 1 1.6-1.6Z' }, { d: 'M8.4 10.4V7.8a3.6 3.6 0 1 1 7.2 0v2.6' }],
  book: [{ d: 'M4.2 5.6A2.6 2.6 0 0 1 6.8 3h12.4v14.6H6.8a2.6 2.6 0 0 0-2.6 2.6Z' }, { d: 'M4.2 5.6v14.6M19.2 17.6V21H6.8' }],
  note: [{ d: 'M5.4 3.6h13.2a1.8 1.8 0 0 1 1.8 1.8v13.2a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V5.4a1.8 1.8 0 0 1 1.8-1.8Z' }, { d: 'M7.4 8.2h9.2M7.4 12h9.2M7.4 15.8h5.6' }],
  // A rounded speech bubble with a tail at the lower left, so it reads the same
  // way round as the coach's own messages in the thread.
  message: [{ d: 'M12 3.6c-4.9 0-8.8 3.2-8.8 7.2 0 2.3 1.3 4.4 3.4 5.7-.2 1.2-.8 2.4-1.7 3.4 1.7-.2 3.3-.9 4.6-1.9 .8.2 1.7.3 2.5.3 4.9 0 8.8-3.2 8.8-7.5S16.9 3.6 12 3.6Z' }],
  'message.fill': [{ d: 'M12 3.6c-4.9 0-8.8 3.2-8.8 7.2 0 2.3 1.3 4.4 3.4 5.7-.2 1.2-.8 2.4-1.7 3.4 1.7-.2 3.3-.9 4.6-1.9 .8.2 1.7.3 2.5.3 4.9 0 8.8-3.2 8.8-7.5S16.9 3.6 12 3.6Z', fill: true }],
  'send.fill': [{ d: 'M12 4.4 6.1 10.3M12 4.4l5.9 5.9M12 4.4v15.2' }],
  list: [{ d: 'M9 6.4h11.4M9 12h11.4M9 17.6h11.4' }, { d: 'M4.6 7.5a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2ZM4.6 13.1a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2ZM4.6 18.7a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z', fill: true }],
  ruler: [{ d: 'M3.4 8.6h17.2a1.4 1.4 0 0 1 1.4 1.4v4a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 14v-4a1.4 1.4 0 0 1 1.4-1.4Z' }, { d: 'M6.4 8.6v3M10 8.6v4.4M13.6 8.6v3M17.2 8.6v4.4' }],
  target: [{ d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' }, { d: 'M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2Z' }, { d: 'M12 13.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z', fill: true }],
  'chart.bar': [{ d: 'M4.8 20.2V13M12 20.2V5M19.2 20.2v-9.6' }],
  'chart.line': [{ d: 'M3.6 3.6v16.8h16.8' }, { d: 'M7 15.4l3.8-4.2 3 2.8L20 6.6' }, { d: 'M16.2 6.6H20v3.8' }],
  'arrow.up': [{ d: 'M12 19.6V4.8M6 10.8 12 4.8l6 6' }],
  'arrow.down': [{ d: 'M12 4.4v14.8M6 13.2l6 6 6-6' }],
  moon: [{ d: 'M20.4 14.8A8.8 8.8 0 0 1 9.2 3.6a8.8 8.8 0 1 0 11.2 11.2Z' }],
  sun: [{ d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z' }, { d: 'M12 2.4v2M12 19.6v2M2.4 12h2M19.6 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4' }],
  paintbrush: [{ d: 'M14.6 3.8l5.6 5.6-7.4 7.4a3 3 0 0 1-1.5.82l-4.9 1.06 1.06-4.9a3 3 0 0 1 .82-1.5Z' }, { d: 'M5.4 19.2 3.6 21' }],
  'hand.raised': [{ d: 'M9 11V4.6a1.4 1.4 0 1 1 2.8 0V10m0-.6V3.6a1.4 1.4 0 1 1 2.8 0V10m0-.4V5.2a1.4 1.4 0 1 1 2.8 0v7.4c0 4.3-2.3 7.8-6 7.8-2.6 0-4-1.4-5.1-3.6l-2-4a1.4 1.4 0 0 1 2.3-1.6L9 14.2' }],
}

export interface IconProps {
  name: IconName
  size?: number
  /** Stroke weight in the 24-unit grid; ignored by filled glyphs. */
  weight?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

export function Icon({ name, size = 22, weight = 1.8, color = 'currentColor', className, style }: IconProps) {
  const parts = ICONS[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: 'block', flex: 'none', ...style }}
      aria-hidden="true"
      focusable="false"
    >
      {parts.map((p, i) =>
        p.fill ? (
          <path key={i} d={p.d} fill={color} fillRule="evenodd" clipRule="evenodd" />
        ) : (
          <path
            key={i}
            d={p.d}
            stroke={color}
            strokeWidth={weight}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </svg>
  )
}
