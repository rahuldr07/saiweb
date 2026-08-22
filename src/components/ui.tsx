import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { dueMeta, initials } from '@/lib/format'
import type { ChipKind } from '@/data/types'

/**
 * The shared vocabulary of the design: chips, buttons, cards, KPI tiles, due
 * countdowns, avatars, banners, tabs. Each renders the design's own class names,
 * so the stylesheet — not this file — decides how they look.
 */

/* ── chips ──────────────────────────────────────────────────────────────── */

export function Chip({ children, kind = 'n', plain }: { children: ReactNode; kind?: ChipKind; plain?: boolean }) {
  return <span className={`chip ${kind}${plain ? ' pl' : ''}`}>{children}</span>
}

/* ── buttons ────────────────────────────────────────────────────────────── */

type BtnVariant = 'primary' | 'ghost' | 'danger'

const VARIANT: Record<BtnVariant, string> = { primary: '', ghost: ' g', danger: ' d' }

export function Btn({
  children,
  variant = 'primary',
  small,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  small?: boolean
}) {
  return (
    <button
      type="button"
      className={`btn${VARIANT[variant]}${small ? ' sm' : ''}${className ? ' ' + className : ''}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * The parent of a detail screen, shown as an eyebrow above its title.
 *
 * This used to be a ghost button floating above the header, which put a second
 * back control directly under the one the top bar already provides — two
 * arrows, one above the other, pointing at different places. As an eyebrow it
 * does the same job and also says where you are, which is what the space above
 * a title is for.
 */
export function Parent({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <button type="button" className="eyebrow" onClick={() => navigate({ to })}>
      <i>←</i>
      {children}
    </button>
  )
}

/**
 * A detail screen for a record that is not there. Same shape every time: say so
 * plainly, say why it might be, and offer the way back rather than leaving the
 * reader on a dead end.
 */
export function NotFoundRecord({
  what,
  backTo,
  backLabel,
}: {
  what: string
  backTo: string
  backLabel: string
}) {
  const navigate = useNavigate()
  return (
    <>
      <PageHead
        parent={{ to: backTo, label: backLabel }}
        title={`That ${what} is not here`}
        sub="It may have been removed, or the link may be out of date."
      />
      <Card>
        <Empty
          icon="⊘"
          action={<Btn small onClick={() => navigate({ to: backTo })}>Back to {backLabel.toLowerCase()}</Btn>}
        >
          Nothing matches that reference.
        </Empty>
      </Card>
    </>
  )
}

/* ── page header ────────────────────────────────────────────────────────── */

export function PageHead({
  title,
  sub,
  actions,
  parent,
}: {
  title: string
  sub?: ReactNode
  actions?: ReactNode
  /** Where this screen sits, for a detail view reached from a register. */
  parent?: { to: string; label: string }
}) {
  return (
    <div className="hd">
      <div style={{ minWidth: 0 }}>
        {parent ? <Parent to={parent.to}>{parent.label}</Parent> : null}
        <h1 className="pg">{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="r">{actions}</div> : null}
    </div>
  )
}

export function SectionHead({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 className="sec" id={id}>
      {children}
    </h2>
  )
}

/**
 * Take someone to a section already on the page rather than duplicating it
 * elsewhere. The brief highlight is what says "this, here" — without it the page
 * simply jumps and the reader has to work out what moved.
 */
export function focusSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  el.classList.add('lit')
  setTimeout(() => el.classList.remove('lit'), 1500)
}

/**
 * The header a tab body opens with: a sentence saying what you are looking at,
 * and the controls that act on it, on one borderless line.
 *
 * This is the design's `secHead`. It is not a heading — the page already has
 * one — which is why the text is a grey sub-line rather than an `<h2>`, and why
 * the actions have somewhere to sit without a card wrapping them.
 */
export function SecHead({ sub, actions }: { sub: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ch" style={{ border: 'none', padding: '2px 0 15px', alignItems: 'flex-start' }}>
      <div className="gr" style={{ fontSize: '12.5px', maxWidth: '70ch' }}>
        {sub}
      </div>
      {actions ? <div className="r">{actions}</div> : null}
    </div>
  )
}

/**
 * A page head that is not the page's head.
 *
 * The workload views are whole screens in their own right and also live inside
 * a Reports tab. Rendered there, their title has to step down to a section
 * heading — one page, one `<h1>` — which is what the design's `wHead` does.
 */
export function EmbedHead({
  title,
  sub,
  actions,
}: {
  title: string
  sub?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="ch" style={{ border: 'none', padding: '2px 0 14px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '17px' }}>{title}</h2>
        {sub ? (
          <div className="gr" style={{ fontSize: '12.5px', marginTop: 3 }}>
            {sub}
          </div>
        ) : null}
      </div>
      {actions ? <div className="r">{actions}</div> : null}
    </div>
  )
}

/* ── cards ──────────────────────────────────────────────────────────────── */

export function Card({
  children,
  padded,
  className = '',
  style,
  id,
}: {
  children: ReactNode
  padded?: boolean
  className?: string
  style?: CSSProperties
  id?: string
}) {
  return (
    <div id={id} className={`card${padded ? ' p' : ''}${className ? ' ' + className : ''}`} style={style}>
      {children}
    </div>
  )
}

export function CardHead({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ch">
      {typeof title === 'string' ? <h2>{title}</h2> : title}
      {actions ? <div className="r">{actions}</div> : null}
    </div>
  )
}

export function CardBody({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="cb" style={style}>
      {children}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="lb">{children}</div>
}

/* ── KPI tiles ──────────────────────────────────────────────────────────── */

export function Kpis({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="kpis" style={style}>
      {children}
    </div>
  )
}

export function Kpi({
  title,
  value,
  valueTone,
  detail,
  detailTone,
  tone,
  icon,
  hint,
  onClick,
  selected,
  flat,
}: {
  title: string
  value: ReactNode
  /** Colours the figure itself — the design's `vc`. */
  valueTone?: 'ok' | 'warn' | 'bad'
  detail?: ReactNode
  /** Colours the detail line, replacing its default grey — the design's `dc`. */
  detailTone?: 'ok' | 'warn' | 'bad'
  tone?: 'alert' | 'warn'
  icon?: string
  /** Tooltip for a clickable tile, saying what opening it will do. */
  hint?: string
  onClick?: () => void
  selected?: boolean
  /** Drop the card treatment — the design's `stat` variant, for a bare run of figures. */
  flat?: boolean
}) {
  /*
   * Every tile is a card unless it asks not to be. The design flattened any tile
   * that was not clickable, which left whole screens of figures floating with no
   * edges — so the box is the default here and `flat` is opt-in.
   */
  const cls = [
    'kpi',
    tone === 'alert' ? 'alert' : tone === 'warn' ? 'warnk' : '',
    flat ? 'stat' : '',
    selected ? 'sel' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const interactive = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        title: hint,
        /* A tile that focuses the report is a toggle, and says so. Tiles that
           merely navigate leave it unset rather than claiming a state. */
        ...(selected === undefined ? {} : { 'aria-pressed': selected }),
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        },
      }
    : {}

  return (
    <div className={cls} {...interactive}>
      <div className="t">
        {title}
        {icon ? <span className="i">{icon}</span> : null}
      </div>
      <div className={`v${valueTone ? ' ' + valueTone : ''}`}>{value}</div>
      {/* The detail line is grey unless the tile colours it. */}
      {detail ? <div className={`d ${detailTone ?? 'gr'}`}>{detail}</div> : null}
    </div>
  )
}

/* ── due countdown ──────────────────────────────────────────────────────── */

export function Due({ at }: { at: Date }) {
  const { kind, abs, rel } = dueMeta(at)
  return (
    <span className={`due ${kind}`}>
      {abs}
      <span className="sub">{rel}</span>
    </span>
  )
}

/* ── avatars ────────────────────────────────────────────────────────────── */

export function Avatar({
  name,
  self,
  title,
  onClick,
  style,
}: {
  name?: string | null
  self?: boolean
  title?: string
  /** Takes the event so a strip inside a clickable row can stop the bubble. */
  onClick?: (e: React.MouseEvent) => void
  style?: CSSProperties
}) {
  const cls = `ava${name ? '' : ' none'}${self ? ' self' : ''}`
  const text = name ? initials(name) : '·'
  if (onClick) {
    return (
      <button type="button" className={cls} title={title ?? name ?? 'Unassigned'} onClick={onClick} style={style}>
        {text}
      </button>
    )
  }
  return (
    <span className={cls} title={title ?? name ?? 'Unassigned'} style={style}>
      {text}
    </span>
  )
}

/** The six-stage assignment strip: one slot per stage, initials or an empty ring. */
export function StageStrip({
  stages,
  assignments,
  nameOf,
  meId,
  onPick,
}: {
  stages: string[]
  assignments: Record<string, string | null>
  nameOf: (id: string) => string
  meId?: string
  onPick?: (stage: string) => void
}) {
  return (
    <div className="asg">
      {stages.map((s) => {
        const who = assignments[s]
        return (
          <Avatar
            key={s}
            name={who ? nameOf(who) : null}
            self={!!who && who === meId}
            title={who ? `${s} — ${nameOf(who)}` : `${s} — unassigned`}
            onClick={onPick ? () => onPick(s) : undefined}
          />
        )
      })}
    </div>
  )
}

/* ── banners ────────────────────────────────────────────────────────────── */

export function Banner({
  kind = 'b',
  icon,
  title,
  children,
  actions,
  style,
}: {
  kind?: 'b' | 'v' | 'r' | 'd' | 'n'
  icon?: string
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div className={`bnr ${kind}`} style={style}>
      {icon ? <span className="bi">{icon}</span> : null}
      {/* The body sits bare, at the banner's own 13.5px. `.bs` is the design's
          trailing sub-line — dimmer and smaller — so a caller that wants one
          writes it, rather than every banner body being demoted to it. */}
      <div>
        {title ? <div className="bt">{title}</div> : null}
        {children}
      </div>
      {actions ? <div className="ba">{actions}</div> : null}
    </div>
  )
}

/** The hatched "this is an assumption" flag the design uses to mark invented rules. */
export function Assumption({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="asm">
      <span className="ai">✎</span>
      <div>
        <b>{title}</b>
        {children}
      </div>
    </div>
  )
}

/* ── empty state ────────────────────────────────────────────────────────── */

export function Empty({
  icon = '☰',
  children,
  action,
}: {
  icon?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="ei">{icon}</span>
      <p>{children}</p>
      {action}
    </div>
  )
}

/* ── select ─────────────────────────────────────────────────────────────── */

/**
 * The design's `.inp` select. Every register filter is one of these, so the
 * accessible name, the controlled value and the `[value, label]` option shape
 * live here rather than being spelled out at each call site.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  style,
}: {
  label: string
  value: string
  options: [string, string][]
  onChange: (v: string) => void
  style?: CSSProperties
}) {
  return (
    <select
      className="inp"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={style}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

/* ── segmented control ──────────────────────────────────────────────────── */

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={v === value ? 'on' : ''}
          aria-pressed={v === value}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/* ── tabs ───────────────────────────────────────────────────────────────── */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: (T | [T, number | null])[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => {
        const [name, badge] = (Array.isArray(t) ? t : [t, null]) as [T, number | null]
        return (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === value}
            className={name === value ? 'on' : ''}
            onClick={() => onChange(name)}
          >
            {name}
            {badge ? <span className="bdg">{badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/* ── forms ──────────────────────────────────────────────────────────────── */

export function Form({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="frm" style={style}>
      {children}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="fld">
      <label>{label}</label>
      {children}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  )
}

/** A value that cannot be edited here, shown in the same slot a field would be. */
export function ReadOnly({ children }: { children: ReactNode }) {
  return <div className="ro">{children}</div>
}

/* ── capacity bar ───────────────────────────────────────────────────────── */

export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const wpc = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="bar">
      <i style={{ width: `${wpc}%`, ...(color ? { background: color } : {}) }} />
    </div>
  )
}

/* ── key/value list ─────────────────────────────────────────────────────── */

export function KeyValues({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ── timeline ───────────────────────────────────────────────────────────── */

export interface TimelineEntry {
  id: string
  when: ReactNode
  who: ReactNode
  what: ReactNode
  /** Marks the entry as the current one — the dot takes the accent. */
  current?: boolean
}

/**
 * Entries against a rail, newest first.
 *
 * The timestamp gets a column of its own because it is the thing being scanned:
 * a reader looking for "when did we last speak to them" should not have to read
 * the note to find the date.
 */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="tl">
      {entries.map((e) => (
        <div className={`tl-e${e.current ? ' on' : ''}`} key={e.id}>
          <div className="tl-when">{e.when}</div>
          <div className="tl-body">
            <div className="tl-who">{e.who}</div>
            <div className="tl-what">{e.what}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── row list ───────────────────────────────────────────────────────────── */

export function Rows({ children }: { children: ReactNode }) {
  return <div className="rows">{children}</div>
}

export function Row({
  icon,
  title,
  detail,
  right,
  onClick,
}: {
  icon?: ReactNode
  title: ReactNode
  detail?: ReactNode
  right?: ReactNode
  onClick?: () => void
}) {
  const inner = (
    <>
      <span>{icon}</span>
      <span>
        <b>{title}</b>
        {detail ? <div className="sd">{detail}</div> : null}
      </span>
      <span>{right}</span>
    </>
  )
  return onClick ? (
    <button type="button" className="rw" style={{ width: '100%' }} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="rw">{inner}</div>
  )
}
