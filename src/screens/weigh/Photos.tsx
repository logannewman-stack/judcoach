import { useRef, useState } from 'react'
import { Screen } from '../../components/ios/Screen'
import { EmptyState } from '../../components/Bits'
import { Icon } from '../../components/Icon'
import { Button, Segmented } from '../../components/ios/Controls'
import { ActionSheet } from '../../components/ios/Sheet'
import { toast } from '../../components/ios/Toast'
import { useStore } from '../../store/useStore'
import type { PhotoPose } from '../../domain/types'
import { formatMediumDate, todayISO } from '../../lib/date'
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
  const addPhoto = useStore((s) => s.addPhoto)
  const deletePhoto = useStore((s) => s.deletePhoto)
  const [pose, setPose] = useState<PhotoPose>('front')
  const [selected, setSelected] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = photos.filter((p) => p.pose === pose)

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
      back={{ label: 'Weigh-In', onPress: pop }}
      largeTitle={false}
      right={{ icon: 'camera', onPress: () => inputRef.current?.click(), ariaLabel: 'Add photo' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 12 }}>
        <div className="gutter">
          <h1 className="t-large-title" style={{ letterSpacing: -0.6 }}>Progress photos</h1>
          <div className="t-subhead dim" style={{ marginTop: 2 }}>
            Same light, same spot, same time of day. Stored on this device only.
          </div>
        </div>

        <div className="gutter">
          <Segmented options={POSES} value={pose} onChange={(v) => setPose(v as PhotoPose)} />
        </div>

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
          <div
            className="gutter"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
          >
            {filtered.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setViewing(photo.id)}
                style={{
                  position: 'relative',
                  borderRadius: 'var(--r-card)',
                  overflow: 'hidden',
                  background: 'var(--fill-4)',
                  aspectRatio: '3 / 4',
                  maxWidth: '100%',
                }}
              >
                <img
                  src={photo.dataUrl}
                  alt={`${photo.pose} on ${formatMediumDate(photo.date)}`}
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
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Photo options"
                  className="hit-expand"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(photo.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      setSelected(photo.id)
                    }
                  }}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.45)',
                    display: 'grid', placeItems: 'center',
                  }}
                >
                  <Icon name="ellipsis" size={16} color="#fff" />
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="gutter">
          <Button variant="tinted" icon="camera" onPress={() => inputRef.current?.click()}>
            Add {pose} photo
          </Button>
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
