import { Screen } from '../../components/ios/Screen'
import { ListSection, Row, rowSepInset } from '../../components/ios/List'
import { CoachAvatar, Monogram } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { GritTile, Wordmark } from '../../components/Logo'
import { useStore } from '../../store/useStore'
import { useCoach } from '../../store/coach'
import { byTime, unreadFrom } from '../../domain/coach'
import { COACH } from '../../data/seed'
import { useProgram, currentWeekIndex } from '../../store/selectors'
import { todayISO } from '../../lib/date'
import { useNav } from '../../nav/nav'
import { APP_VERSION } from '../../version'

export function SettingsHome() {
  const push = useNav((s) => s.push)
  const profile = useStore((s) => s.profile)
  const settings = useStore((s) => s.settings)
  const program = useProgram()
  const week = currentWeekIndex(program, todayISO())
  const notes = useCoach((s) => s.notes)
  const viewAs = useCoach((s) => s.viewAs)
  const unread = unreadFrom(notes, viewAs).length
  const last = byTime(notes).at(-1)

  return (
    <Screen title="Settings">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* ------------------------------ profile ---------------------------- */}
        {/* The Apple ID cell of this app: the client's name at heading size over
            one line saying what they are working on. Anything longer belongs on
            the screen it opens. */}
        <ListSection>
          <Row
            title={<span className="t-title3">{profile.name}</span>}
            subtitle={profile.goalLabel}
            leading={<Monogram name={profile.name} size={54} />}
            sepInset={rowSepInset(54)}
            chevron
            onPress={() => push('profileSettings')}
            ariaLabel={`Profile, ${profile.name}`}
            style={{ padding: '13px var(--gutter)' }}
          />
        </ListSection>

        {/* ------------------------------- coach ----------------------------- */}
        <ListSection header="Coaching">
          <Row
            title={COACH.fullName}
            subtitle={COACH.responseWindow}
            leading={<CoachAvatar size={29} />}
            chevron
            onPress={() => push('coach')}
            inset
          />
          <Row
            title="Messages"
            subtitle={
              last
                ? `${last.author === viewAs ? 'You' : COACH.name}: ${last.body}`
                : `Ask ${COACH.name} anything`
            }
            icon="message"
            iconColor="var(--accent)"
            trailing={
              unread > 0
                ? <span className="tab-badge" style={{ position: 'static' }}>{unread > 9 ? '9+' : unread}</span>
                : undefined
            }
            chevron
            onPress={() => push('messages')}
            inset
          />
          <Row
            title="Programme"
            subtitle={`${program.name} · week ${week} of ${program.weeks.length}`}
            icon="calendar"
            iconColor="var(--indigo)"
            chevron
            onPress={() => push('programSettings')}
          />
          <Row
            title="Working maxes"
            subtitle="What every percentage is calculated from"
            icon="chart.bar"
            iconColor="var(--blue)"
            chevron
            onPress={() => push('trainingMaxes')}
          />
        </ListSection>

        {/* ----------------------------- training ---------------------------- */}
        <ListSection header="Training">
          <Row
            title="Bar & plates"
            subtitle={`${profile.barWeight} ${profile.units} bar · rounds to ${profile.roundingIncrement} ${profile.units}`}
            icon="dumbbell"
            iconColor="var(--gray)"
            chevron
            onPress={() => push('equipment')}
          />
          <Row
            title="Workout preferences"
            subtitle={settings.restTimerAuto ? 'Rest timer starts automatically' : 'Rest timer is manual'}
            icon="timer"
            iconColor="var(--blue)"
            chevron
            onPress={() => push('workoutSettings')}
          />
        </ListSection>

        {/* ------------------------------- app ------------------------------- */}
        <ListSection header="App">
          <Row
            title="Appearance"
            subtitle={
              settings.theme === 'system' ? 'Match iPhone' : settings.theme === 'dark' ? 'Dark' : 'Light'
            }
            icon="paintbrush"
            iconColor="var(--purple)"
            chevron
            onPress={() => push('appearance')}
          />
          <Row
            title="Notifications"
            icon="bell"
            iconColor="var(--gray)"
            chevron
            onPress={() => push('notifications')}
          />
          <Row
            title="Data & privacy"
            subtitle="Export, import, reset"
            icon="lock"
            iconColor="var(--gray)"
            chevron
            onPress={() => push('dataSettings')}
          />
        </ListSection>

        <ListSection header="Reference">
          <Row
            title="Exercise library"
            icon="book"
            iconColor="var(--indigo)"
            chevron
            onPress={() => push('exerciseLibrary')}
          />
          <Row
            title="RPE & RIR chart"
            icon="target"
            iconColor="var(--purple)"
            chevron
            onPress={() => push('rpeGuide')}
          />
          <Row
            title="Add GRIT to your Home Screen"
            subtitle="Share sheet → Add to Home Screen"
            icon="share"
            iconColor="var(--accent)"
            chevron
            onPress={() => push('install')}
          />
        </ListSection>

        {/* ------------------------------ footer ----------------------------- */}
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, padding: '14px 16px 4px',
          }}
        >
          <GritTile size={52} />
          <Wordmark size={20} align="center" />
          <div className="t-caption1 dim" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="lock" size={11} weight={2.2} color="var(--label-3)" />
            Version {APP_VERSION} · everything stored on this device
          </div>
        </div>
      </div>
    </Screen>
  )
}
