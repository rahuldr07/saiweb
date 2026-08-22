import { useState } from 'react'
import { Banner, Btn, Label } from '@/components/ui'
import { AVAIL } from '@/data/people'
import { STAGES } from '@/data/org'
import { inr } from '@/lib/payroll'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'
import { removeStaff, saveStaff, useCompany, useRoles, useStaff } from '@/state/company'
import type { Person } from '@/data/types'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * A person's record.
 *
 * Longer than the other forms because it is four records in one: who they are,
 * what they work on, who to call in an emergency, and what payroll needs. The
 * last two are grouped and explained rather than left as bare fields — a missing
 * joining date makes the first month and gratuity wrong, and a missing account
 * number means the bank file has nowhere to send the money.
 */
export function StaffForm({
  id,
  draft,
  onCancel,
  onDone,
  onRemove,
  onNewRole,
}: {
  id?: string
  /** What was typed before stepping out to create a role, put back on return. */
  draft?: Partial<Person> | null
  onCancel: () => void
  onDone: (message: string) => void
  onRemove: (id: string) => void
  onNewRole: (typed: Partial<Person>) => void
}) {
  const staff = useStaff()
  const roles = useRoles()
  const { pay } = useCompany()

  const rec = staff.find((x) => x.id === id)
  const s = { ...(rec ?? {}), ...(draft ?? {}) } as Partial<Person>

  const [n, setN] = useState(s.n ?? '')
  const [email, setEmail] = useState(
    s.e ?? (s.n ? `${s.n.toLowerCase().replace(/\s+/g, '.')}@keystoneabstract.com` : ''),
  )
  const [role, setRole] = useState(s.r ?? 'staff')
  const [cap, setCap] = useState(String(s.cap ?? 16))
  const [avail, setAvail] = useState(s.avail ?? 'ok')
  const [active, setActive] = useState(s.active !== false)
  const [dep, setDep] = useState<string[]>(s.dep ?? [])
  const [mob, setMob] = useState(s.mob ?? '')
  const [addr, setAddr] = useState(s.addr ?? '')
  const [emgN, setEmgN] = useState(s.emg?.n ?? '')
  const [emgRel, setEmgRel] = useState(s.emg?.rel ?? '')
  const [emgMob, setEmgMob] = useState(s.emg?.mob ?? '')
  const [ctc, setCtc] = useState(s.ctc ? String(s.ctc) : '')
  const [doj, setDoj] = useState(s.doj ?? '')
  const [acct, setAcct] = useState(s.bank?.acct ?? '')
  const [ifsc, setIfsc] = useState(s.bank?.ifsc ?? '')
  const [pan, setPan] = useState(s.pan ?? '')
  const [uan, setUan] = useState(s.uan ?? '')
  const [esicNo, setEsicNo] = useState(s.esicNo ?? '')
  const [aadhaar, setAadhaar] = useState(s.aadhaar ?? '')
  const [error, setError] = useState<string | null>(null)

  const typed = (): Partial<Person> => ({
    n,
    e: email,
    r: role,
    cap: Math.max(0, parseInt(cap, 10) || 0),
    avail: avail as Person['avail'],
    active,
    dep,
  })

  const submit = () => {
    const name = n.trim()
    const mail = email.trim().toLowerCase()
    if (!name) return setError('A name is required.')
    if (!EMAIL.test(mail)) return setError('That email does not look right.')
    if (staff.some((x) => x.id !== id && (x.e ?? '').toLowerCase() === mail))
      return setError(`${mail} already belongs to someone here.`)

    saveStaff(
      {
        ...(rec ?? ({} as Person)),
        n: name,
        e: mail,
        r: role,
        cap: Math.max(0, parseInt(cap, 10) || 0),
        avail: avail as Person['avail'],
        active,
        dep,
        mob: mob.trim(),
        addr: addr.trim(),
        emg: { n: emgN.trim(), rel: emgRel.trim(), mob: emgMob.trim() },
        ctc: ctc ? Number(ctc) : undefined,
        doj: doj.trim(),
        bank: { ...(rec?.bank ?? { name: name }), acct: acct.trim(), ifsc: ifsc.trim() },
        pan: pan.trim().toUpperCase(),
        uan: uan.trim(),
        esicNo: esicNo.trim(),
        aadhaar: aadhaar.trim(),
        /* Working a stage and its own QC is allowed, and flagged so the roster
           can show it — assignment filters them per order regardless. */
        conflict: dep.includes('Typing') && dep.includes('Typing QC'),
      } as Person,
      id,
    )
    onDone(id ? `${name} saved` : `${name} added`)
  }

  const roleDesc = roles.find((r) => r.id === role)?.desc ?? ''

  return (
    <>
      {error ? (
        <Banner kind="d" icon="⚑" style={{ marginBottom: 14 }}>
          {error}
        </Banner>
      ) : null}

      <div className="frm">
        <div className="fld">
          <label htmlFor="s-n">Full name</label>
          <input
            className="inp"
            id="s-n"
            placeholder="e.g. Meera Nair"
            autoComplete="off"
            value={n}
            onChange={(e) => {
              setN(e.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="fld">
          <label htmlFor="s-e">Email</label>
          <input
            className="inp"
            id="s-e"
            type="email"
            placeholder="name@company.com"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="fld">
          <label htmlFor="s-r">Role</label>
          <div style={{ display: 'flex', gap: 7 }}>
            <select
              className="inp"
              id="s-r"
              style={{ flex: 1 }}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.n}
                </option>
              ))}
            </select>
            <Btn
              variant="ghost"
              small
              style={{ flex: 'none' }}
              title="Create a role without leaving this form"
              onClick={() => onNewRole(typed())}
            >
              ＋ New
            </Btn>
          </div>
          <div className="hint">{roleDesc}</div>
        </div>
        <div className="fld">
          <label htmlFor="s-c">Daily target</label>
          <input
            className="inp mono"
            id="s-c"
            type="number"
            min={0}
            max={99}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
          <div className="hint">
            How many stage tasks they can hold. Assignment never fills anyone past this.
          </div>
        </div>
        <div className="fld">
          <label htmlFor="s-av">Today</label>
          <select className="inp" id="s-av" value={avail} onChange={(e) => setAvail(e.target.value as Person['avail'])}>
            {Object.entries(AVAIL).map(([k, v]) => (
              <option key={k} value={k}>
                {v[0]}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="s-ac">Employment</label>
          <select
            className="inp"
            id="s-ac"
            value={active ? '1' : '0'}
            onChange={(e) => setActive(e.target.value === '1')}
          >
            <option value="1">Active</option>
            <option value="0">Disabled</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>Departments</Label>
      </div>
      <div style={{ display: 'grid', gap: 7 }}>
        {STAGES.map((x) => (
          <label
            key={x}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              fontSize: '13.5px',
              padding: '8px 11px',
              border: '1px solid var(--hair)',
              borderRadius: 9,
              background: 'var(--tint)',
            }}
          >
            <input
              type="checkbox"
              checked={dep.includes(x)}
              onChange={(e) =>
                setDep((d) => (e.target.checked ? [...d, x] : d.filter((y) => y !== x)))
              }
            />{' '}
            {x}
          </label>
        ))}
      </div>

      <Banner
        kind="b"
        icon="⚖"
        title={<span style={{ fontSize: '12.5px' }}>Pairing a stage with its own QC is allowed</span>}
        style={{ margin: '16px 0 0' }}
      >
        <span style={{ fontSize: '12.5px' }}>
          Someone in both Typing and Typing QC will simply be filtered out of QC on any order they
          typed.
        </span>
      </Banner>

      <div style={{ marginTop: 18 }}>
        <Label>Contact</Label>
      </div>
      <div className="frm">
        <div className="fld">
          <label htmlFor="s-mob">Mobile</label>
          <input className="inp mono" id="s-mob" placeholder="+91 98765 43210" autoComplete="off" value={mob} onChange={(e) => setMob(e.target.value)} />
        </div>
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="s-addr">Address</label>
          <input className="inp" id="s-addr" placeholder="Street, area, city, PIN" autoComplete="off" value={addr} onChange={(e) => setAddr(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>In an emergency</Label>
      </div>
      <p className="gr" style={{ fontSize: '12.5px', margin: '-4px 0 10px' }}>
        The one part of a personnel record read in a hurry, by someone who has never opened it
        before.
      </p>
      <div className="frm">
        <div className="fld">
          <label htmlFor="s-en">Who to call</label>
          <input className="inp" id="s-en" placeholder="Full name" autoComplete="off" value={emgN} onChange={(e) => setEmgN(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="s-er">Relationship</label>
          <input className="inp" id="s-er" placeholder="Spouse" autoComplete="off" value={emgRel} onChange={(e) => setEmgRel(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="s-em">Their number</label>
          <input className="inp mono" id="s-em" placeholder="+91 98765 43210" autoComplete="off" value={emgMob} onChange={(e) => setEmgMob(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Label>Pay and statutory</Label>
      </div>
      <p className="gr" style={{ fontSize: '12.5px', margin: '-4px 0 10px' }}>
        Payroll cannot run without these. No joining date makes the first month and gratuity wrong;
        no account number means the bank file has nowhere to send the money.
      </p>
      <div className="frm">
        <div className="fld">
          <label htmlFor="s-ctc">Cost to company</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="gr">{pay.sym}</span>
            <input className="inp mono" id="s-ctc" type="number" min={0} step={1000} placeholder="360000" value={ctc} onChange={(e) => setCtc(e.target.value)} />
          </div>
          <div className="hint">A year. Basic, HRA, PF and gratuity are all derived from it.</div>
        </div>
        <div className="fld">
          <label htmlFor="s-doj">Date of joining</label>
          <input className="inp mono" id="s-doj" placeholder={fmtDate(now())} autoComplete="off" value={doj} onChange={(e) => setDoj(e.target.value)} />
          <div className="hint">Drives the first month’s pro-rata, leave accrual and gratuity.</div>
        </div>
        <div className="fld">
          <label htmlFor="s-acct">Bank account</label>
          <input className="inp mono" id="s-acct" placeholder="50100012345678" autoComplete="off" value={acct} onChange={(e) => setAcct(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="s-ifsc">IFSC</label>
          <input className="inp mono" id="s-ifsc" placeholder="HDFC0000123" autoComplete="off" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="s-pan">PAN</label>
          <input className="inp mono" id="s-pan" placeholder="ABCPS1234D" autoComplete="off" value={pan} onChange={(e) => setPan(e.target.value)} />
          <div className="hint">
            Without it TDS comes off at the higher rate and Form 16 cannot be issued.
          </div>
        </div>
        <div className="fld">
          <label htmlFor="s-uan">UAN</label>
          <input className="inp mono" id="s-uan" placeholder="100123456789" autoComplete="off" value={uan} onChange={(e) => setUan(e.target.value)} />
          <div className="hint">
            Their provident fund number, which follows them between employers.
          </div>
        </div>
        <div className="fld">
          <label htmlFor="s-esic">ESIC number</label>
          <input className="inp mono" id="s-esic" placeholder="3100123456789" autoComplete="off" value={esicNo} onChange={(e) => setEsicNo(e.target.value)} />
          <div className="hint">
            Only applies below the {inr(pay.esiGrossLimit)} gross limit, but keep it on file either
            way.
          </div>
        </div>
        <div className="fld">
          <label htmlFor="s-aad">Aadhaar</label>
          <input className="inp mono" id="s-aad" placeholder="1234 5678 9012" autoComplete="off" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} />
          <div className="hint">
            Held because PF and ESIC filings ask for it. Shown masked everywhere else.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        {id ? (
          <Btn variant="danger" onClick={() => onRemove(id)}>
            Remove
          </Btn>
        ) : null}
        <Btn onClick={submit}>{id ? 'Save changes' : 'Add staff'}</Btn>
      </div>
    </>
  )
}

/** Removing somebody. Disabling keeps the history; removing does not. */
export function StaffDelete({
  id,
  onCancel,
  onDone,
}: {
  id: string
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const staff = useStaff()
  const s = staff.find((x) => x.id === id)
  if (!s) return null

  return (
    <>
      <p style={{ fontSize: '13.5px' }}>
        <b>{s.n}</b> works {s.dep.join(', ') || 'no department'}
        {s.cap ? ` with a target of ${s.cap} a day` : ''}.
      </p>
      <Banner kind="r" icon="⚑" style={{ marginTop: 14 }}>
        <span style={{ fontSize: '12.5px' }}>
          Disabling them keeps their payslips, attendance and the work they did. Removing takes the
          record away, and the day re-runs without them.
        </span>
      </Banner>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          variant="danger"
          onClick={() => {
            removeStaff(id)
            onDone(`${s.n} removed`)
          }}
        >
          Remove {s.n}
        </Btn>
      </div>
    </>
  )
}
