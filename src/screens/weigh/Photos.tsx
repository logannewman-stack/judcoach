import { useMemo, useRef, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { EmptyState, SectionHeader } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Button, Segmented } from '../../components/ios/Controls'
import { ActionSheet } from '../../components/ios/Sheet'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import type { PhotoPose, ProgressPhoto, Units } from '../../domain/types'
import { rollingSeries } from '../../domain/weight'
import { daysBetween, formatMediumDate, formatShortDate, todayISO } from '../../lib/date'
import { fixed, pluralize, signed } from '../../lib/format'
import { uid } from '../../lib/id'
import { useNav } from '../../nav/nav'

const POSES: { value: PhotoPose; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
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
        ) : (
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
                    <span
                      style={{
                        position: 'absolute',
                        left: 0, right: 0, bottom: 0,
                        padding: '18px 10px 8px',
                        background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.6))',
                        color: '#fff',
                        textAlign: 'left',
                      }}
                      className="t-caption1 semibold"
                    >
                      {formatMediumDate(photo.date)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Options for ${photo.pose} photo from ${formatMediumDate(photo.date)}`}
                    className="hit-expand"
                    onClick={() => setSelected(photo.id)}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.45)',
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

        <div className="gutter">
          {/* The empty state already offers this, and the nav bar always does. */}
          {filtered.length > 0 && (
            <Button variant="tinted" icon="camera" onPress={() => inputRef.current?.click()}>
              Add {pose} photo
            </Button>
          )}
          <div className="t-footnote dim" style={{ marginTop: 10, textAlign: 'center' }}>
            Photos never leave your phone. Share them with Jud yourself when you're ready.
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
              setSelected(null)
              toast('Photo deleted', { icon: 'trash', tone: 'bad' })
            },
          },
        ]}
      />

      {viewing && (
        <button
          type="button"
          aria-label="Close photo"
          onClick={() => setViewing(null)}
          style={{
            position: 'absolute', inset: 0, zIndex: 120,
            background: 'rgba(0,0,0,0.92)',
            display: 'grid', placeItems: 'center', padding: 16,
          }}
        >
          <img
            src={photos.find((p) => p.id === viewing)?.dataUrl}
            alt="Progress photo"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12 }}
          />
        </button>
      )}
    </Screen>
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
        <div className="t-footnote dim" style={{ marginTop: 9 }}>
          {pluralize(Math.max(1, Math.round(daysBetween(then.date, now.date) / 7)), 'week')} apart
          {was != null && is != null ? ` · ${signed(is - was, 1)} ${units} on the scale` : ''}
        </div>
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
        <span className="compare-tag">{tag}</span>
      </span>
      <span className="t-footnote semibold" style={{ color: 'var(--label)' }}>
        {formatShortDate(photo.date)}
      </span>
      <span className="t-caption1 dim mono-nums" style={{ marginTop: -5 }}>
        {weight != null ? `${fixed(weight, decimals)} ${units}` : 'no weigh-in that week'}
      </span>
    </button>
  )
}
