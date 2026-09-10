import { LEAVE } from '@/data/hrms'

export const onLeaveOn = (id: string, d: Date) =>
  LEAVE.some((l) => l.who === id && l.st === 'approved' && l.from <= d && l.to >= d)
