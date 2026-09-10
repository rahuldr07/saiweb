/**
 * What a form will accept from a person typing into it.
 *
 * Small, but it has to be one rule rather than three: the lead capture form,
 * the staff record and the client record each carried their own copy of the
 * same pattern and the same sentence back to the user. Three copies of a
 * validation rule is three chances for one of them to be loosened.
 */

/**
 * An address with something before the `@`, something after it, and a dot in
 * the domain.
 *
 * Deliberately not stricter. A regex that tries to implement RFC 5322 rejects
 * addresses that work, and the only check that settles it is sending mail — so
 * this catches the typo and lets the rest through.
 */
export const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const isEmail = (v: string): boolean => EMAIL.test(v.trim())

/** What every form says when it does not. One wording, so it reads as one system. */
export const EMAIL_ERROR = 'That email does not look right.'

/**
 * Whether `candidate` is already taken by something on the list, ignoring case.
 *
 * Every form that names a thing refuses a clash, and the guard has two halves
 * that are each easy to get subtly wrong. Case is one: `Municipal search` and
 * `municipal search` are one department to a person and two to `===`. The record
 * being edited is the other — without excluding it, opening a record and saving
 * it under the name it already has clashes with itself and cannot be saved.
 *
 * `nameOf` reads the field rather than the helper naming it, because the lists
 * are not shaped alike: statuses arrive as `[key, [name, colour]]` pairs, and the
 * staff form runs the same guard over email addresses.
 *
 * `isSameRecord` is what marks the record being edited, so a form that only ever
 * adds leaves it out. Stored names are compared as they are held; the candidate
 * is trimmed, because it came from an input and a trailing space is not a
 * different name.
 */
export function isDuplicateName<T>(
  existing: readonly T[],
  candidate: string,
  nameOf: (item: T) => string,
  isSameRecord: (item: T) => boolean = () => false,
): boolean {
  const wanted = candidate.trim().toLowerCase()
  return existing.some((item) => !isSameRecord(item) && nameOf(item).toLowerCase() === wanted)
}
