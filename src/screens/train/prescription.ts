import type { ExercisePrescription, Profile } from '../../domain/types'
import { resolveSet } from '../../domain/strength'
import type { ResolvedSet } from '../../domain/strength'

/* ============================================================================
   Reading a prescription the way a screen needs it.

   Today's hero, Train's session rows and the session plan all lead with the
   same figure — the heaviest set the block asks for — so they work it out in
   one place. Two copies of this drifted apart once already: the card said
   "top 400 lb" while the row it linked to said 390.
   ========================================================================== */

/**
 * Every set in a block resolved against the client's numbers.
 *
 * Walked in order because a back-off set is a percentage of the top set, which
 * is not known until everything above it has a load.
 */
export function resolvePrescription(
  block: ExercisePrescription,
  profile: Profile,
): ResolvedSet[] {
  const trainingMax = profile.trainingMaxes[block.exerciseId]
  const out: ResolvedSet[] = []
  let top = 0
  for (const set of block.sets) {
    const resolved = resolveSet(set, { trainingMax, profile, topSetWeight: top || undefined })
    top = Math.max(top, resolved.targetWeight ?? 0)
    out.push(resolved)
  }
  return out
}

/**
 * The heaviest set a block asks for — the session's headline figure.
 *
 * Where nothing carries a load (bodyweight work, or a client with no training
 * max yet) the first set stands in, so the caller still has a rep target and an
 * RPE to show rather than nothing at all.
 */
export function topPrescribedSet(
  block: ExercisePrescription | undefined,
  profile: Profile,
): ResolvedSet | undefined {
  if (!block || block.sets.length === 0) return undefined
  return resolvePrescription(block, profile).reduce((best, r) =>
    (r.targetWeight ?? 0) > (best.targetWeight ?? 0) ? r : best,
  )
}
