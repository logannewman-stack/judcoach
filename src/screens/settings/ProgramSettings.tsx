import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { CoachNote } from '../../components/Bits'
import { Pill } from '../../components/ios/Controls'
import { Icon } from '../../components/Icon'
import { useStore } from '../../store/useStore'
import { currentWeekIndex, useProgram, weekSchedule } from '../../store/selectors'
import { addDays, formatMediumDate, todayISO } from '../../lib/date'
import { useNav } from '../../nav/nav'

export function ProgramSettings() {
  const pop = useNav((s) => s.pop)
  const push = useNav((s) => s.push)
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const today = todayISO()
  const live = currentWeekIndex(program, today)
  const endDate = addDays(program.startDate, program.weeks.length * 7 - 1)

  return (
    <Screen
      title="Programme"
      back={{ label: 'Settings', onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ margin: '-2px 0 24px' }}>
          <div className="t-headline">{program.name}</div>
          <div className="t-subhead dim" style={{ marginTop: 1 }}>{program.subtitle}</div>
        </div>
      }
    >
      <div className="gutter" style={{ marginBottom: 32 }}>
        <CoachNote>{program.goal}</CoachNote>
      </div>

      <ListSection header="Block">
        <Row title="Coach" value={program.coach} />
        <Row title="Started" value={formatMediumDate(program.startDate)} />
        <Row title="Ends" value={formatMediumDate(endDate)} />
        <Row title="Length" value={`${program.weeks.length} weeks`} />
        <Row title="Days per week" value={String(program.daysPerWeek)} />
      </ListSection>

      {/* Week cards keep their own surface, so this group borrows the list
          section's header, footer and 32px rhythm rather than its container. */}
      <section className="list-section">
        <div className="list-header eyebrow">Every week</div>
        <div className="gutter" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {program.weeks.map((week) => {
            const schedule = weekSchedule(program, week.index, logs)
            const done = schedule.filter((s) => s.log).length
            const isLive = week.index === live
            const isPast = week.index < live
            return (
              <button
                key={week.id}
                type="button"
                className="surface"
                data-current={isLive ? 'true' : undefined}
                onClick={() => push('session', { weekIndex: week.index, sessionId: week.sessions[0]!.id })}
                style={{
                  padding: 13, width: '100%', textAlign: 'left',
                  opacity: isPast && done === 0 ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span className="t-headline" style={{ flex: 1, minWidth: 0 }}>{week.label}</span>
                  {week.deload && <Pill>Deload</Pill>}
                  {isLive && <Pill tone="tinted">Now</Pill>}
                  {done === schedule.length && done > 0 && (
                    <Icon name="check.circle.fill" size={17} color="var(--green)" />
                  )}
                </div>
                <div className="t-footnote dim" style={{ marginTop: 3, lineHeight: '18px' }}>
                  {week.emphasis}
                </div>
                <div className="t-caption1 dim" style={{ marginTop: 6 }}>
                  <span className="data">{done}/{schedule.length}</span> sessions ·{' '}
                  {formatMediumDate(addDays(program.startDate, (week.index - 1) * 7))}
                </div>
              </button>
            )
          })}
        </div>
        <div className="list-footer">
          Blocks are written by Jud, not editable here. If something needs to change — an injury, a
          travel week, a gym that lacks a machine — send it in your check-in and he'll rewrite it.
        </div>
      </section>
    </Screen>
  )
}
