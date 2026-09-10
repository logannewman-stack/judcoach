import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Card, CoachAvatar, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Pill } from '../../components/ios/Controls'
import { COACH } from '../../data/seed'
import { useStore } from '../../store/useStore'
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

  return (
    <Screen title="Your coach" back={{ onPress: pop }} largeTitle={false} inlineTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        <div className="gutter" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <CoachAvatar size={64} />
          <div style={{ minWidth: 0 }}>
            <h1 className="t-title1" style={{ letterSpacing: -0.5 }}>{COACH.fullName}</h1>
            <div className="t-subhead dim">{COACH.title}</div>
            <div style={{ marginTop: 6 }}>
              <Pill tone="tinted">{COACH.credentials}</Pill>
            </div>
          </div>
        </div>

        <div className="gutter">
          <Card style={{ margin: 0, width: '100%' }}>
            <div className="t-subhead" style={{ lineHeight: '22px', color: 'var(--label-2)' }}>
              {COACH.bio}
            </div>
          </Card>
        </div>

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

        <div>
          <SectionHeader title="How this works" />
          <Card>
            {[
              { icon: 'calendar' as const, title: 'Jud writes the block', body: 'Eight weeks at a time, built around your training maxes and the days you can actually train.' },
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
          </Card>
        </div>
      </div>
    </Screen>
  )
}
