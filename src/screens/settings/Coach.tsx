import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { CoachAvatar } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill, Switch } from '../../components/ios/Controls'
import { COACH } from '../../data/seed'
import { useStore } from '../../store/useStore'
import { useCoach } from '../../store/coach'
import { byTime, unreadFrom } from '../../domain/coach'
import { useProgram, currentWeekIndex } from '../../store/selectors'
import { formatMediumDate, todayISO } from '../../lib/date'
import { useNav } from '../../nav/nav'

export function Coach() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const program = useProgram()
  const checkIns = useStore((s) => s.checkIns)
  const week = currentWeekIndex(program, todayISO())
  const lastCheckIn = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0]
  const notes = useCoach((s) => s.notes)
  const viewAs = useCoach((s) => s.viewAs)
  const setViewAs = useCoach((s) => s.setViewAs)
  const unread = unreadFrom(notes, viewAs).length
  const last = byTime(notes).at(-1)

  return (
    <Screen
      title="Your coach"
      back={{ onPress: pop }}
      titleAccessory={
        <div
          className="gutter"
          style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '6px 0 24px' }}
        >
          <CoachAvatar size={64} />
          <div style={{ minWidth: 0 }}>
            <div className="t-title2">{COACH.fullName}</div>
            <div className="t-subhead dim">{COACH.title}</div>
            <div style={{ marginTop: 6 }}>
              <Pill tone="tinted">{COACH.credentials}</Pill>
            </div>
          </div>
        </div>
      }
    >
      <ListSection>
        <div
          className="t-subhead"
          style={{ lineHeight: '22px', color: 'var(--label-2)', padding: '13px var(--gutter)' }}
        >
          {COACH.bio}
        </div>
      </ListSection>

      <ListSection header="Your programme">
        <Row title="Block" value={program.name} />
        <Row title="Week" value={`${week} of ${program.weeks.length}`} />
        <Row title="Days per week" value={String(program.daysPerWeek)} />
        <Row
          title="Goal"
          subtitle={program.goal}
          onPress={() => push('programSettings')}
          chevron
        />
      </ListSection>

      <ListSection header="Talk to Jud" footer={COACH.responseWindow}>
        <Row
          title="Messages"
          subtitle={
            last
              ? `${last.author === viewAs ? 'You' : COACH.name}: ${last.body}`
              : 'Anything you want to ask, any time'
          }
          icon="message"
          iconColor="var(--accent)"
          trailing={unread > 0 ? <span className="tab-badge" style={{ position: 'static' }}>{unread > 9 ? '9+' : unread}</span> : undefined}
          chevron
          onPress={() => push('messages')}
        />
        <Row
          title="Weekly check-in"
          subtitle={
            lastCheckIn
              ? `Last sent ${formatMediumDate(lastCheckIn.date)}`
              : 'Sunday nights — two minutes, big payoff'
          }
          icon="note"
          iconColor="var(--green)"
          chevron
          onPress={() => push('checkIns')}
        />
        <Row
          title="Email"
          subtitle={COACH.email}
          icon="envelope"
          iconColor="var(--blue)"
          chevron
          onPress={() => {
            window.location.href = `mailto:${COACH.email}?subject=GRIT check-in`
          }}
        />
      </ListSection>

      <ListSection
        header="Demo"
        footer={
          `There is no second device here, so the app swaps seats. Turn this on to `
          + `write as ${COACH.name} on any workout, weigh-in or check-in, then turn it `
          + `off to see what the client sees.`
        }
      >
        <Row
          title={`Reply as ${COACH.name}`}
          icon="person"
          iconColor="var(--purple)"
          trailing={
            <Switch
              checked={viewAs === 'coach'}
              onChange={(on) => setViewAs(on ? 'coach' : 'client')}
              label={`Reply as ${COACH.name}`}
            />
          }
        />
      </ListSection>

      <ListSection header="How this works">
        <div style={{ padding: '10px var(--gutter) 13px' }}>
          {[
            { icon: 'calendar' as const, title: 'Jud writes the block', body: 'Eight weeks at a time, built around your working maxes and the days you can actually train.' },
            { icon: 'dumbbell' as const, title: 'You log what happened', body: 'Load, reps and RPE. The RPE is the part that matters — it tells him what the percentages felt like.' },
            { icon: 'note' as const, title: 'You check in on Sunday', body: 'Weight trend, sleep, energy, adherence, and anything odd.' },
            { icon: 'reset' as const, title: 'He adjusts', body: 'Loads, volume, calories. Nothing changes on a whim — it changes on the data.' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', alignItems: 'flex-start' }}>
              <span
                style={{
                  width: 30, height: 30, borderRadius: 9, flex: 'none',
                  background: 'var(--accent-soft)', display: 'grid', placeItems: 'center',
                }}
              >
                <Icon name={step.icon} size={16} weight={2.1} color="var(--accent)" />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="t-subhead semibold">{step.title}</div>
                <div className="t-footnote dim" style={{ lineHeight: '18px', marginTop: 1 }}>
                  {step.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ListSection>
    </Screen>
  )
}
