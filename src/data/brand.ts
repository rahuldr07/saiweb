/**
 * The company mark shown on the sign-in screen.
 *
 * Taken from the Firstkey Title company page — this is the logo that page
 * publishes as its own `og:image`, so it is the company's own asset rather than
 * a crop of a screenshot.
 *
 * It is hot-linked from LinkedIn's CDN rather than copied into the repository,
 * which is the lighter option and the one that keeps working if the logo is
 * updated there. The cost is that it depends on somebody else's host, so the
 * sign-in screen falls back to the wordmark if the image does not load — see
 * the `onError` in `SignIn`. Replace this with a local file or a `data:` URI to
 * remove that dependency.
 */
export const LOGO_URL =
  'https://media.licdn.com/dms/image/v2/D560BAQF_Q2Kd6A97-w/company-logo_200_200/company-logo_200_200/0/1734409699213/firstkeytitle_logo?e=2147483647&v=beta&t=DOVVGCCGsRPkG5LLyI1AhSPhMcI0XaX6GScccZ-YqLs'

export const COMPANY_NAME = 'Firstkey Title'

/** Stands in when there is no image, and is the sidebar's own mark. */
export const COMPANY_GLYPH = '◧'

/** Height the mark is drawn at. Width follows the image's own ratio. */
export const LOGO_HEIGHT = 56
