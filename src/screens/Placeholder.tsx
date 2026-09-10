import { Screen } from '../components/ios/Screen'
import { EmptyState } from '../components/Bits'

export function makePlaceholder(title: string) {
  return function Placeholder() {
    return (
      <Screen title={title}>
        <EmptyState icon="sparkle" title={`${title} — coming next`} />
      </Screen>
    )
  }
}
