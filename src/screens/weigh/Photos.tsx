import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Screen } from '../../components/ios/Screen'
import { ListSection, Row } from '../../components/ios/List'
import { EmptyState, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Button, Segmented } from '../../components/ios/Controls'
import { ActionSheet } from '../../components/ios/Sheet'
import { SheetPortal } from '../../components/ios/SheetLayer'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import type { PhotoPose, ProgressPhoto, Units } from '../../domain/types'
import { rollingSeries } from '../../domain/weight'
import { daysBetween, formatMediumDate, formatShortDate, todayISO } from '../../lib/date'
import { fixed } from '../../lib/format'
import { uid } from '../../lib/id'
import { useNav } from '../../nav/nav'
import { IOS_PUSH } from '../../nav/Stack'
import '../../styles/fuel.css'

const POSES: { value: PhotoPose; label: string; how: string }[] = [
  { value: 'front', label: 'Front', how: 'Arms relaxed, feet hip-width.' },
  { value: 'side', label: 'Side', how: 'Quarter turn, arms hanging, eyes up.' },
  { value: 'back', label: 'Back', how: 'Same stance, hands in shot.' },
]

/**
 * Downscale before storing. Photos live in localStorage alongside everything
 * else, and a raw 12-megapixel capture would blow the quota on the first shot.
 */
async function downscale(file: File, maxEdge = 900, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

export function Photos() {
  const pop = useNav((s) => s.pop)
  const photos = useStore((s) => s.photos)
  const weighIns = useStore((s) => s.weighIns)
  const units = useStore((s) => s.profile.units)
  const decimals = useStore((s) => s.settings.weightUnitDecimals)
  const addPhoto = useStore((s) => s.addPhoto)
  const deletePhoto = useStore((s) => s.deletePhoto)
  const [pose, setPose] = useState<PhotoPose>('front')
  const [selected, setSelected] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  // Which shot is being held up against the newest one. Null means the oldest,
  // which is the comparison people want first and almost always keep.
  const [thenId, setThenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Stable, because the viewer keys its escape and focus handling off it.
  const closeViewer = useCallback(() => setViewing(null), [])

  // Newest first for the grid; the pair below reads the two ends of the run.
  const filtered = useMemo(
    () => photos.filter((p) => p.pose === pose).sort((a, b) => b.date.localeCompare(a.date)),
    [photos, pose],
  )
  const now = filtered[0]
  const then = filtered.find((p) => p.id === thenId) ?? filtered[filtered.length - 1]
  const pair = now && then && now !== then ? { then, now } : null

  /** The 7-day average nearest a photo's date — the mirror with a number on it. */
  const avg = useMemo(() => rollingSeries(weighIns, 7), [weighIns])
  const weightOn = (date: string) => {
    let best: { date: string; avg: number } | undefined
    for (const p of avg) {
      if (!best || Math.abs(daysBetween(p.date, date)) < Math.abs(daysBetween(best.date, date))) {
        best = p
      }
    }
    return best && Math.abs(daysBetween(best.date, date)) <= 4 ? best.avg : null
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await downscale(file)
      addPhoto({ id: uid('photo'), date: todayISO(), pose, dataUrl })
      toast('Photo saved', { icon: 'camera', tone: 'good' })
    } catch {
      toast("Couldn't read that image", { icon: 'xmark.circle.fill', tone: 'bad' })
    }
  }

  return (
    <Screen
      title="Progress photos"
      back={{ onPress: pop }}
      titleAccessory={
        <div className="gutter" style={{ marginTop: -6, marginBottom: 16 }}>
          <div className="t-subhead dim">
            Same light, same spot, same time of day. Stored on this device only.
          </div>
        </div>
      }
      right={{ icon: 'camera', onPress: () => inputRef.current?.click(), ariaLabel: 'Add photo' }}
    >
      {/* One 32px rhythm between groups — the same figure `.list-section`
          carries, so lists and cards space identically. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div className="gutter">
          <Segmented options={POSES} value={pose} onChange={(v) => setPose(v as PhotoPose)} />
        </div>

        {/* ------------------------------ then & now -------------------------
            Two shots side by side with the weight each was taken at. A grid of
            thumbnails is an archive; this is the only view that answers the
            question anyone opens this screen to ask.
            ----------------------------------------------------------------- */}
        {pair && (
          <ComparePair
            pair={pair}
            weightOn={weightOn}
            units={units}
            decimals={decimals}
            onOpen={setViewing}
            onChange={filtered.length > 2 ? () => setPicking(true) : undefined}
          />
        )}

        {/* One shot is not half a comparison, it is a baseline — so it is shown
            as one, at the size the pair gets, rather than as a lone thumbnail
            in a two-column archive with nothing beside it. */}
        {!pair && now && (
          <BaselineShot
            photo={now}
            weight={weightOn(now.date)}
            units={units}
            decimals={decimals}
            onOpen={() => setViewing(now.id)}
            onOptions={() => setSelected(now.id)}
          />
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon="photo"
            title={`No ${pose} photos yet`}
            message="Every four weeks is plenty. The mirror lies day to day; the photos don't."
            action={
              <Button small onPress={() => inputRef.current?.click()} icon="camera">
                Add a photo
              </Button>
            }
          />
        ) : filtered.length === 1 ? null : (
          <div>
            {/* Only a heading when there is a pair above it to be told apart
                from — one photo needs no archive section. */}
            {pair && <SectionHeader title={`Every ${pose} shot`} />}
            <div
              className="gutter"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
            >
              {/* The options control is a sibling of the tile, never nested inside
                  it: a button within a button is invalid, and only a real button
                  answers to both Enter and Space. */}
              {filtered.map((photo) => (
                <div key={photo.id} style={{ position: 'relative', minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => setViewing(photo.id)}
                    aria-label={`View ${photo.pose} photo from ${formatMediumDate(photo.date)}`}
                    style={{
                      position: 'relative',
                      display: 'block',
                      width: '100%',
                      borderRadius: 'var(--r-card)',
                      overflow: 'hidden',
                      background: 'var(--fill-4)',
                      aspectRatio: '3 / 4',
                      maxWidth: '100%',
                    }}
                  >
                    <img
                      src={photo.dataUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <span className="data shot-date">{formatMediumDate(photo.date)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Options for ${photo.pose} photo from ${formatMediumDate(photo.date)}`}
                    className="hit-expand"
                    onClick={() => setSelected(photo.id)}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'var(--shot-scrim)',
                      display: 'grid', placeItems: 'center',
                    }}
                  >
                    <Icon name="ellipsis" size={16} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nobody is born knowing how to take these, and the segmented control
            above is the only thing on the screen that says there are three of
            them — so before the first shot exists, the poses are named, said
            how to stand for, and each one opens the picker on itself. It goes
            once there is anything to compare. */}
        {photos.length === 0 && (
          <ListSection
            header="The three shots"
            footer="Every four weeks is plenty — closer than that and you see the light change before you see anything else."
            style={{ marginBottom: 0 }}
          >
            {POSES.map((p) => (
              <Row
                key={p.value}
                title={p.label}
                subtitle={p.how}
                icon="camera"
                iconColor="var(--tint)"
                chevron
                onPress={() => {
                  setPose(p.value)
                  inputRef.current?.click()
                }}
              />
            ))}
          </ListSection>
        )}

        <div className="gutter">
          {/* The empty state already offers this, and the nav bar always does. */}
          {filtered.length > 0 && (
            <Button variant="tinted" icon="camera" onPress={() => inputRef.current?.click()}>
              Add {pose} photo
            </Button>
          )}
          <div className="t-footnote dim" style={{ marginTop: 10 }}>
            Photos never leave your phone. Share them with Jud yourself when you&rsquo;re ready.
          </div>
        </div>
      </div>

      {/* No `capture`. Its presence takes the choice away on iOS: the tap opens
          the rear camera outright instead of the Photo Library / Take Photo /
          Choose File sheet, so a client who already shot their front, side and
          back on a timer had no way to add them. Without it the system sheet
          comes back and the camera is still one tap inside it. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <ActionSheet
        open={picking}
        onClose={() => setPicking(false)}
        title="Compare against"
        items={filtered.slice(1).map((p) => ({
          label: `${formatShortDate(p.date)}${weightOn(p.date) != null ? ` · ${fixed(weightOn(p.date)!, decimals)} ${units}` : ''}`,
          onPress: () => setThenId(p.id),
        }))}
      />

      <ActionSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        items={[
          {
            label: 'Delete photo',
            destructive: true,
            onPress: () => {
              if (selected) deletePhoto(selected)
              // The deleted shot may be the one being looked at, and a viewer
              // left pointing at a photograph that no longer exists comes back
              // blank the next time this screen is opened.
              if (selected === viewing) setViewing(null)
              setSelected(null)
              toast('Photo deleted', { icon: 'trash', tone: 'bad' })
            },
          },
        ]}
      />

      <PhotoViewer photo={photos.find((p) => p.id === viewing)} onClose={closeViewer} />
    </Screen>
  )
}

/**
 * The full-screen viewer.
 *
 * It renders into the sheet layer, which is the one surface in this app that is
 * in front of the shell. As a child of the screen it was clipped to the screen's
 * own box — `.screen` is absolutely positioned and hidden inside the stack — so
 * the overlay stopped 49px short of the bottom and the tab bar went on standing
 * over the photograph at full brightness. Worse, it stayed tappable: a tap on
 * Today took the app to another tab with the viewer still open, and coming back
 * dropped the client straight into a lightbox they had never reopened.
 *
 * Presented rather than merely rendered, it also gets what a presentation owes
 * the client: a named way out, Escape, focus that goes in and comes back, and a
 * cross-dissolve instead of simply existing on the next frame.
 */
function PhotoViewer({ photo, onClose }: { photo?: ProgressPhoto; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const open = !!photo

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }))

    const onKey = (e: KeyboardEvent) => {
      const node = ref.current
      if (!node) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // Tab must not walk out into an app the photograph is covering.
      const items = [...node.querySelectorAll<HTMLElement>('button')]
      if (items.length === 0) return
      const edge = e.shiftKey ? items[0] : items[items.length - 1]
      if (document.activeElement === edge || !node.contains(document.activeElement)) {
        e.preventDefault()
        ;(e.shiftKey ? items[items.length - 1] : items[0])!.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey, true)
      // Skipped when the opener has gone with the photo it belonged to.
      if (opener && opener !== document.body && opener.isConnected) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [open, onClose])

  return (
    <SheetPortal active={open} recede={false}>
      <AnimatePresence>
        {photo && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={IOS_PUSH}
            role="dialog"
            aria-modal="true"
            aria-label={`${photo.pose} photo from ${formatMediumDate(photo.date)}`}
            tabIndex={-1}
            style={{
              position: 'absolute', inset: 0, zIndex: 101,
              // Black in both appearances, as a photo viewer is on iOS: the
              // point of it is that nothing but the photograph is lit.
              background: '#000',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* The way out a finger already knows, behind everything: a tap on
                the photograph or the surround puts it away. */}
            <button
              type="button"
              aria-label="Close photo"
              onClick={onClose}
              style={{ position: 'absolute', inset: 0 }}
            />
            <div
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: 'calc(var(--sa-top) + 8px) var(--gutter) 8px',
                pointerEvents: 'none',
              }}
            >
              <span className="eyebrow" style={{ color: 'color-mix(in srgb, #fff 78%, transparent)' }}>
                {photo.pose} &middot; {formatMediumDate(photo.date)}
              </span>
              <button
                type="button"
                className="pressable"
                onClick={onClose}
                style={{
                  pointerEvents: 'auto',
                  minHeight: 44, padding: '0 16px',
                  borderRadius: 'var(--r-btn)',
                  background: 'color-mix(in srgb, #fff 18%, transparent)',
                  color: '#fff', fontSize: 17, fontWeight: 600,
                }}
              >
                Done
              </button>
            </div>
            {/* Transparent to touches, so the photograph itself is still part of
                the way out rather than a hole in it. */}
            <div
              style={{
                position: 'relative', flex: 1, minHeight: 0,
                display: 'grid', placeItems: 'center',
                padding: '0 var(--gutter) calc(var(--sa-bottom) + 24px)',
                pointerEvents: 'none',
              }}
            >
              <motion.img
                key={photo.id}
                src={photo.dataUrl}
                alt="Progress photo"
                initial={{ scale: 0.94 }}
                animate={{ scale: 1 }}
                transition={IOS_PUSH}
                style={{
                  maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                  borderRadius: 'var(--r-card)',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </SheetPortal>
  )
}

/**
 * The first shot in a pose: a baseline, not half a comparison.
 *
 * A single photograph in a two-column archive grid reads as a gallery with one
 * thing in it. What it actually is, is the measurement everything after it will
 * be read against — so it is named, stamped with the weight it was taken at,
 * and told what turns it into a comparison.
 */
function BaselineShot({
  photo, weight, units, decimals, onOpen, onOptions,
}: {
  photo: ProgressPhoto
  weight: number | null
  units: Units
  decimals: number
  onOpen: () => void
  onOptions: () => void
}) {
  return (
    <div>
      <SectionHeader title="Where you're starting" />
      <div className="gutter">
        <div className="baseline-shot">
          <div style={{ position: 'relative', minWidth: 0 }}>
            <button
              type="button"
              className="baseline-frame pressable"
              onClick={onOpen}
              aria-label={`View ${photo.pose} photo from ${formatMediumDate(photo.date)}`}
            >
              <img src={photo.dataUrl} alt="" />
            </button>
            <button
              type="button"
              aria-label={`Options for ${photo.pose} photo from ${formatMediumDate(photo.date)}`}
              className="hit-expand"
              onClick={onOptions}
              style={{
                position: 'absolute', top: 6, right: 6,
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--shot-scrim)',
                display: 'grid', placeItems: 'center',
              }}
            >
              <Icon name="ellipsis" size={16} color="#fff" />
            </button>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">First {photo.pose} shot</div>
            <div className="data compare-date" style={{ fontSize: 15, marginTop: 3 }}>
              {formatMediumDate(photo.date)}
            </div>
            {weight != null ? (
              <div className="data compare-weight" style={{ fontSize: 13 }}>
                at {fixed(weight, decimals)}<span className="data-unit"> {units}</span>
              </div>
            ) : (
              <div className="t-caption1 dim">no weigh-in that week</div>
            )}
            <div className="t-footnote dim" style={{ marginTop: 9, lineHeight: '18px' }}>
              Nothing to hold it against yet. Take the next one about four weeks out — closer than
              that and you will see the light change before you see anything else.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Two shots side by side with the weight each was taken at. A grid of thumbnails
 * is an archive; this is the only view that answers the question anyone opens
 * the screen to ask.
 */
function ComparePair({
  pair, weightOn, units, decimals, onOpen, onChange,
}: {
  pair: { then: ProgressPhoto; now: ProgressPhoto }
  weightOn: (date: string) => number | null
  units: Units
  decimals: number
  onOpen: (id: string) => void
  onChange?: () => void
}) {
  const { then, now } = pair
  const was = weightOn(then.date)
  const is = weightOn(now.date)
  const weeks = Math.max(1, Math.round(daysBetween(then.date, now.date) / 7))
  return (
    <div>
      <SectionHeader
        title="Then and now"
        action={onChange ? { label: 'Change', onPress: onChange } : undefined}
      />
      <div className="gutter">
        <div className="compare-pair">
          <ComparePane
            photo={then} tag="Then" weight={was} units={units} decimals={decimals}
            onPress={() => onOpen(then.id)}
          />
          <ComparePane
            photo={now} tag="Now" weight={is} units={units} decimals={decimals}
            onPress={() => onOpen(now.id)}
          />
        </div>
        {/* The answer the screen exists to give. Uncoloured, like the tape's:
            the app cannot know whether a client was paid to gain or to lose,
            and the two shots above are the verdict anyway. */}
        {was != null && is != null ? (
          <div className="compare-delta">
            {/* Same decimals as the two weights above it: `signed` trims a
                trailing zero, so a 3.0 lb gain came out "+3" under a pair of
                numbers both carrying a decimal. */}
            <span className="figure" style={{ fontSize: 26 }}>
              {is - was > 0 ? '+' : is - was < 0 ? '−' : ''}
              {fixed(Math.abs(is - was), decimals)}
              <span className="figure-unit" style={{ fontSize: 15 }}> {units}</span>
            </span>
            <span className="eyebrow">
              over {weeks} {weeks === 1 ? 'week' : 'weeks'}
            </span>
          </div>
        ) : (
          // Without both weights there is no change to state, and dropping the
          // figure on its own left the span of time captioning nothing.
          <div className="compare-delta" style={{ display: 'block' }}>
            <span className="eyebrow">over {weeks} {weeks === 1 ? 'week' : 'weeks'}</span>
            <div className="t-footnote dim" style={{ marginTop: 2, lineHeight: '18px' }}>
              No weigh-in within a few days of{' '}
              {was == null && is == null ? 'either shot' : was == null ? 'the older shot' : 'the newer shot'}
              , so there is no weight to put on it. The photographs are the comparison anyway.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** One half of the comparison: the shot, when it was taken, what it weighed. */
function ComparePane({
  photo, tag, weight, units, decimals, onPress,
}: {
  photo: ProgressPhoto
  tag: string
  weight: number | null
  units: Units
  decimals: number
  onPress: () => void
}) {
  return (
    <button
      type="button"
      className="compare-cell pressable"
      onClick={onPress}
      aria-label={`${tag}: ${photo.pose} photo from ${formatMediumDate(photo.date)}`}
    >
      <span className="compare-frame">
        <img src={photo.dataUrl} alt="" />
        <span className="eyebrow compare-tag">{tag}</span>
      </span>
      <span className="data compare-date">{formatShortDate(photo.date)}</span>
      {weight != null ? (
        <span className="data compare-weight" style={{ marginTop: -5 }}>
          {fixed(weight, decimals)}<span className="data-unit"> {units}</span>
        </span>
      ) : (
        <span className="t-caption1 dim" style={{ marginTop: -5 }}>no weigh-in that week</span>
      )}
    </button>
  )
}
