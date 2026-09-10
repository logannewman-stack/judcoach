import { useMemo, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Icon } from '../../components/Icon'
import { Button, Segmented, Switch } from '../../components/ios/Controls'
import { Alert, Sheet } from '../../components/ios/Sheet'
import { toast } from '../../components/ios/Toast'
import { GritTile } from '../../components/Logo'
import { describeDropped } from '../../store/importState'
import { useStore, exportSnapshot } from '../../store/useStore'
import type { AccentKey, ThemeMode } from '../../domain/types'
import { haptic } from '../../lib/haptics'
import { useNav } from '../../nav/nav'

/* ------------------------------- appearance ------------------------------ */

const ACCENTS: { key: AccentKey; label: string; color: string }[] = [
  { key: 'blue', label: 'Blue', color: 'var(--accent-blue)' },
  { key: 'indigo', label: 'Indigo', color: 'var(--accent-indigo)' },
  { key: 'green', label: 'Green', color: 'var(--accent-green)' },
  { key: 'orange', label: 'Orange', color: 'var(--accent-orange)' },
  { key: 'pink', label: 'Pink', color: 'var(--accent-pink)' },
  { key: 'purple', label: 'Purple', color: 'var(--accent-purple)' },
]

export function Appearance() {
  const pop = useNav((s) => s.pop)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  return (
    <Screen title="Appearance" back={{ label: 'Settings', onPress: pop }}>
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

      <ListSection header="Accent colour">
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10,
            padding: '13px var(--gutter)',
          }}
        >
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-label={a.label}
              aria-pressed={settings.accent === a.key}
              onClick={() => {
                haptic('selection')
                updateSettings({ accent: a.key })
              }}
              style={{
                aspectRatio: '1', borderRadius: '50%', background: a.color,
                display: 'grid', placeItems: 'center',
                boxShadow: settings.accent === a.key ? '0 0 0 2.5px var(--grouped-2), 0 0 0 4.5px currentColor' : 'none',
                color: a.color,
              }}
            >
              {settings.accent === a.key && <Icon name="check" size={16} weight={3} color="#fff" />}
            </button>
          ))}
        </div>
      </ListSection>

      <ListSection
        header="Numbers"
        footer="Decimals decide how every weight is written — logs, plate maths and weigh-ins."
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
    <Screen title="Workout" back={{ label: 'Settings', onPress: pop }}>
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
    <Screen title="Notifications" back={{ label: 'Settings', onPress: pop }}>
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

export function DataSettings() {
  const pop = useNav((s) => s.pop)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const clearAllData = useStore((s) => s.clearAllData)
  const importState = useStore((s) => s.importState)
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null)
  const [exporting, setExporting] = useState(false)
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
      toast('Select the text below and copy it', { icon: 'info' })
    }
  }

  const doImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const result = importState(JSON.parse(await file.text()))
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
      } catch {
        toast("Couldn't read that file", { icon: 'xmark.circle.fill', tone: 'bad' })
      }
    }
    input.click()
  }

  return (
    <Screen
      title="Data & privacy"
      back={{ label: 'Settings', onPress: pop }}
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

      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
        <GritTile size={44} />
      </div>

      <Sheet
        open={exporting}
        onClose={() => setExporting(false)}
        title="Export"
        left={{ label: 'Done', onPress: () => setExporting(false) }}
        detent={0.82}
      >
        <div style={{ padding: '4px 16px 16px' }}>
          <div className="t-footnote dim" style={{ marginBottom: 14 }}>
            {weighInCount} weigh-ins, {logCount} workouts, {checkInCount} check-ins and{' '}
            {photoCount} photos — {(snapshot.length / 1024).toFixed(0)} KB of JSON.
          </div>

          <div style={{ display: 'flex', gap: 9 }}>
            <Button variant="filled" icon="share" onPress={saveFile} style={{ flex: 1 }}>
              Save file
            </Button>
            <Button variant="tinted" icon="note" onPress={() => void copyJson()} style={{ flex: 1 }}>
              Copy
            </Button>
          </div>

          <div className="t-caption1 dim semibold" style={{ margin: '18px 0 7px' }}>
            OR SELECT AND COPY IT YOURSELF
          </div>
          <textarea
            readOnly
            value={snapshot}
            rows={9}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Export data"
            style={{
              width: '100%', padding: '11px 13px', borderRadius: 12, border: 'none',
              background: 'var(--fill-3)', resize: 'none', lineHeight: '18px',
              fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />
        </div>
      </Sheet>

      <Alert
        open={confirm === 'reset'}
        title="Reload demo data?"
        message="Your current weigh-ins, workouts and check-ins will be replaced with the sample set."
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
        message="Every weigh-in, workout, photo and check-in on this device will be erased."
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
