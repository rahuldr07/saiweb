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
 * The way back from a detail screen. Every one of them needs it and each was
 * spelling it out, so the arrow, the spacing and the ghost treatment live here
 * rather than being retyped with small differences.
 */
export function BackLink({ to, children }: { to: string; children: ReactNode; }) {
  const navigate = useNavigate()
  return (
    <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => navigate({ to })}>
      ← {children}
    </Btn>
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
      <BackLink to={backTo}>{backLabel}</BackLink>
      <PageHead
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

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="hd">
      <div>
        <h1 className="pg">{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="r">{actions}</div> : null}
    </div>
  )
}

export function SectionHead({ children }: { children: ReactNode }) {
  return <h2 className="sec">{children}</h2>
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
  detail,
  tone,
  icon,
  onClick,
  selected,
  flat,
}: {
  title: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'alert' | 'warn'
  icon?: string
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
      <div className="v">{value}</div>
      {detail ? <div className="d">{detail}</div> : null}
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
  onClick?: () => void
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
}: {
  kind?: 'b' | 'v' | 'r' | 'd'
  icon?: string
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className={`bnr ${kind}`}>
      {icon ? <span className="bi">{icon}</span> : null}
      <div>
        {title ? <div className="bt">{title}</div> : null}
        {children ? <div className="bs">{children}</div> : null}
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
