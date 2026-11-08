import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLessonWatch } from '../src/services/lesson-watch.js'

test('watch recorder follows playback and duration while excluding pauses and seek jumps', async () => {
  let time = 0
  const requests = []
  const changes = []
  const recorder = createLessonWatch({
    enabled: true,
    clock: () => time,
    initialWatched: 20,
    api: {
      request: async (path, options) => {
        requests.push({ path, ...options })
        return { progress_percent: '0' }
      },
    },
    path: '/subscriptions/s/lessons/l/watch',
    cacheKey: 'test',
    url: 'https://youtube.com/watch?v=VhZoXUOgHqI',
    onWatch: (...values) => changes.push(values),
  })
  const play = (currentTime, playing = true) =>
    recorder.observe({ currentTime, playing, duration: 180, playbackRate: 1 })
  play(0)
  time = 1000
  play(1)
  assert.equal(recorder.snapshot().watched, 21)
  assert.deepEqual(changes.at(-1), [20, false, 180])
  assert.equal(requests.length, 0)
  time = 2000
  play(120)
  time = 3000
  play(121, false)
  time = 9000
  play(121, false)
  assert.deepEqual(changes.at(-1), [22, false, 180])
  assert.equal(recorder.snapshot().watched, 22)
  await recorder.save()
  await recorder.save()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].body.duration_watched, 22)
  assert.equal(requests[0].body.duration_seconds, 180)
  assert.equal(requests[0].body.completed, false)
  assert.equal(requests[0].keepalive, true)
})

test('frequent playback samples update the UI and cache only every ten seconds', () => {
  let time = 0
  const changes = []
  const snapshots = []
  const writes = []
  const recorder = createLessonWatch({
    enabled: true,
    clock: () => time,
    cacheKey: 'lesson',
    url: 'video',
    onWatch: (...values) => changes.push(values),
    onChange: (value) => snapshots.push(value),
    storage: { getItem: () => null, setItem: (...args) => writes.push(args) },
  })
  for (let step = 0; step <= 20; step++) {
    time = step * 500
    recorder.observe({ currentTime: step / 2, duration: 100, playing: true })
  }
  assert.equal(recorder.snapshot().watched, 10)
  assert.deepEqual(changes, [
    [0, false, 100],
    [10, false, 100],
  ])
  assert.equal(snapshots.length, 2)
  assert.equal(writes.length, 2)
  time = 10500
  recorder.observe({ currentTime: 10.5, duration: 100, playing: false })
  assert.deepEqual(changes.at(-1), [10, false, 100])
  // Fractions are retained for recovery without repeatedly redrawing the same count.
  assert.equal(recorder.snapshot().watched, 10.5)
})

test('pause and completion flush immediately instead of waiting for the display interval', async () => {
  let time = 0
  const changes = []
  const requests = []
  const recorder = createLessonWatch({
    enabled: true,
    clock: () => time,
    path: '/watch',
    api: {
      request: async (_, options) => {
        requests.push(options.body)
        return {}
      },
    },
    onWatch: (...args) => changes.push(args),
  })
  recorder.observe({ currentTime: 0, duration: 3, playing: true })
  time = 1000
  recorder.observe({ currentTime: 1, duration: 3, playing: false })
  assert.deepEqual(changes.at(-1), [1, false, 3])
  await recorder.save()
  assert.equal(requests.at(-1).duration_watched, 1)
  time = 2000
  recorder.observe({ currentTime: 1, duration: 3, playing: true })
  time = 3000
  recorder.observe({ currentTime: 2, duration: 3, playing: true })
  time = 4000
  recorder.observe({ currentTime: 3, duration: 3, playing: false, ended: true })
  assert.deepEqual(changes.at(-1), [3, true, 3])
  await recorder.save()
  assert.equal(requests.at(-1).duration_watched, 3)
})

test('explicit saves flush the latest sample and small seek events do not count as viewing', async () => {
  let time = 0
  const changes = []
  const recorder = createLessonWatch({
    enabled: true,
    clock: () => time,
    api: { request: async () => ({}) },
    onWatch: (...values) => changes.push(values),
  })
  recorder.observe({ currentTime: 0, duration: 60, playing: true })
  time = 500
  recorder.observe({ currentTime: 0.5, duration: 60, playing: false, seeking: true })
  assert.equal(recorder.snapshot().watched, 0)
  recorder.observe({ currentTime: 0.5, duration: 60, playing: true })
  time = 1500
  recorder.observe({ currentTime: 1.5, duration: 60, playing: true })
  await recorder.save()
  assert.deepEqual(changes.at(-1), [1, false, 60])
})

test('failed autosaves retry the same progress, preserve browser recovery and keep grading server-side', async () => {
  let attempts = 0
  let time = 0
  const cache = new Map([['lesson', JSON.stringify({ url: 'video', seconds: 40 })]])
  const recorder = createLessonWatch({
    enabled: true,
    initialWatched: 10,
    cacheKey: 'lesson',
    url: 'video',
    storage: { getItem: (key) => cache.get(key), setItem: (key, value) => cache.set(key, value) },
    clock: () => time,
    path: '/watch',
    api: {
      request: async () => {
        if (++attempts === 1) throw new Error('offline')
        return {}
      },
    },
  })
  recorder.observe({ currentTime: 0, playing: true, playbackRate: 2, duration: 50 })
  time = 1000
  recorder.observe({ currentTime: 2, playing: true, playbackRate: 2, duration: 50 })
  await recorder.save()
  await recorder.save()
  assert.equal(attempts, 2)
  assert.equal(recorder.snapshot().watched, 42)
  assert.equal(JSON.parse(cache.get('lesson')).seconds, 42)
})

test('live or inaccessible learning content does not submit watch records', async () => {
  let requests = 0
  const recorder = createLessonWatch({
    enabled: false,
    api: {
      request: async () => {
        requests++
      },
    },
  })
  recorder.observe({ currentTime: 90, duration: 180, playing: true })
  await recorder.save()
  assert.equal(requests, 0)
  assert.equal(recorder.snapshot().duration, 180)
  assert.equal(recorder.snapshot().watched, 0)
})

test('a failed older save does not duplicate a newer queued progress update', async () => {
  let time = 0
  let rejectFirst
  const counts = []
  const recorder = createLessonWatch({
    enabled: true,
    clock: () => time,
    path: '/watch',
    api: {
      request: (_, { body }) => {
        counts.push(body.duration_watched)
        if (counts.length === 1)
          return new Promise((_, reject) => {
            rejectFirst = reject
          })
        return Promise.resolve({})
      },
    },
  })
  recorder.observe({ currentTime: 0, duration: 60, playing: true })
  time = 1000
  recorder.observe({ currentTime: 1, duration: 60, playing: true })
  const first = recorder.save()
  await Promise.resolve()
  time = 2000
  recorder.observe({ currentTime: 2, duration: 60, playing: true })
  const second = recorder.save()
  rejectFirst(new Error('offline'))
  await Promise.all([first, second])
  await recorder.save()
  assert.deepEqual(counts, [1, 2])
})
