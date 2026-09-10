import { useMemo } from 'react'
import { create } from 'zustand'
import { useStore } from '../../store/useStore'
import { currentWeekIndex, useProgram, weekSchedule } from '../../store/selectors'

/* ============================================================================
   Is a given date a training day or a rest day?

   Both the meals list and a single meal need the answer, and they need the same
   answer: the food rows are the instruction a client follows, so a screen that
   thinks it is a training day serves 200 g of rice against a rest-day target.
   ========================================================================== */

export type DayMode = 'training' | 'rest'

interface Overrides {
  /* Keyed by date: a manual choice belongs to the day it was made on and must
     never carry to the next day the client looks at. */
  byDate: Record<string, DayMode>
  set: (date: string, mode: DayMode) => void
}

export const useDayOverrides = create<Overrides>((set) => ({
  byDate: {},
  set: (date, mode) => set((s) => ({ byDate: { ...s.byDate, [date]: mode } })),
}))

/** The mode in force for `date`: the client's own choice, else the programme's. */
export function useDayMode(date: string): DayMode {
  const program = useProgram()
  const logs = useStore((s) => s.logs)
  const override = useDayOverrides((s) => s.byDate[date])

  const scheduled = useMemo(() => {
    const week = currentWeekIndex(program, date)
    return weekSchedule(program, week, logs).some((entry) => entry.date === date)
  }, [program, logs, date])

  return override ?? (scheduled ? 'training' : 'rest')
}
