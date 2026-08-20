/**
 * The working day, as the clock records it.
 *
 * Pure functions over marks — no state, so the rules can be tested and the
 * screens can stay about presentation. The one rule with legal weight is the
 * rest break: most Indian states require one after five hours, and the record is
 * what proves it happened, so `restCheck` states the position rather than
 * nudging.
 */
import { SHIFTS, SITES } from '@/data/people'
import { TIMECFG } from '@/data/hrms'
import { pad } from './format'
import type { DayMark, Person, Shift } from '@/data/types'

export const shiftOf = (p: Pick<Person, 'shift'>): Shift =>
  SHIFTS.find((x) => x.k === (p.shift || 'day')) ?? SHIFTS[0]

/** A Date as the HH:MM a punch is stored in. */
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** HH:MM to minutes past midnight. */
export const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export const hm = (v: number) => `${Math.floor(v / 60)}h ${pad(v % 60)}m`

/** Minutes between the in and out marks. Zero until the day is closed. */
export const worked = (m: DayMark | null | undefined) =>
  m && m.in && m.out ? Math.max(0, mins(m.out) - mins(m.in)) : 0

/* ── where the punch was made ───────────────────────────────────────────── */

/** Great-circle distance in metres. */
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

/**
 * Where a punch happened, in words.
 *
 * Inside a site's radius it is the site's name; outside it says how far out, so
 * a mark made from home reads as a mark made from home rather than as an error.
 */
export function placeOf(fix: Fix | null, error: string | null) {
  const near = fix ? nearestSite(fix.lat, fix.lng) : null
  if (!near) return { where: error ?? 'Location not recorded', inside: false }
  return near.d <= near.s.radius
    ? { where: near.s.n, inside: true }
    : { where: `${distance(near.d)} from ${near.s.n}`, inside: false }
}

/**
 * Ask the browser where it is.
 *
 * It can genuinely answer this. It cannot tell us whose face this is, which is
 * why one half of a biometric check-in is real here and the other is a note.
 * Every path resolves — a refused permission is an answer, not a hang.
 */
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

/* ── what the law would say about the day so far ────────────────────────── */

export interface RestState {
  ok: boolean
  msg: string
}

/**
 * Null until the question arises — under five hours worked there is nothing to
 * report, and a green tick for a rule that has not yet applied is noise.
 */
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

/** Minutes past the shift start, once the grace period is spent. */
export const lateBy = (inAt: string, shift: Shift) => {
  const late = mins(inAt) - mins(shift.from)
  return late > TIMECFG.lateGraceMins ? late : 0
}

/** Overtime earned by the day as punched, after breaks. */
export const overtimeMins = (m: DayMark | null | undefined) => {
  if (!m || !m.out) return 0
  return Math.max(0, worked(m) - (m.breakMins ?? 0) - TIMECFG.otAfterMins)
}
