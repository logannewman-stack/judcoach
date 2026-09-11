import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { Icon } from '../../components/Icon'
import { GritTile, Wordmark } from '../../components/Logo'
import { useNav } from '../../nav/nav'

const STEPS = [
  { icon: 'share' as const, title: 'Tap the Share button', body: 'The square with an arrow, in Safari’s toolbar.' },
  { icon: 'plus' as const, title: 'Choose “Add to Home Screen”', body: 'Scroll down the share sheet if you don’t see it.' },
  { icon: 'check' as const, title: 'Tap Add', body: 'GRIT lands on your Home Screen with its own icon.' },
]

const LOCAL_NOTE =
  'GRIT stores everything locally, so installing also means your logs survive a Safari clear of '
  + 'browsing history. Export from Data & privacy for a copy you can keep.'

export function Install() {
  const pop = useNav((s) => s.pop)
  const standalone =
    typeof window !== 'undefined'
    && (window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

  return (
    <Screen title="Home Screen" back={{ onPress: pop }} largeTitle={false} inlineTitle>
      {/* The logo hero is this screen's title treatment, so the bar keeps the
          pinned inline title instead of a large one. */}
      <div
        className="gutter"
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          paddingTop: 10, paddingBottom: 26,
        }}
      >
        <GritTile size={78} />
        <Wordmark size={24} align="center" />
        {!standalone && (
          <div className="t-subhead dim" style={{ lineHeight: '21px' }}>
            Installed, GRIT runs full screen with no browser bar, keeps you logged in between
            sessions, and opens straight to Today.
          </div>
        )}
      </div>

      {standalone ? (
        <ListSection footer={LOCAL_NOTE}>
          <Row
            title="You're already installed"
            subtitle="GRIT is running from your Home Screen."
            icon="check"
            iconColor="var(--green)"
          />
        </ListSection>
      ) : (
        <ListSection header="Three taps" footer={LOCAL_NOTE}>
          <div style={{ padding: '10px var(--gutter) 13px' }}>
            {STEPS.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', alignItems: 'center' }}>
                <span
                  style={{
                    width: 34, height: 34, borderRadius: 'var(--r-chip)', flex: 'none',
                    background: 'var(--accent-soft)', display: 'grid', placeItems: 'center',
                  }}
                >
                  <Icon name={step.icon} size={18} weight={2.2} color="var(--accent)" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="t-subhead semibold">
                    <span className="data" style={{ color: 'var(--label-2)' }}>{i + 1}</span>
                    {'  '}
                    {step.title}
                  </div>
                  <div className="t-footnote dim">{step.body}</div>
                </div>
              </div>
            ))}
          </div>
        </ListSection>
      )}
    </Screen>
  )
}
