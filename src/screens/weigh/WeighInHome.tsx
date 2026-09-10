import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, EmptyState, StatTile } from '../../components/Bits'
import { Button, Pill, Segmented } from '../../components/ios/Controls'
import { SwipeRow, useSwipeGroup } from '../../components/ios/SwipeRow'
import { ActionSheet } from '../../components/ios/Sheet'
import { NumberPad } from '../../components/NumberPad'
import { LineChart } from '../../components/Charts'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import {
  goalProgress, rateVerdict, rollingSeries, summarizeTrend, weeksToGoal, weighInStreak,
} from '../../domain/weight'
import { addDays, formatMediumDate, formatShortDate, relativeDay, todayISO } from '../../lib/date'
import { fixed, num, signed } from '../../lib/format'
import { useNav } from '../../nav/nav'

type Range = '30' | '90' | 'all'

export function WeighInHome() {
  const today = todayISO()
  const push = useNav((s) => s.push)
  const weighIns = useStore((s) => s.weighIns)
  const profile = useStore((s) => s.profile)
  const saveWeighIn = useStore((s) => s.saveWeighIn)
  const deleteWeighIn = useStore((s) => s.deleteWeighIn)
  const decimals = useStore((s) => s.settings.weightUnitDecimals)

  const [range, setRange] = useState<Range>('90')
  const [logging, setLogging] = useState(false)
  // Tapping a row opens the same actions the swipe reveals, so deleting works
  // for keyboard, Switch Control and VoiceOver — none of which can swipe.
  const [acting, setActing] = useState<string | null>(null)
  const swipe = useSwipeGroup()

  const removeEntry = (date: string) => {
    deleteWeighIn(date)
    toast('Entry deleted', { icon: 'trash', tone: 'bad' })
  }

  const series = useMemo(() => rollingSeries(weighIns, 7), [weighIns])
  const trend = useMemo(() => summarizeTrend(weighIns, 28), [weighIns])
  const streak = weighInStreak(weighIns, today)
  const loggedToday = weighIns.some((w) => w.date === today)

  const cutoff = range === 'all' ? '0000-00-00' : addDays(today, -Number(range))
  const visible = series.filter((p) => p.date >= cutoff)

  const verdict = trend?.reliable ? rateVerdict(trend.perWeek, profile.weeklyRateTarget) : null
  const progress = trend ? goalProgress(profile.startWeight, trend.current, profile.goalWeight) : 0
  const weeksLeft = trend ? weeksToGoal(trend.current, profile.goalWeight, trend.perWeek) : null

  const latest = weighIns[weighIns.length - 1]
  const seedWeight = latest?.weight ?? profile.startWeight

  if (weighIns.length === 0) {
    return (
      <Screen
        title="Weigh-In"
        titleAccessory={
          <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
            <div className="t-subhead dim">{profile.goalLabel}</div>
          </div>
        }
        right={{ icon: 'plus', onPress: () => setLogging(true), ariaLabel: 'Log weigh-in' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <EmptyState
            icon="scale"
            title="No weigh-ins yet"
            message="Step on the scale first thing, after the bathroom, before food or water. Same conditions every day."
            action={<Button small onPress={() => setLogging(true)}>Log your first weigh-in</Button>}
          />
          {/* Measurements, photos and check-ins don't need a weigh-in first —
              they'd be unreachable if the empty state stood alone. */}
          <TrackMoreSection push={push} />
        </div>
        <LogSheet
          open={logging}
          onClose={() => setLogging(false)}
          initial={profile.startWeight}
          units={profile.units}
          onSave={(w) => saveWeighIn({ date: today, weight: w })}
        />
      </Screen>
    )
  }

  return (
    <Screen
      title="Weigh-In"
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim">{profile.goalLabel}</div>
        </div>
      }
      right={{ icon: 'plus', onPress: () => setLogging(true), ariaLabel: 'Log weigh-in' }}
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* -------------------------------- hero ----------------------------- */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="t-footnote dim">7-day average</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 1 }}>
                <span
                  className="mono-nums"
                  style={{ fontSize: 40, lineHeight: '44px', fontWeight: 700, letterSpacing: -1.1 }}
                >
                  {trend ? fixed(trend.current, decimals) : '—'}
                </span>
                <span className="t-title3 dim">{profile.units}</span>
              </div>
              {latest && (
                <div className="t-footnote dim mono-nums" style={{ marginTop: 2 }}>
                  Last scale reading {fixed(latest.weight, decimals)} · {relativeDay(latest.date, today)}
                </div>
              )}
            </div>
            {verdict ? (
              <Pill
                tone={
                  verdict.status === 'on-track' ? 'good'
                  : verdict.status === 'wrong-way' ? 'bad'
                  : 'warn'
                }
              >
                {verdict.label}
              </Pill>
            ) : (
              <Pill>Building trend</Pill>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {trend?.reliable ? (
              <>
                <Pill tone="tinted">{signed(trend.perWeek, 2)} {profile.units}/wk</Pill>
                <Pill>Target {signed(profile.weeklyRateTarget, 1)}/wk</Pill>
                <Pill>{signed(trend.percentPerWeek, 2)}% BW/wk</Pill>
              </>
            ) : (
              <>
                <Pill>Target {signed(profile.weeklyRateTarget, 1)}/wk</Pill>
                <Pill>
                  {trend ? `${trend.entries} of 4 weigh-ins` : 'No weigh-ins'} — a rate needs a week
                </Pill>
              </>
            )}
          </div>

          {/* goal progress */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
              <span className="t-caption1 dim mono-nums">Start {num(profile.startWeight, 0)}</span>
              <span className="t-caption1 dim mono-nums">Goal {num(profile.goalWeight, 0)}</span>
            </div>
            <div className="track" style={{ height: 8 }}>
              <motion.div
                className="track-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: 'spring', stiffness: 110, damping: 20 }}
              />
            </div>
            <div className="t-footnote dim" style={{ marginTop: 7 }}>
              {Math.round(progress * 100)}% of the way there
              {!trend?.reliable
                ? ''
                : weeksLeft != null && weeksLeft > 0
                  ? ` · about ${Math.ceil(weeksLeft)} weeks at this rate`
                  : weeksLeft === 0
                    ? ' · goal reached'
                    : ' · the trend isn’t heading there yet'}
            </div>
          </div>
        </Card>

        {/* ------------------------------- chart ----------------------------- */}
        <div>
          <div className="gutter" style={{ marginBottom: 10 }}>
            <Segmented
              options={[
                { value: '30', label: '1 month' },
                { value: '90', label: '3 months' },
                { value: 'all', label: 'All' },
              ]}
              value={range}
              onChange={(v) => setRange(v as Range)}
            />
          </div>
          <Card>
            <div style={{ display: 'flex', gap: 14, marginBottom: 4 }}>
              <LegendDot color="var(--label-3)" label="Daily" />
              <LegendDot color="var(--accent)" label="7-day average" />
            </div>
            <LineChart
              data={visible.map((p) => ({ x: p.date, y: p.weight }))}
              secondary={visible.map((p) => ({ x: p.date, y: p.avg }))}
              height={190}
              rawAsDots
              color="var(--label-2)"
              secondaryColor="var(--accent)"
              goal={profile.goalWeight > 0 ? { value: profile.goalWeight, label: 'Goal' } : undefined}
              formatValue={(v) => `${fixed(v, decimals)} ${profile.units}`}
              formatLabel={(x) => formatShortDate(x)}
              ariaLabel="Bodyweight trend"
            />
            <div className="t-caption1 dim" style={{ marginTop: 6, textAlign: 'center' }}>
              Drag across the chart to read any day.
            </div>
          </Card>
        </div>

        {/* -------------------------------- stats ---------------------------- */}
        <div className="gutter" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <StatTile
            label="Total change"
            value={trend ? signed(trend.current - profile.startWeight, 1) : '—'}
            caption={`since start`}
            icon={trend && trend.current >= profile.startWeight ? 'arrow.up' : 'arrow.down'}
          />
          <StatTile
            label="Streak"
            value={streak}
            caption={streak === 1 ? 'day' : 'days'}
            icon="flame.fill"
            tone={streak >= 5 ? 'var(--orange)' : undefined}
          />
          <StatTile
            label="Entries"
            value={weighIns.length}
            caption="logged"
            icon="calendar"
          />
        </div>

        {!loggedToday && (
          <div className="gutter">
            <Button icon="plus" onPress={() => setLogging(true)}>
              Log today's weigh-in
            </Button>
          </div>
        )}

        {/* ------------------------------ more ------------------------------- */}
        <TrackMoreSection push={push} />

        {/* ----------------------------- history ----------------------------- */}
        <ListSection
          header="Recent entries"
          footer="Tap an entry for its options, or swipe it left to delete."
          style={{ marginBottom: 0 }}
        >
          {[...weighIns]
            .slice(-14)
            .reverse()
            .map((entry, i, arr) => {
              const prev = arr[i + 1]
              const delta = prev ? entry.weight - prev.weight : 0
              return (
                <SwipeRow
                  key={entry.date}
                  id={entry.date}
                  openId={swipe.openId}
                  onOpenChange={swipe.onOpenChange}
                  actions={[
                    {
                      label: 'Delete',
                      icon: 'trash',
                      destructive: true,
                      onPress: () => removeEntry(entry.date),
                    },
                  ]}
                >
                  <Row
                    title={relativeDay(entry.date, today)}
                    subtitle={formatMediumDate(entry.date)}
                    onPress={() => setActing(entry.date)}
                    value={
                      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                        {prev && (
                          <span
                            className="t-footnote mono-nums"
                            style={{ color: delta > 0 ? 'var(--orange-text)' : delta < 0 ? 'var(--green-text)' : 'var(--label-2)' }}
                          >
                            {signed(delta, 1)}
                          </span>
                        )}
                        <span className="mono-nums" style={{ color: 'var(--label)' }}>
                          {fixed(entry.weight, decimals)} {profile.units}
                        </span>
                      </span>
                    }
                  />
                </SwipeRow>
              )
            })}
        </ListSection>
      </div>

      <ActionSheet
        open={!!acting}
        onClose={() => setActing(null)}
        title={acting ? relativeDay(acting, today) : undefined}
        message={
          acting
            ? `${fixed(weighIns.find((w) => w.date === acting)?.weight ?? 0, decimals)} ${profile.units} · ${formatMediumDate(acting)}`
            : undefined
        }
        items={[
          {
            label: 'Delete entry',
            destructive: true,
            onPress: () => {
              if (acting) removeEntry(acting)
            },
          },
        ]}
      />

      <LogSheet
        open={logging}
        onClose={() => setLogging(false)}
        initial={seedWeight}
        units={profile.units}
        onSave={(w) => {
          saveWeighIn({ date: today, weight: w })
          toast(`${fixed(w, decimals)} ${profile.units} logged`, { icon: 'scale', tone: 'good' })
        }}
      />

    </Screen>
  )
}

/** The rest of the body-tracking tab — reachable with or without a weigh-in. */
function TrackMoreSection({ push }: { push: (key: string) => void }) {
  return (
    <ListSection header="Track more" style={{ marginBottom: 0 }}>
      <Row
        title="Body measurements"
        subtitle="Waist, chest, arms, thighs"
        icon="ruler"
        iconColor="var(--indigo)"
        chevron
        onPress={() => push('measurements')}
      />
      <Row
        title="Progress photos"
        subtitle="Same light, same pose, same time"
        icon="camera"
        iconColor="var(--pink)"
        chevron
        onPress={() => push('photos')}
      />
      <Row
        title="Weekly check-ins"
        subtitle="What Jud reads before adjusting anything"
        icon="note"
        iconColor="var(--green)"
        chevron
        onPress={() => push('checkIns')}
      />
    </ListSection>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span className="t-caption1 dim">{label}</span>
    </span>
  )
}

function LogSheet({
  open, onClose, initial, units, onSave,
}: {
  open: boolean
  onClose: () => void
  initial: number
  units: string
  onSave: (weight: number) => void
}) {
  return (
    <NumberPad
      open={open}
      onClose={onClose}
      onSubmit={onSave}
      title="Today's weight"
      initial={initial}
      unit={units}
      steps={[-1, -0.2, 0.2, 1]}
      hint="First thing, after the bathroom, before food or water."
      submitLabel="Save"
    />
  )
}
