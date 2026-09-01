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
