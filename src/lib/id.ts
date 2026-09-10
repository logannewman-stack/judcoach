let counter = 0

/** Short, collision-safe enough for on-device records. */
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 100000
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`
}
