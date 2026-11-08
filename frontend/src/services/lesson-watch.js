import { playbackDelta } from './watch-time.js'

export const LESSON_SAVE_INTERVAL_MS = 10_000
export const LESSON_DISPLAY_INTERVAL_MS = 10_000

export function createLessonWatch({
  api,
  path,
  enabled,
  cacheKey,
  url,
  initialWatched = 0,
  storage,
  clock = () => performance.now(),
  onChange = () => {},
  onWatch = () => {},
  onSaved = () => {},
  onStatus = () => {},
}) {
  let watched = initialWatched
  try {
    const cached = JSON.parse(storage?.getItem(cacheKey) ?? 'null')
    if (cached?.url === url && Number.isFinite(cached.seconds))
      watched = Math.max(watched, cached.seconds)
  } catch {
    /* Browser storage is optional. */
  }
  let previous = null
  let stamp = clock()
  let playing = false
  let rate = 1
  let duration = null
  let ended = false
  let lastSent = ''
  let lastPublished = ''
  let lastPublishedAt = -Infinity
  let lastCached = null
  let pending = Promise.resolve()
  function snapshot() {
    return { watched, duration }
  }
  function persist() {
    if (!enabled || watched === lastCached) return
    try {
      storage?.setItem(cacheKey, JSON.stringify({ url, seconds: watched }))
      lastCached = watched
    } catch {
      /* Autosave still works. */
    }
  }
  function publish(force = false) {
    const count = Math.min(600000, ended ? Math.ceil(watched) : Math.floor(watched))
    const seconds = duration ? Math.ceil(duration) : null
    const key = `${count}:${seconds}`
    const now = clock()
    if (key === lastPublished || (!force && now - lastPublishedAt < LESSON_DISPLAY_INTERVAL_MS))
      return
    lastPublished = key
    lastPublishedAt = now
    persist()
    if (enabled) onWatch(count, !!seconds && count >= seconds, seconds)
    onChange(snapshot())
  }
  function observe(next) {
    const now = clock()
    const wasPlaying = playing
    const previousDuration = duration ? Math.ceil(duration) : null
    const wasComplete = !!duration && watched >= Math.ceil(duration)
    const wasEnded = ended
    if (
      enabled &&
      playing &&
      !next.seeking &&
      previous !== null &&
      Number.isFinite(next.currentTime)
    )
      watched += playbackDelta(previous, next.currentTime, (now - stamp) / 1000, rate)
    previous = Number.isFinite(next.currentTime) ? next.currentTime : null
    stamp = now
    playing = !!next.playing
    rate = next.playbackRate > 0 ? next.playbackRate : 1
    ended = !!next.ended
    if (Number.isFinite(next.duration) && next.duration > 0) duration = next.duration
    const seconds = duration ? Math.ceil(duration) : null
    publish(
      previousDuration !== seconds ||
        (wasPlaying && !playing) ||
        (!wasEnded && ended) ||
        (!wasComplete && !!seconds && watched >= seconds),
    )
  }
  function save() {
    if (!enabled || !api) return Promise.resolve()
    persist()
    publish(true)
    const count = Math.min(600000, ended ? Math.ceil(watched) : Math.floor(watched))
    const seconds = duration ? Math.ceil(duration) : null
    const key = `${count}:${seconds}`
    if (key === lastSent) return pending
    lastSent = key
    const body = {
      duration_watched: count,
      completed: false,
      ...(seconds && seconds <= 600000 ? { duration_seconds: seconds } : {}),
    }
    pending = pending
      .then(() => api.request(path, { method: 'POST', body, keepalive: true }))
      .then((progress) => {
        onStatus('Đã lưu tiến độ.')
        onSaved(progress)
      })
      .catch(() => {
        if (lastSent === key) lastSent = ''
        onStatus('Chưa lưu được tiến độ. Đang thử lại…')
      })
    return pending
  }
  return { observe, save, snapshot }
}
