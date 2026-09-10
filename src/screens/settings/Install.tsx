import { Screen } from '../../components/ios/Screen'
import { Card, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { GritTile, Wordmark } from '../../components/Logo'
import { useNav } from '../../nav/nav'

const STEPS = [
  { icon: 'share' as const, title: 'Tap the Share button', body: 'The square with an arrow, in Safari’s toolbar.' },
  { icon: 'plus' as const, title: 'Choose “Add to Home Screen”', body: 'Scroll down the share sheet if you don’t see it.' },
  { icon: 'check' as const, title: 'Tap Add', body: 'GRIT lands on your Home Screen with its own icon.' },
]

export function Install() {
  const pop = useNav((s) => s.pop)
  const standalone =
    typeof window !== 'undefined'
    && (window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

  return (
    <Screen title="Home Screen" back={{ label: 'Settings', onPress: pop }} largeTitle={false} inlineTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 12 }}>
        <div
          className="gutter"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}
        >
          <GritTile size={82} />
          <Wordmark size={26} align="center" />
        </div>

        {standalone ? (
          <div className="gutter">
            <Card style={{ margin: 0, width: '100%' }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                <Icon name="check.circle.fill" size={24} color="var(--green)" />
                <div>
                  <div className="t-headline">You're already installed</div>
                  <div className="t-footnote dim">GRIT is running from your Home Screen.</div>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <>
            <div className="gutter">
              <div className="t-subhead dim" style={{ lineHeight: '21px', textAlign: 'center' }}>
                Installed, GRIT runs full screen with no browser bar, keeps you logged in between
                sessions, and opens straight to Today.
              </div>
            </div>

            <div>
              <SectionHeader title="Three taps" />
              <Card>
                {STEPS.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', alignItems: 'center' }}>
                    <span
                      style={{
                        width: 34, height: 34, borderRadius: 10, flex: 'none',
                        background: 'var(--accent-soft)', display: 'grid', placeItems: 'center',
                      }}
                    >
                      <Icon name={step.icon} size={18} weight={2.2} color="var(--accent)" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="t-subhead semibold">
                        {i + 1}. {step.title}
                      </div>
                      <div className="t-footnote dim">{step.body}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </>
        )}

        <div className="gutter">
          <Card style={{ margin: 0, width: '100%' }}>
            <div className="t-footnote dim" style={{ lineHeight: '18px' }}>
              GRIT stores everything locally, so installing also means your logs survive a Safari clear
              of browsing history. Export from Data &amp; privacy for a copy you can keep.
            </div>
          </Card>
        </div>
      </div>
    </Screen>
  )
}
