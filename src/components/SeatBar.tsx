import { AnimatePresence, motion } from 'framer-motion'
import { useCoach } from '../store/coach'
import { useNav } from '../nav/nav'
import { useStore } from '../store/useStore'
import { otherParty } from '../screens/coach/anchor'
import { COACH } from '../data/seed'

/* ============================================================================
   There is no second device in a demo, so the app switches seats instead.

   While it is in Jud's, this sits above everything and pushes the app down, the
   way iOS shows an active call — a floating pill would end up over whatever the
   screen underneath had pinned to its own bottom, and could be missed. Nobody
   should ever be unsure whose name is about to go on a message.
   ========================================================================== */

export function SeatBar() {
  const viewAs = useCoach((s) => s.viewAs)
  const setViewAs = useCoach((s) => s.setViewAs)
  const client = useStore((s) => s.profile.name)
  const switchTab = useNav((s) => s.switchTab)
  const popToRoot = useNav((s) => s.popToRoot)
  // The same name the thread, the notes and the Settings previews use, so the
  // seat bar cannot be the one place a nameless client is called something else.
  const first = otherParty('coach', client).short

  return (
    <AnimatePresence initial={false}>
      {viewAs === 'coach' && (
        <motion.div
          className="seat-bar"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          role="status"
        >
          <div className="seat-bar-inner">
            <span className="truncate">
              You are {COACH.name}, looking at {first}&rsquo;s app
            </span>
            <button
              type="button"
              className="seat-bar-exit"
              onClick={() => {
                setViewAs('client')
                // You are a different person now; start where they start,
                // rather than part-way into a screen Jud had opened.
                popToRoot()
                switchTab('today')
              }}
            >
              Done
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
