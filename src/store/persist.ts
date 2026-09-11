import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware'

/* ============================================================================
   Storage for the app's persisted state.

   Three things the default synchronous localStorage adapter gets wrong for an
   app this shape:

   1. It re-serialises the entire database on every single action. Measured at
      155 ms per tap once a client has twenty progress photos — paid on every
      logged set, every water tap, every keystroke while typing a name.
   2. A quota error escapes the store's own setState, so the exception lands in
      whatever component dispatched it. Mid-workout that means the set is not
      saved, the rest timer never starts, and a reload loses the session.
   3. Photos are base64 blobs that dwarf everything else, so they should not
      share the hot path with a two-byte water counter.
   ========================================================================== */

const WRITE_DELAY_MS = 400

export const PHOTO_KEY = 'grit-photos-v1'

export type StorageProblem = 'quota' | 'unavailable'

let onProblem: ((problem: StorageProblem) => void) | null = null

/** Lets the UI tell the client their device stopped accepting new data. */
export function onStorageProblem(handler: (problem: StorageProblem) => void) {
  onProblem = handler
}

/* Everything with a pending write registers here once. iOS Safari gives no
   warning before it freezes or evicts a backgrounded tab, and `pagehide` is the
   last event it reliably fires, so that is where debounced writes land. */
const flushers: Array<() => void> = []
let listening = false

function onFlush(flush: () => void) {
  flushers.push(flush)
  if (listening || typeof window === 'undefined') return
  listening = true
  const flushAll = () => { for (const f of flushers) f() }
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
}

function write(name: string, value: string): boolean {
  try {
    localStorage.setItem(name, value)
    return true
  } catch (error) {
    const quota =
      error instanceof DOMException
      && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    onProblem?.(quota ? 'quota' : 'unavailable')
    return false
  }
}

/* Every writer registers here so a write arriving from another tab can cancel
   whatever this one still has queued for the same key. */
const droppers: Array<(name: string) => void> = []

/**
 * One debounced writer: the newest value per key is held, coalesced inside a
 * short window, and turned into text only when it is actually written.
 */
function createWriter<V>(delay: number, serialise: (value: V) => string) {
  const pending = new Map<string, V>()
  let timer: number | undefined
  droppers.push((name) => pending.delete(name))

  const flush = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = undefined
    }
    for (const [name, value] of pending) {
      let text: string
      try {
        text = serialise(value)
      } catch {
        // Nothing can be done with a value that will not serialise, and
        // throwing here would land in a timer callback or in `pagehide`.
        onProblem?.('unavailable')
        continue
      }
      write(name, text)
    }
    pending.clear()
  }

  onFlush(flush)

  return {
    peek: (name: string) => pending.get(name),
    has: (name: string) => pending.has(name),
    queue: (name: string, value: V) => {
      pending.set(name, value)
      if (timer == null) timer = window.setTimeout(flush, delay)
    },
    drop: (name: string) => pending.delete(name),
  }
}

/**
 * Debounced, failure-tolerant storage. Writes coalesce inside a short window
 * and are flushed synchronously when the page is hidden, so nothing is lost to
 * a backgrounded tab or a phone going to sleep between sets.
 */
export function createResilientStorage(): StateStorage {
  const writer = createWriter<string>(WRITE_DELAY_MS, (value) => value)
  return {
    getItem: (name) => {
      // A read must see writes that haven't been flushed yet.
      if (writer.has(name)) return writer.peek(name)!
      try {
        return localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name, value) => writer.queue(name, value),
    removeItem: (name) => {
      writer.drop(name)
      try {
        localStorage.removeItem(name)
      } catch {
        /* nothing useful to do */
      }
    },
  }
}

/**
 * The same debounce, one step earlier: it holds the state object rather than a
 * string, so `JSON.stringify` runs once per flush instead of once per action.
 *
 * Going through zustand's own `createJSONStorage` debounced only the write.
 * Measured on the sample client's 66 kB blob: six sets logged in a burst cost
 * seven serialisations and 469 kB of string building for one 66 kB write, and
 * ten keystrokes in the name field cost ten. The state is immutable, so holding
 * the newest snapshot until the flush writes exactly what the last call asked
 * for.
 */
export function createResilientJSONStorage<S>(): PersistStorage<S> {
  const writer = createWriter<StorageValue<S>>(WRITE_DELAY_MS, (value) => JSON.stringify(value))
  return {
    getItem: (name) => {
      if (writer.has(name)) return writer.peek(name)!
      try {
        const raw = localStorage.getItem(name)
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null
      } catch {
        // A blob that will not parse is no blob: rehydrate from the defaults
        // rather than throwing out of the store's own constructor.
        return null
      }
    },
    setItem: (name, value) => writer.queue(name, value),
    removeItem: (name) => {
      writer.drop(name)
      try {
        localStorage.removeItem(name)
      } catch {
        /* nothing useful to do */
      }
    },
  }
}

/* ------------------------------ other tabs -------------------------------- */

/**
 * Adopt a snapshot another tab has just written.
 *
 * A tab persists its whole memory to one key and only ever read that key once,
 * at hydration — so the second tab to touch anything wrote its own stale picture
 * of the database over the first tab's, all of it, with no merge and no notice.
 * Three sets logged in one tab died to a weigh-in saved in another, and reversing
 * the order lost the weigh-in instead.
 *
 * `storage` fires only in the tabs that did not write, which makes it exactly the
 * signal to re-read on: each tab follows the other, so the next thing either of
 * them writes is composed on top of what the other did rather than instead of it.
 */
export function onForeignWrite(name: string, adopt: () => void) {
  if (typeof window === 'undefined') return
  window.addEventListener('storage', (event) => {
    // A null key is `localStorage.clear()` and a null value is the key being
    // removed; neither carries a snapshot worth adopting.
    if (event.key !== name || event.newValue == null) return
    // Anything still queued here was composed before the snapshot that just
    // landed, so letting it flush would put the stale picture straight back.
    for (const drop of droppers) drop(name)
    adopt()
  })
}

/* ------------------------------- photo store ----------------------------- */

/** Photos live in their own key so a base64 blob never rides the hot path. */
export function readPhotos<T>(): T[] {
  try {
    const raw = localStorage.getItem(PHOTO_KEY)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export function writePhotos<T>(photos: T[]): boolean {
  if (photos.length === 0) {
    try {
      localStorage.removeItem(PHOTO_KEY)
    } catch {
      /* ignore */
    }
    return true
  }
  return write(PHOTO_KEY, JSON.stringify(photos))
}

const PHOTO_DELAY_MS = 900

let photoPending: unknown[] | null = null
let photoTimer: number | undefined

function flushPhotos() {
  if (photoTimer != null) {
    clearTimeout(photoTimer)
    photoTimer = undefined
  }
  if (photoPending) {
    writePhotos(photoPending)
    photoPending = null
  }
}

/**
 * Queue a photo-library write. Debounced longer than state because the payload
 * is megabytes of base64 and a client adding three photos in a row should pay
 * for one serialisation, not three.
 */
export function schedulePhotoWrite<T>(photos: T[]) {
  if (photoPending == null && photoTimer == null) onFlush(flushPhotos)
  photoPending = photos as unknown[]
  if (photoTimer == null) photoTimer = window.setTimeout(flushPhotos, PHOTO_DELAY_MS)
}

/* -------------------------------- merging -------------------------------- */

/**
 * Merge persisted state over the defaults one level into `profile`, `settings`
 * and `settings.notifications`.
 *
 * zustand's default merge is a top-level spread, so a persisted `profile`
 * replaces the default outright. Any field added after a client's first launch
 * then rehydrates as `undefined` — a missing `roundingIncrement` turned every
 * target weight in the runner into "—" and every plate readout into "Empty
 * bar".
 */
export function mergePersisted<T extends object>(persisted: unknown, current: T): T {
  if (!persisted || typeof persisted !== 'object') return current
  const base0 = current as Record<string, unknown>
  const incoming = persisted as Record<string, unknown>
  const merged: Record<string, unknown> = { ...base0, ...incoming }

  for (const key of ['profile', 'settings'] as const) {
    const base = base0[key]
    const next = incoming[key]
    if (base && typeof base === 'object' && next && typeof next === 'object') {
      merged[key] = { ...(base as object), ...(next as object) }
    }
  }

  const baseSettings = base0.settings as { notifications?: object } | undefined
  const nextSettings = merged.settings as { notifications?: object } | undefined
  if (baseSettings?.notifications && nextSettings) {
    nextSettings.notifications = {
      ...baseSettings.notifications,
      ...(nextSettings.notifications ?? {}),
    }
  }

  return merged as T
}
