/**
 * The sidebar: six groups, twenty-two screens. Labels, routes and glyphs are the
 * design's own — including the typographic icons, which are Unicode rather than
 * an icon font so the shell carries no image weight at all.
 */

/** [label, route, glyph] */
export type NavItem = [label: string, route: string, glyph: string]

export interface NavGroup {
  l: string
  t: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    l: 'Production',
    t: [
      ['My work', 'mywork', '◱'],
      ['My payslips', 'mypay', '₹'],
      ['How I’m doing', 'myperf', '★'],
      ['Dashboard', 'dash', '◱'],
      ['Orders', 'orders', '☰'],
      ['Assignment', 'assign', '⇄'],
      ['Order intake', 'intake', '✉'],
      ['Commitment report', 'commitment', '✎'],
    ],
  },
  {
    l: 'Business',
    t: [
      ['Leads', 'leads', '◎'],
      ['Invoicing', 'billing', '$'],
    ],
  },
  {
    l: 'HRMS',
    t: [
      ['Attendance', 'attend', '◷'],
      ['Leave', 'leave', '◎'],
      ['Payroll', 'payroll', '₹'],
      ['Payslips', 'payslips', '▤'],
      ['Recruitment', 'hiring', '⊕'],
      ['Petty cash', 'petty', '◫'],
    ],
  },
  {
    l: 'Reference',
    t: [
      ['County coverage', 'counties', '◈'],
      ['Link monitor', 'linkcheck', '◉'],
    ],
  },
  { l: 'Insight', t: [['Performance', 'performance', '▤']] },
  {
    l: 'Configure',
    t: [
      ['Integrations', 'integ', '⚯'],
      ['Company', 'company', '⚙'],
    ],
  },
]

/** Route → the crumb shown in the top bar. */
export const ROUTE_LABEL: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.t.map((t) => [t[1], t[0]])),
)

export const ROUTE_GROUP: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.t.map((t) => [t[1], g.l])),
)
