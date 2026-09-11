import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Icon } from '../../components/Icon'
import { Button, Segmented, Switch } from '../../components/ios/Controls'
import { Alert, Sheet } from '../../components/ios/Sheet'
import { toast } from '../../components/ios/Toast'
import { describeDropped, validateImport } from '../../store/importState'
import { useStore, exportSnapshot } from '../../store/useStore'
import type { AccentKey, ThemeMode } from '../../domain/types'
import { pluralize } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

/* ------------------------------- appearance ------------------------------ */

/**
 * Three, not six.
 *
 * The accent means one thing in this app — *this is the action* — and it has to
 * keep meaning it next to two other colour systems that were here first: effort
 * runs cool-to-hot from RPE 6 to 10, and green, orange and red say whether you
 * are on target. An app whose accent is green has a green "on target" pill that
 * no longer reads as a verdict, and one whose accent is orange competes with
 * every RPE 9 on the screen. What is left is the cool end, where nothing else
 * lives, so that is what is offered. Older preferences still resolve — the token
 * for every key survives in tokens.css — they are just no longer on the menu.
 */
const ACCENTS: { key: AccentKey; label: string; color: string }[] = [
  { key: 'blue', label: 'GRIT Blue', color: 'var(--accent-blue)' },
  { key: 'indigo', label: 'Indigo', color: 'var(--accent-indigo)' },
  { key: 'purple', label: 'Violet', color: 'var(--accent-purple)' },
]

export function Appearance() {
  const pop = useNav((s) => s.pop)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  return (
    <Screen title="Appearance" back={{ onPress: pop }}>
      <ListSection header="Theme" footer="Match iPhone follows your system appearance, including the automatic day/night schedule.">
        <div style={{ padding: '10px var(--gutter)' }}>
          <Segmented
            options={[
              { value: 'system', label: 'Match iPhone' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={settings.theme}
            onChange={(v) => updateSettings({ theme: v as ThemeMode })}
          />
        </div>
      </ListSection>

      <ListSection
        header="Accent"
        footer="The accent marks the thing to tap. Effort and targets have colour systems of their own, so the choice stops where theirs begin."
      >
        <div
          style={{
            display: 'grid', gridTemplateColumns: `repeat(${ACCENTS.length}, 1fr)`,
            gap: 8, padding: '12px var(--gutter) 14px',
          }}
        >
          {ACCENTS.map((a) => {
            const on = settings.accent === a.key
            return (
              <button
                key={a.key}
                type="button"
                aria-label={a.label}
                aria-pressed={on}
                onClick={() => {
                  haptic('selection')
                  updateSettings({ accent: a.key })
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
                  color: a.color,
                }}
              >
                {/* The size Reminders and Calendar give a colour choice. At the
                    34pt the class ships they were three dots on a page of white
                    paper — the whole screen measured under 2% colour, which is
                    the one thing an appearance screen cannot be. */}
                <span
                  className="swatch"
                  data-on={on}
                  style={{ background: a.color, width: 56, height: 56 }}
                >
                  {on && <Icon name="check" size={24} weight={3} color="#fff" />}
                </span>
                <span className="t-caption1" style={{ color: on ? 'var(--label)' : 'var(--label-2)' }}>
                  {a.label}
                </span>
              </button>
            )
          })}
        </div>
      </ListSection>

      <ListSection
        header="Numbers"
        footer="Decimals decide how your bodyweight is written, wherever GRIT shows it. Logged loads and plate maths keep their own precision — a load rounded to the nearest pound is not one you could put on the bar."
      >
        <Row
          title="Show RIR alongside RPE"
          subtitle="Reps in reserve, the other way of saying the same thing"
          trailing={
            <Switch
              checked={settings.showRir}
              onChange={(v) => updateSettings({ showRir: v })}
              label="Show RIR alongside RPE"
            />
          }
        />
        <Row
          title="Weight decimals"
          trailing={
            <div role="group" aria-label="Weight decimals" style={{ flex: 'none' }}>
              <Segmented
                options={[
                  { value: '0', label: 'Whole' },
                  { value: '1', label: '0.1' },
                ]}
                value={String(settings.weightUnitDecimals)}
                onChange={(v) => updateSettings({ weightUnitDecimals: Number(v) })}
                style={{ width: 132 }}
              />
            </div>
          }
        />
      </ListSection>
    </Screen>
  )
}

/* ---------------------------- workout settings --------------------------- */

export function WorkoutSettings() {
  const pop = useNav((s) => s.pop)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  return (
    <Screen title="Workout" back={{ onPress: pop }}>
      <ListSection header="Rest timer">
        <Row
          title="Start automatically"
          subtitle="Begins the prescribed rest the moment you log a set"
          trailing={
            <Switch
              checked={settings.restTimerAuto}
              onChange={(v) => updateSettings({ restTimerAuto: v })}
              label="Start rest timer automatically"
            />
          }
        />
        <Row
          title="Keep the screen awake"
          subtitle="Stops your phone locking between sets"
          trailing={
            <Switch
              checked={settings.keepAwake}
              onChange={(v) => updateSettings({ keepAwake: v })}
              label="Keep the screen awake"
            />
          }
        />
      </ListSection>

      <ListSection header="During a set" footer="Haptics work on devices that support vibration. On iPhone, Safari doesn't expose it — the animations do the confirming instead.">
        <Row
          title="Plate calculator"
          subtitle="Shows exactly what to load per side"
          trailing={
            <Switch
              checked={settings.showPlateMath}
              onChange={(v) => updateSettings({ showPlateMath: v })}
              label="Show plate calculator"
            />
          }
        />
        <Row
          title="Haptic feedback"
          trailing={
            <Switch
              checked={settings.haptics}
              onChange={(v) => updateSettings({ haptics: v })}
              label="Haptic feedback"
            />
          }
        />
      </ListSection>
    </Screen>
  )
}

/* ------------------------------ notifications ---------------------------- */

export function Notifications() {
  const pop = useNav((s) => s.pop)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const set = (patch: Partial<typeof settings.notifications>) =>
    updateSettings({ notifications: { ...settings.notifications, ...patch } })

  return (
    <Screen title="Notifications" back={{ onPress: pop }}>
      <ListSection
        header="Reminders"
        footer="Add GRIT to your Home Screen for these to fire like a native app's."
      >
        <Row
          title="Workout day"
          subtitle="An hour before your usual training time"
          trailing={
            <Switch
              checked={settings.notifications.workoutReminder}
              onChange={(v) => set({ workoutReminder: v })}
              label="Workout day reminder"
            />
          }
        />
        <Row
          title="Morning weigh-in"
          subtitle="Every day at 7:00"
          trailing={
            <Switch
              checked={settings.notifications.weighInReminder}
              onChange={(v) => set({ weighInReminder: v })}
              label="Weigh-in reminder"
            />
          }
        />
        <Row
          title="Meal windows"
          trailing={
            <Switch
              checked={settings.notifications.mealReminder}
              onChange={(v) => set({ mealReminder: v })}
              label="Meal reminders"
            />
          }
        />
        <Row
          title="Messages from Jud"
          trailing={
            <Switch
              checked={settings.notifications.coachMessages}
              onChange={(v) => set({ coachMessages: v })}
              label="Messages from Jud"
            />
          }
        />
      </ListSection>
    </Screen>
  )
}

/* --------------------------------- data ---------------------------------- */

interface PendingImport {
  /** Held as parsed, not as validated state: the store revalidates on apply. */
  raw: unknown
  name: string
  /** What the file holds once every record too damaged to read was dropped. */
  holds: string
}

/**
 * "63 weigh-ins, 19 workouts and 8 check-ins", skipping everything at zero.
 *
 * `describeDropped` reads almost the same, but it cannot agree a unit with its
 * count — and "1 weigh-ins" is exactly the kind of thing a client reads twice in
 * an alert about erasing their history.
 */
function countOf(parts: [number, string, string?][]): string {
  const said = parts.filter(([n]) => n > 0).map(([n, one, many]) => pluralize(n, one, many))
  if (said.length === 0) return ''
  if (said.length === 1) return said[0]!
  return `${said.slice(0, -1).join(', ')} and ${said.at(-1)}`
}

export function DataSettings() {
  const pop = useNav((s) => s.pop)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const clearAllData = useStore((s) => s.clearAllData)
  const importState = useStore((s) => s.importState)
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null)
  const [exporting, setExporting] = useState(false)
  const [pending, setPending] = useState<PendingImport | null>(null)
  // Rebuilt each time the sheet opens so the copy always matches current data.
  const snapshot = useMemo(() => (exporting ? exportSnapshot() : ''), [exporting])
  // Select primitives, not a fresh object — zustand v5 snapshots must be stable
  // or useSyncExternalStore re-renders forever.
  const weighInCount = useStore((s) => s.weighIns.length)
  const logCount = useStore((s) => s.logs.length)
  const photoCount = useStore((s) => s.photos.length)
  const checkInCount = useStore((s) => s.checkIns.length)

  const saveFile = () => {
    const blob = new Blob([snapshot], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grit-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast('Export saved', { icon: 'share', tone: 'good' })
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(snapshot)
      toast('Copied to clipboard', { icon: 'check.circle.fill', tone: 'good' })
    } catch {
      toast("Couldn't reach the clipboard — save the file instead", { icon: 'info' })
    }
  }

  /**
   * Reading the file is not importing it.
   *
   * An import replaces every weigh-in, workout, check-in, photo and day of food
   * on the device, and it used to run straight off the picker — no confirmation,
   * no undo, while the two *less* destructive buttons below it each ask first.
   * Worse, a file is a GRIT backup as far as `validateImport` is concerned if it
   * merely has a `profile` key, so a truncated export carrying a name and
   * nothing else wiped the lot and reported "Data restored". So the file is
   * validated here, what it actually holds is counted, and the client is shown
   * both halves of the trade before anything is written.
   */
  const doImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const raw = JSON.parse(await file.text())
        const result = validateImport(raw)
        if (!result.ok || !result.state) {
          toast(result.reason ?? "That file isn't a GRIT backup", {
            icon: 'xmark.circle.fill', tone: 'bad',
          })
          return
        }
        const { weighIns, logs, checkIns, measurements, photos, nutrition } = result.state
        setPending({
          raw,
          name: file.name,
          holds: countOf([
            [weighIns.length, 'weigh-in'],
            [logs.length, 'workout'],
            [checkIns.length, 'check-in'],
            [measurements.length, 'tape entry', 'tape entries'],
            [photos.length, 'photo'],
            [Object.keys(nutrition).length, 'day of food', 'days of food'],
          ]),
        })
      } catch {
        toast("Couldn't read that file", { icon: 'xmark.circle.fill', tone: 'bad' })
      }
    }
    input.click()
  }

  /** What an import would be replacing, in the same terms the file is read in. */
  const here = countOf([
    [weighInCount, 'weigh-in'],
    [logCount, 'workout'],
    [checkInCount, 'check-in'],
    [photoCount, 'photo'],
  ])

  const applyImport = () => {
    if (!pending) return
    const result = importState(pending.raw)
    setPending(null)
    if (!result.ok) {
      toast(result.reason ?? "That file isn't a GRIT backup", {
        icon: 'xmark.circle.fill', tone: 'bad',
      })
      return
    }
    const skipped = describeDropped(result.dropped)
    toast(skipped ? `Restored — skipped ${skipped}` : 'Data restored', {
      icon: 'check.circle.fill',
      tone: skipped ? 'default' : 'good',
    })
  }

  return (
    <Screen
      title="Data & privacy"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter t-subhead dim" style={{ margin: '-2px 0 24px', lineHeight: '21px' }}>
          Everything GRIT knows about you lives on this device. No account, no server, no analytics.
          Export it whenever you want a copy — or something to send Jud.
        </div>
      }
    >
      <ListSection header="What's stored here">
        <Row title="Weigh-ins" value={String(weighInCount)} />
        <Row title="Workouts" value={String(logCount)} />
        <Row title="Check-ins" value={String(checkInCount)} />
        <Row title="Progress photos" value={String(photoCount)} />
      </ListSection>

      <ListSection header="Transfer">
        <Row
          title="Export everything"
          subtitle="Save a file or copy it to send Jud"
          icon="share"
          iconColor="var(--blue)"
          onPress={() => setExporting(true)}
          tinted
        />
        <Row
          title="Import a backup"
          subtitle="Replaces what's on this device"
          icon="reset"
          iconColor="var(--indigo)"
          onPress={doImport}
          tinted
        />
      </ListSection>

      <ListSection header="Reset" footer="Neither of these can be undone. Export first if you're unsure.">
        <Row
          title="Reload demo data"
          subtitle="Restores the sample history"
          destructive
          onPress={() => setConfirm('reset')}
        />
        <Row
          title="Delete all my data"
          destructive
          onPress={() => setConfirm('clear')}
        />
      </ListSection>

      {/* Save and Copy, and nothing else. The sheet used to hand the client the
          whole export as raw JSON in a monospace face inside a 999px capsule —
          the one face DESIGN.md §7 bans, in a shape meant for a button, with the
          curve eating the first and last lines. No iOS app asks you to select a
          blob by hand; the two buttons above it already did the job. */}
      <Sheet
        open={exporting}
        onClose={() => setExporting(false)}
        title="Export"
        left={{ label: 'Done', onPress: () => setExporting(false) }}
        detent={0.42}
      >
        <div style={{ padding: '4px 16px 18px' }}>
          <div className="t-subhead dim" style={{ marginBottom: 16, lineHeight: '21px' }}>
            One file holding {weighInCount} weigh-ins, {logCount} workouts, {checkInCount} check-ins
            and {photoCount} photos — {(snapshot.length / 1024).toFixed(0)} KB. It is everything on
            this device, and it is what Import reads back.
          </div>

          <div style={{ display: 'flex', gap: 9 }}>
            <Button variant="filled" icon="share" onPress={saveFile} style={{ flex: 1 }}>
              Save file
            </Button>
            <Button variant="tinted" icon="note" onPress={() => void copyJson()} style={{ flex: 1 }}>
              Copy
            </Button>
          </div>
        </div>
      </Sheet>

      <Alert
        open={pending != null}
        title="Replace everything on this device?"
        message={
          pending && (
            <>
              {pending.name} holds{' '}
              {pending.holds || 'no weigh-ins, workouts, check-ins, photos or days of food at all'}.
              Importing replaces what is here now{here ? ` — ${here}` : ''}, and it cannot be undone.
            </>
          )
        }
        onDismiss={() => setPending(null)}
        actions={[
          { label: 'Cancel', onPress: () => setPending(null) },
          { label: 'Replace', destructive: true, onPress: applyImport },
        ]}
      />

      <Alert
        open={confirm === 'reset'}
        title="Reload demo data?"
        message="Your current weigh-ins, workouts, photos and check-ins will be replaced with the sample set."
        onDismiss={() => setConfirm(null)}
        actions={[
          { label: 'Cancel', onPress: () => setConfirm(null) },
          {
            label: 'Reload',
            destructive: true,
            onPress: () => {
              resetToSeed()
              setConfirm(null)
              toast('Demo data reloaded', { icon: 'reset' })
            },
          },
        ]}
      />

      <Alert
        open={confirm === 'clear'}
        title="Delete all data?"
        message="Every weigh-in, workout, photo and check-in on this device will be erased, and your profile goes back to blank. Your units, bar and plate rack stay."
        onDismiss={() => setConfirm(null)}
        actions={[
          { label: 'Cancel', onPress: () => setConfirm(null) },
          {
            label: 'Delete everything',
            destructive: true,
            onPress: () => {
              clearAllData()
              setConfirm(null)
              toast('All data deleted', { icon: 'trash', tone: 'bad' })
            },
          },
        ]}
      />
    </Screen>
  )
}
