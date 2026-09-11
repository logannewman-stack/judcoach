import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { currentWeekIndex, useProgram, weekSchedule } from '../../store/selectors'

/* ============================================================================
   Is a given date a training day or a rest day?

   Both the meals list and a single meal need the answer, and they need the same
   answer: the food rows are the instruction a client follows, so a screen that
   thinks it is a training day serves 200 g of rice against a rest-day target.

   The client's own choice lives in the app's store, keyed by date, so it
   survives a reload and is cleared by the same wipe that clears everything
   else. It was once held in a second store of its own, with no persistence and
   nothing to clear it: tapping "Rest day", eating to the rest-day plan and
   reloading gave the day back as a training day with the rest-day ticks still
   on it, counted against 330 kcal more than the client had been served.
   ========================================================================== */

export type DayMode = 'training' | 'rest'

/** The mode in force for `date`: the client's own choice, else the programme's. */
export function useDayMode(date: string): DayMode {
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const override = useStore((s) => s.dayModes[date])

  const scheduled = useMemo(() => {
    const week = currentWeekIndex(program, date)
    return weekSchedule(program, week, logs).some((entry) => entry.date === date)
  }, [program, logs, date])

  return override ?? (scheduled ? 'training' : 'rest')
}

/** Record a client's own choice for one day. It never carries to the next. */
export function useSetDayMode(): (date: string, mode: DayMode) => void {
  return useStore((s) => s.setDayMode)
}
