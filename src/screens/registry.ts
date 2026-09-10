import type { ScreenRegistry } from '../nav/Stack'

import { TodayScreen } from './Today'

import { TrainHome } from './train/TrainHome'
import { SessionDetail } from './train/SessionDetail'
import { Runner } from './train/Runner'
import { RpeGuide } from './train/RpeGuide'
import { ExerciseLibrary, ExerciseDetail } from './train/Library'
import { History, LogDetail, PersonalRecordsScreen } from './train/History'

import { MealsHome } from './meals/MealsHome'
import { MealDetail } from './meals/MealDetail'
import { Grocery } from './meals/Grocery'
import { Guidelines } from './meals/Guidelines'

import { WeighInHome } from './weigh/WeighInHome'
import { Measurements } from './weigh/Measurements'
import { Photos } from './weigh/Photos'
import { CheckIns } from './weigh/CheckIns'

import { SettingsHome } from './settings/SettingsHome'
import { ProfileSettings } from './settings/ProfileSettings'
import { TrainingMaxes } from './settings/TrainingMaxes'
import { Equipment } from './settings/Equipment'
import { Appearance, WorkoutSettings, Notifications, DataSettings } from './settings/Preferences'
import { Coach } from './settings/Coach'
import { ProgramSettings } from './settings/ProgramSettings'
import { Install } from './settings/Install'

/** Route key → screen. Every `push`/`present` key must appear here. */
export const SCREENS: ScreenRegistry = {
  // tab roots
  today: TodayScreen,
  train: TrainHome,
  meals: MealsHome,
  weigh: WeighInHome,
  settings: SettingsHome,

  // training
  session: SessionDetail,
  runner: Runner,
  history: History,
  logDetail: LogDetail,
  exerciseLibrary: ExerciseLibrary,
  exerciseDetail: ExerciseDetail,
  rpeGuide: RpeGuide,
  prs: PersonalRecordsScreen,

  // nutrition
  mealDetail: MealDetail,
  grocery: Grocery,
  guidelines: Guidelines,

  // body
  measurements: Measurements,
  photos: Photos,
  checkIns: CheckIns,

  // settings
  profileSettings: ProfileSettings,
  trainingMaxes: TrainingMaxes,
  equipment: Equipment,
  appearance: Appearance,
  workoutSettings: WorkoutSettings,
  notifications: Notifications,
  dataSettings: DataSettings,
  coach: Coach,
  programSettings: ProgramSettings,
  install: Install,
}

/**
 * Short titles for the back button, which names the screen you came *from*.
 * Hard-coding the label at each screen mislabels every second entry point —
 * Today → Coach → Check-ins used to offer a "Weigh-In" button that went to
 * Coach.
 */
export const ROUTE_TITLES: Record<string, string> = {
  today: 'Today',
  train: 'Train',
  meals: 'Meals',
  weigh: 'Weigh-In',
  settings: 'Settings',
  session: 'Session',
  history: 'History',
  logDetail: 'Workout',
  exerciseLibrary: 'Exercises',
  exerciseDetail: 'Exercise',
  rpeGuide: 'RPE',
  prs: 'Records',
  mealDetail: 'Meal',
  grocery: 'Grocery',
  guidelines: 'Plan',
  measurements: 'Measure',
  photos: 'Photos',
  checkIns: 'Check-ins',
  profileSettings: 'Profile',
  trainingMaxes: 'Maxes',
  equipment: 'Equipment',
  appearance: 'Appearance',
  workoutSettings: 'Workout',
  notifications: 'Alerts',
  dataSettings: 'Data',
  coach: 'Coach',
  programSettings: 'Programme',
  install: 'Home Screen',
}
