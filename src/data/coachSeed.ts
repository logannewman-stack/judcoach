import type { CheckIn, WeighIn, WorkoutLog } from '../domain/types'
import type { CoachNote } from '../domain/coach'
import { bestE1RM, topSet } from '../domain/strength'
import { summarizeTrend } from '../domain/weight'

/* ============================================================================
   The demo conversation.

   Built from whatever the sample client actually logged rather than written out
   flat, so Jud's messages quote real numbers and the cards under them open the
   real sessions. A thread of invented weights next to a history that says
   something else is the fastest way to make a demo feel fake.
   ========================================================================== */

/**
 * A seeded timestamp, never in the future.
 *
 * The conversation is written against clock times a coach would plausibly send
 * at — 07:05, 20:10 — but the demo can be opened at any hour, and a message
 * dated seven hours from now sorts after the reply to it and reads as a fault.
 * Anything that would land ahead of the present is pulled back just behind it,
 * keeping the order the script intends.
 */
let lastClamped = 0
const at = (date: string, time: string) => {
  const wanted = new Date(`${date}T${time}:00`)
  const now = Date.now()
  if (wanted.getTime() <= now) return `${date}T${time}:00.000`
  // Each clamped message lands a minute after the one before it, so a run of
  // them keeps its sequence instead of collapsing onto one instant.
  lastClamped += 1
  return new Date(now - 120_000 + lastClamped * 1000).toISOString()
}
const id = (n: number) => `note-seed-${n}`

/** The heaviest working set in a log, for Jud to quote back. */
function headline(log: WorkoutLog): { name: string; weight: number; reps: number } | null {
  let best: { name: string; weight: number; reps: number } | null = null
  for (const entry of log.exercises) {
    const set = topSet(entry.sets)
    if (!set) continue
    if (!best || set.weight > best.weight) {
      best = { name: entry.exerciseId, weight: set.weight, reps: set.reps }
    }
  }
  return best
}

export function seedCoachThread(
  logs: WorkoutLog[],
  weighIns: WeighIn[],
  checkIns: CheckIn[],
  today: string,
): CoachNote[] {
  const notes: CoachNote[] = []
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  const lastCheckIn = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0]
  const trend = summarizeTrend(weighIns)
  let n = 0

  const push = (note: Omit<CoachNote, 'id'>) => notes.push({ id: id(n++), ...note })

  /* --- an opener, far enough back that it reads as an existing relationship - */
  const opener = recent.at(-1)?.date ?? today
  push({
    anchor: { kind: 'thread' },
    author: 'coach',
    body:
      'Block 3 is live. Percentages set the floor and RPE sets the ceiling — if the '
      + 'bar says 8 and it felt like 9, log the 9. I would rather have the truth than a tidy sheet.',
    sentAt: at(opener, '08:12'),
    readAt: at(opener, '08:40'),
  })
  push({
    anchor: { kind: 'thread' },
    author: 'client',
    body: 'Got it. Deadlifts still the priority?',
    sentAt: at(opener, '08:44'),
  })
  push({
    anchor: { kind: 'thread' },
    author: 'coach',
    body: 'Deadlift and bench. Everything else is there to hold those two up.',
    sentAt: at(opener, '09:02'),
    readAt: at(opener, '09:15'),
  })

  /* --- a note on the heaviest recent session ------------------------------ */
  const heavy = recent.find((log) => headline(log) != null)
  if (heavy) {
    const top = headline(heavy)!
    const e1rm = Math.max(...heavy.exercises.map((e) => bestE1RM(e.sets)), 0)
    push({
      anchor: { kind: 'workout', id: heavy.id },
      author: 'coach',
      body:
        `${top.weight} for ${top.reps} moved better than the RPE you gave it. Next time you `
        + 'see that number, take one more rep before you rack it — you had it.',
      sentAt: at(heavy.date, '20:10'),
      readAt: at(heavy.date, '21:02'),
      highlight: e1rm > 0 ? { label: 'Estimated max', value: `${Math.round(e1rm)} lb` } : undefined,
    })
    push({
      anchor: { kind: 'workout', id: heavy.id },
      author: 'client',
      body: 'Felt heavier than it looked. Grip was going by the last set.',
      sentAt: at(heavy.date, '21:04'),
    })
    push({
      anchor: { kind: 'workout', id: heavy.id },
      author: 'coach',
      body: 'Then straps on the back-offs and save the grip for the top set. Not a weakness, a budget.',
      sentAt: at(heavy.date, '21:20'),
    })
  }

  /* --- a note on the weight trend ----------------------------------------- */
  const anchorWeighIn = weighIns.find((w) => w.date < today)
  if (anchorWeighIn) {
    const rate = trend ? `${trend.perWeek > 0 ? '+' : ''}${trend.perWeek.toFixed(2)} lb/wk` : null
    push({
      anchor: { kind: 'weighIn', id: anchorWeighIn.date },
      author: 'coach',
      body:
        'Ignore the daily number, it is mostly salt and sleep. The seven-day line is what I read, '
        + `and yours is doing exactly what it should${rate ? ` at ${rate}` : ''}. Nothing changes this week.`,
      sentAt: at(anchorWeighIn.date, '07:30'),
      highlight: rate ? { label: 'Trend', value: rate } : undefined,
    })
  }

  /* --- every check-in Jud has already answered ---------------------------- */
  // The replies were already written on the check-ins themselves; they become
  // notes so there is one conversation rather than two half-conversations.
  for (const entry of [...checkIns].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!entry.coachReply) continue
    push({
      anchor: { kind: 'checkIn', id: entry.id },
      author: 'coach',
      body: entry.coachReply,
      sentAt: at(entry.date, '19:45'),
      readAt: entry.id === lastCheckIn?.id ? undefined : at(entry.date, '21:00'),
    })
  }

  /* --- and something waiting for them ------------------------------------- */
  const latest = recent[0]
  if (latest) {
    push({
      anchor: { kind: 'workout', id: latest.id },
      author: 'coach',
      body:
        'Watched the tempo on your back-offs — you are dropping the bar the second the rep is in. '
        + 'Own the eccentric for three seconds and the same weight will do twice the work.',
      sentAt: at(latest.date, '18:05'),
    })
  }
  push({
    anchor: { kind: 'thread' },
    author: 'coach',
    body: 'Send me a set from the side this week. Deadlift, top set, phone on the floor.',
    sentAt: at(today, '07:05'),
  })

  return notes
}
