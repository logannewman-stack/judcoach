import type { ScreenRegistry } from '../nav/Stack'
import { TodayScreen } from './Today'
import { TrainHome } from './train/TrainHome'
import { SessionDetail } from './train/SessionDetail'
import { Runner } from './train/Runner'
import { makePlaceholder } from './Placeholder'

/** Route key → screen. Every `push`/`present` key must appear here. */
export const SCREENS: ScreenRegistry = {
  today: TodayScreen,
  train: TrainHome,
  meals: makePlaceholder('Meals'),
  weigh: makePlaceholder('Weigh-In'),
  settings: makePlaceholder('Settings'),

  session: SessionDetail,
  runner: Runner,

  coach: makePlaceholder('Coach'),
  logDetail: makePlaceholder('Workout'),
  history: makePlaceholder('History'),
  exerciseLibrary: makePlaceholder('Exercises'),
  exerciseDetail: makePlaceholder('Exercise'),
  rpeGuide: makePlaceholder('RPE & RIR'),
  prs: makePlaceholder('Records'),
  trainingMaxes: makePlaceholder('Training Maxes'),
}
