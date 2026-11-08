import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { driveVideo, externalMediaUrl, youtubeVideo } from '../services/media.js'
import YouTubeLessonMedia from './YouTubeLessonMedia.jsx'
import { formatDuration } from '../services/watch-time.js'
import { createLessonWatch, LESSON_SAVE_INTERVAL_MS } from '../services/lesson-watch.js'

export default function LessonMedia(props) {
  const youtube = youtubeVideo(props.url)
  return youtube ? (
    <YouTubeLessonMedia {...props} video={youtube} />
  ) : (
    <NativeLessonMedia {...props} />
  )
}

function NativeLessonMedia({
  url,
  title,
  api,
  subscriptionId,
  lessonId,
  initialWatched = 0,
  track = false,
  onSaved,
  onWatch,
}) {
  const videoRef = useRef(null)
  const cacheKey = `lesson-watch:${subscriptionId}:${lessonId}`
  const [startingWatched] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey))
      return cached?.url === url && Number.isFinite(cached.seconds)
        ? Math.max(initialWatched, cached.seconds)
        : initialWatched
    } catch {
      return initialWatched
    }
  })
  const accumulated = useRef(startingWatched)
  const [fallback, setFallback] = useState(false)
  const [duration, setDuration] = useState(null)
  const [watched, setWatched] = useState(startingWatched)
  const [status, setStatus] = useState('Tiến độ tự lưu khi xem video.')
  const saved = useEffectEvent((progress) => onSaved?.(progress))
  const report = useEffectEvent((count, complete, seconds) => onWatch?.(count, complete, seconds))
  const drive = driveVideo(url)
  const source = drive
    ? `https://drive.google.com/uc?export=download&id=${drive.id}`
    : externalMediaUrl(url)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !track || !api || fallback) return
    let playing = !video.paused && !video.seeking
    let disposed = false
    let storage
    try {
      storage = localStorage
    } catch {
      /* Server autosave works without browser storage. */
    }
    const recorder = createLessonWatch({
      api,
      path: `/subscriptions/${subscriptionId}/lessons/${lessonId}/watch`,
      enabled: true,
      cacheKey,
      url,
      initialWatched: accumulated.current,
      storage,
      onChange: (value) => {
        if (!disposed) {
          accumulated.current = value.watched
          setWatched(value.watched)
          if (value.duration) setDuration(value.duration)
        }
      },
      onWatch: (count, complete, seconds) => {
        if (!disposed) report(count, complete, seconds)
      },
      onSaved: (progress) => {
        if (!disposed) saved(progress)
      },
      onStatus: (value) => {
        if (!disposed) setStatus(value)
      },
    })
    const sample = () =>
      recorder.observe({
        currentTime: video.currentTime,
        duration: video.duration,
        playbackRate: video.playbackRate,
        playing: playing && !video.seeking,
        seeking: video.seeking,
        ended: video.ended,
      })
    const save = () => {
      sample()
      recorder.save()
    }
    const start = () => {
      playing = true
      sample()
    }
    const stop = () => {
      playing = false
      save()
    }
    const seek = () => {
      sample()
      playing = false
    }
    const seeked = () => {
      playing = !video.paused
      sample()
    }
    const metadata = () => {
      if (Number.isFinite(video.duration)) setDuration(video.duration)
      save()
    }
    const hide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    const events = {
      playing: start,
      pause: stop,
      waiting: stop,
      ended: stop,
      seeking: seek,
      seeked,
      timeupdate: sample,
      ratechange: sample,
      loadedmetadata: metadata,
      durationchange: metadata,
    }
    Object.entries(events).forEach(([name, listener]) => video.addEventListener(name, listener))
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', save)
    const interval = setInterval(save, LESSON_SAVE_INTERVAL_MS)
    return () => {
      disposed = true
      save()
      accumulated.current = recorder.snapshot().watched
      clearInterval(interval)
      Object.entries(events).forEach(([name, listener]) =>
        video.removeEventListener(name, listener),
      )
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', save)
    }
  }, [api, subscriptionId, lessonId, cacheKey, url, track, fallback])

  if (!source) return <p role="alert">Đường dẫn video không hợp lệ.</p>
  return (
    <div>
      {!fallback ? (
        <video
          ref={videoRef}
          className="lesson-video"
          src={source}
          controls
          autoPlay
          playsInline
          preload="metadata"
          aria-label={title}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onError={() => setFallback(true)}
        />
      ) : (
        <>
          {drive && (
            <iframe
              className="lesson-video"
              src={drive.previewUrl}
              title={title}
              allow="autoplay; fullscreen; encrypted-media"
              allowFullScreen
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            />
          )}
          <p role="alert">
            {drive
              ? 'Bạn đang xem bản dự phòng. Tiến độ xem ở chế độ này chưa được lưu.'
              : 'Chưa phát được video. Vui lòng thử lại sau.'}
          </p>
          <button onClick={() => setFallback(false)}>Thử phát trực tiếp lại</button>
        </>
      )}
      <div className="lesson-playback-info">
        <span>
          Thời lượng: <strong>{formatDuration(duration)}</strong>
        </span>
        <span>
          Đã học: <strong>{formatDuration(watched)}</strong>
        </span>
      </div>
      {track && !fallback && (
        <p className="muted" role="status">
          {status}
        </p>
      )}
    </div>
  )
}
