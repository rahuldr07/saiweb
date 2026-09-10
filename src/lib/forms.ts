export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const isEmail = (v: string): boolean => EMAIL.test(v.trim())

export const EMAIL_ERROR = 'That email does not look right.'

export function isDuplicateName<T>(
  existing: readonly T[],
  candidate: string,
  nameOf: (item: T) => string,
  isSameRecord: (item: T) => boolean = () => false,
): boolean {
  const wanted = candidate.trim().toLowerCase()
  return existing.some((item) => !isSameRecord(item) && nameOf(item).toLowerCase() === wanted)
}
