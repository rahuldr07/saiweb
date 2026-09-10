import { SHIFTS, SITES } from '@/data/people'
import { TIMECFG } from '@/data/hrms'
import { pad } from './format'
import type { DayMark, Person, Shift } from '@/data/types'

const NO_SHIFT: Shift = { k: '', n: '—', from: '09:00', to: '18:00', c: 'n', d: '' }

export const shiftByKey = (k: string): Shift => SHIFTS.find((x) => x.k === k) ?? SHIFTS[0] ?? NO_SHIFT

export const shiftOf = (p: Pick<Person, 'shift'>): Shift => shiftByKey(p.shift || 'day')

export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

const part = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : 0)

export const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return part(h) * 60 + part(m)
}

export const hm = (v: number) => `${Math.floor(v / 60)}h ${pad(v % 60)}m`

export const worked = (m: DayMark | null | undefined) =>
  m && m.in && m.out ? Math.max(0, mins(m.out) - mins(m.in)) : 0

export const metres = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371000
  const r = (x: number) => (x * Math.PI) / 180
  const dLat = r(bLat - aLat)
  const dLng = r(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

export const nearestSite = (lat: number, lng: number) =>
  SITES.map((s) => ({ s, d: metres(lat, lng, s.lat, s.lng) })).sort((x, y) => x.d - y.d)[0]

export const distance = (d: number) => (d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`)

export interface Fix {
  lat: number
  lng: number
  acc: number
}

export function placeOf(fix: Fix | null, error: string | null) {
  const near = fix ? nearestSite(fix.lat, fix.lng) : null
  if (!near) return { where: error ?? 'Location not recorded', inside: false }
  return near.d <= near.s.radius
    ? { where: near.s.n, inside: true }
    : { where: `${distance(near.d)} from ${near.s.n}`, inside: false }
}

export function withLocation(then: (fix: Fix | null, error: string | null) => void) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return then(null, 'This device cannot report a location')
  }
  let done = false
  const finish = (fix: Fix | null, error: string | null) => {
    if (done) return
    done = true
    then(fix, error)
  }
  setTimeout(() => finish(null, 'Location took too long'), 4000)
  try {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        finish(
          {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: Math.round(pos.coords.accuracy),
          },
          null,
        ),
      (err) =>
        finish(null, err && err.code === 1 ? 'Location permission was refused' : 'Location unavailable'),
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 60000 },
    )
  } catch {
    finish(null, 'Location unavailable')
  }
}

export interface RestState {
  ok: boolean
  msg: string
}

export function restCheck(m: DayMark | null | undefined, nowTime: string): RestState | null {
  if (!m || !m.in) return null
  const end = m.out ? mins(m.out) : mins(nowTime)
  const done = Math.max(0, end - mins(m.in) - (m.breakMins ?? 0))
  if (done < TIMECFG.restAfterMins) return null
  const took = m.breakMins ?? 0
  return took >= TIMECFG.restMins
    ? { ok: true, msg: `${took} minutes of break taken across ${hm(done)} worked.` }
    : {
        ok: false,
        msg: `${hm(done)} worked with ${took ? `${took} minutes` : 'no'} break. A rest of ${TIMECFG.restMins} minutes is required after ${TIMECFG.restAfterMins / 60} hours.`,
      }
}

export const lateBy = (inAt: string, shift: Shift) => {
  const late = mins(inAt) - mins(shift.from)
  return late > TIMECFG.lateGraceMins ? late : 0
}
