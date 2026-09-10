import type { CSSProperties, ReactNode } from 'react'
import { useGo } from '@/lib/nav'
import { dueMeta, initials } from '@/lib/format'
import type { ChipKind } from '@/data/types'

export function Chip({ children, kind = 'n', plain }: { children: ReactNode; kind?: ChipKind; plain?: boolean }) {
  return <span className={`chip ${kind}${plain ? ' pl' : ''}`}>{children}</span>
}

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

export function Parent({
  to,
  search,
  children,
}: {
  to: string
  search?: Record<string, string> | undefined
  children: ReactNode
}) {
  const navigate = useGo()
  return (
    <button type="button" className="eyebrow" onClick={() => navigate({ to, search })}>
      <i>←</i>
      {children}
    </button>
  )
}

export function NotFoundRecord({
  what,
  backTo,
  backLabel,
}: {
  what: string
  backTo: string
  backLabel: string
}) {
  const navigate = useGo()
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

export function PageHead({
  title,
  sub,
  actions,
  parent,
}: {
  title: string
  sub?: ReactNode
  actions?: ReactNode
  parent?: { to: string; label: string; search?: Record<string, string> }
}) {
  return (
    <div className="hd">
      <div style={{ minWidth: 0 }}>
        {parent ? (
          <Parent to={parent.to} search={parent.search}>
            {parent.label}
          </Parent>
        ) : null}
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

export function focusElement(el: HTMLElement | null) {
  if (!el) return
  el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  el.classList.add('lit')
  setTimeout(() => el.classList.remove('lit'), 1500)
}

export const focusSection = (id: string) => focusElement(document.getElementById(id))

export function SecHead({ sub, actions }: { sub: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ch" style={{ border: 'none', padding: '2px 0 15px', alignItems: 'flex-start' }}>
      <div className="gr" style={{ fontSize: 'var(--t-small)', maxWidth: '70ch' }}>
        {sub}
      </div>
      {actions ? <div className="r">{actions}</div> : null}
    </div>
  )
}

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
        <h2 style={{ margin: 0, fontSize: 'var(--t-h3)' }}>{title}</h2>
        {sub ? (
          <div className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 3 }}>
            {sub}
          </div>
        ) : null}
      </div>
      {actions ? <div className="r">{actions}</div> : null}
    </div>
  )
}

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
  valueSize,
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
  valueTone?: 'ok' | 'warn' | 'bad' | undefined
  valueSize?: number
  detail?: ReactNode
  detailTone?: 'ok' | 'warn' | 'bad'
  tone?: 'alert' | 'warn' | undefined
  icon?: string
  hint?: string
  onClick?: (() => void) | undefined
  selected?: boolean
  flat?: boolean
}) {
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
      <div
        className={`v${valueTone ? ' ' + valueTone : ''}`}
        style={valueSize ? { fontSize: valueSize } : undefined}
      >
        {value}
      </div>
      {detail ? <div className={`d ${detailTone ?? 'gr'}`}>{detail}</div> : null}
    </div>
  )
}

export function Due({ at }: { at: Date }) {
  const { kind, abs, rel } = dueMeta(at)
  return (
    <span className={`due ${kind}`}>
      {abs}
      <span className="sub">{rel}</span>
    </span>
  )
}

export function Avatar({
  name,
  self,
  title,
  onClick,
  style,
}: {
  name?: string | null
  self?: boolean
  title?: string | undefined
  onClick?: ((e: React.MouseEvent) => void) | undefined
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
      <div>
        {title ? <div className="bt">{title}</div> : null}
        {children}
      </div>
      {actions ? <div className="ba">{actions}</div> : null}
    </div>
  )
}

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
        const [name, badge] = Array.isArray(t) ? t : [t, null]
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

export function ReadOnly({ children }: { children: ReactNode }) {
  return <div className="ro">{children}</div>
}

export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
      {children}
    </div>
  )
}

function fill(value: number, max: number) {
  return max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
}

function Fill({ value, max, color }: { value: number; max: number; color?: string | undefined }) {
  return <i style={{ width: `${fill(value, max)}%`, ...(color ? { background: color } : {}) }} />
}

export function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  return (
    <div className="bar">
      <Fill value={value} max={max} color={color} />
    </div>
  )
}

export function BarRow({
  cols,
  gap = 12,
  padding = '6px 0',
  label,
  labelClass = 'gr',
  value,
  max,
  color,
  title,
  budget,
  right,
  rightClass = 'mono',
  rightStyle,
}: {
  cols: string
  gap?: number
  padding?: string
  label: ReactNode
  labelClass?: string
  value: number
  max: number
  color?: string
  title?: string
  budget?: { value: number; max: number }
  right: ReactNode
  rightClass?: string
  rightStyle?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gap,
        alignItems: 'center',
        padding,
        fontSize: 'var(--t-small)',
      }}
    >
      <span className={labelClass || undefined}>{label}</span>
      {budget ? (
        <span style={{ position: 'relative', height: 16 }}>
          <span className="bar" style={{ position: 'absolute', inset: 0, height: 16 }}>
            <Fill value={budget.value} max={budget.max} color="var(--brandsoft)" />
          </span>
          <span
            className="bar"
            style={{ position: 'absolute', inset: '4px 0', height: 8, background: 'transparent' }}
          >
            <Fill value={value} max={max} color={color} />
          </span>
        </span>
      ) : (
        <span className="bar" title={title}>
          <Fill value={value} max={max} color={color} />
        </span>
      )}
      <span className={rightClass || undefined} style={{ textAlign: 'right', ...rightStyle }}>
        {right}
      </span>
    </div>
  )
}

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

export interface TimelineEntry {
  id: string
  when: ReactNode
  who: ReactNode
  what: ReactNode
  current?: boolean
}

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

export function DetailRow({
  label,
  value,
  last,
  gap,
  padding = '7px 0',
  center,
  labelClass = 'gr',
}: {
  label: ReactNode
  value: ReactNode
  last?: boolean
  gap?: number
  padding?: string
  center?: boolean
  labelClass?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        ...(center ? { alignItems: 'center' } : {}),
        ...(gap === undefined ? {} : { gap }),
        padding,
        fontSize: 'var(--t-body)',
        ...(last ? {} : { borderBottom: '1px solid var(--hair)' }),
      }}
    >
      <span className={labelClass || undefined}>{label}</span>
      <span style={{ textAlign: 'right', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

export function DetailList({ rows, gap }: { rows: [string, ReactNode][]; gap?: number }) {
  return (
    <>
      {rows.map(([label, value]) => (
        <DetailRow key={label} label={label} value={value} {...(gap === undefined ? {} : { gap })} />
      ))}
    </>
  )
}

const BARE: CSSProperties = { border: 'none', borderRadius: 0 }

export function Rows({
  children,
  bare,
  style,
}: {
  children: ReactNode
  bare?: boolean
  style?: CSSProperties
}) {
  return (
    <div className="rows" style={bare ? { ...BARE, ...style } : style}>
      {children}
    </div>
  )
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
