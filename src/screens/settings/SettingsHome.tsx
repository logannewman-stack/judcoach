import { Screen } from '../../components/ios/Screen'
import { ListSection, Row, rowSepInset } from '../../components/ios/List'
import { CoachAvatar, Monogram } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { GritTile, Wordmark } from '../../components/Logo'
import { useStore } from '../../store/useStore'
import { useCoach } from '../../store/coach'
import { byTime, unreadFrom } from '../../domain/coach'
import { authorName } from '../coach/anchor'
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
            the screen it opens.

            A client with no name on file gets the invitation instead of an empty
            headline over an empty monogram — this row is also the clearest route
            back into naming yourself. */}
        <ListSection>
          <Row
            title={<span className="t-title3">{profile.name || 'Set up your profile'}</span>}
            subtitle={profile.name ? profile.goalLabel : 'Name, units and your bodyweight goal'}
            leading={profile.name ? <Monogram name={profile.name} size={54} /> : undefined}
            icon={profile.name ? undefined : 'person'}
            iconColor="var(--accent)"
            sepInset={profile.name ? rowSepInset(54) : undefined}
            chevron
            onPress={() => push('profileSettings')}
            ariaLabel={profile.name ? `Profile, ${profile.name}` : 'Set up your profile'}
            style={{ padding: '13px var(--gutter)' }}
          />
        </ListSection>

        {/* ------------------------------- coach ----------------------------- */}
        {/* Coaching is pink, the way Train is orange: the coach domain owns a
            hue (DESIGN.md §2) and the tab bar already tints itself with it.
            Messages wore the accent, which is the same value as the blue on the
            row below it, so the group came out as one blue block. */}
        <ListSection header="Coaching">
          {/* The other person this app is about, at the size the first cell
              gives the client. A 29pt disc under a 54pt monogram made the coach
              a list item in his own coaching app. */}
          <Row
            title={<span className="t-headline">{COACH.fullName}</span>}
            subtitle={COACH.responseWindow}
            leading={<CoachAvatar size={52} />}
            sepInset={rowSepInset(52)}
            chevron
            onPress={() => push('coach')}
            style={{ padding: '11px var(--gutter)' }}
          />
          <Row
            title="Messages"
            subtitle={
              last
                ? `${authorName(last.author, viewAs, profile.name)}: ${last.body}`
                : `Ask ${COACH.name} anything`
            }
            icon="message"
            iconColor="var(--pink)"
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
            subtitle="Drives every percentage in the block"
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
            iconColor="var(--orange)"
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
            subtitle="Training days, weigh-ins, meals and Jud"
            icon="bell"
            iconColor="var(--red)"
            chevron
            onPress={() => push('notifications')}
          />
          <Row
            title="Data & privacy"
            subtitle="Export, import, reset"
            icon="lock"
            iconColor="var(--green)"
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
          {/* The same destination as Train's Reference row, so the same glyph in
              the same colour — a client learns a row by its tile, and this one
              was purple here and orange there. (Train's subtitle is not copied
              across: at 393pt it already ellipsises where it lives.) */}
          <Row
            title="RPE & RIR chart"
            icon="target"
            iconColor="var(--orange)"
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
