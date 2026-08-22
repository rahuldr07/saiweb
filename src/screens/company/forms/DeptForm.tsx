import { useState } from 'react'
import { Banner, Btn } from '@/components/ui'
import { board } from '@/lib/engine'
import { removeDept, saveDept, useDepartments, useStaff } from '@/state/company'

/**
 * A department.
 *
 * Two settings do real work. Whether it is in the pipeline decides if every order
 * needs it, and what it QCs decides who may not be given it — a QC stage never
 * goes to whoever did the stage it checks.
 */
export function DeptForm({
  id,
  onCancel,
  onDone,
  onRemove,
}: {
  id?: string
  onCancel: () => void
  onDone: (message: string) => void
  onRemove: (id: string) => void
}) {
  const depts = useDepartments()
  const staff = useStaff()
  const { dwork } = board()

  const d = depts.find((x) => x.id === id)
  const [n, setN] = useState(d?.n ?? '')
  const [desc, setDesc] = useState(d?.desc ?? '')
  const [auto, setAuto] = useState(d?.auto ?? true)
  const [pair, setPair] = useState(d?.pair ?? '')
  const [error, setError] = useState<string | null>(null)

  /* Only stages that are not themselves a QC can be checked — QC of a QC is not
     a thing the pipeline expresses. */
  const others = depts.filter((x) => x.id !== id && !x.pair)

  const submit = () => {
    const name = n.trim()
    if (!name) return setError('A name is required.')
    if (depts.some((x) => x.id !== id && x.n.toLowerCase() === name.toLowerCase()))
      return setError(`There is already a department called ${name}.`)
    if (pair === name) return setError('A department cannot check itself.')
    saveDept({ n: name, desc: desc.trim(), auto, pair: pair || null, qc: !!pair }, id)
    onDone(id ? `${name} saved` : `${name} added`)
  }

  const people = d ? staff.filter((s) => s.dep.includes(d.n) && s.active !== false).length : 0
  const load = d ? (dwork[d.n]?.tot ?? 0) : 0

  return (
    <>
      {error ? (
        <Banner kind="d" icon="⚑" style={{ marginBottom: 14 }}>
          {error}
        </Banner>
      ) : null}

      <div className="frm">
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="d-n">Name</label>
          <input
            className="inp"
            id="d-n"
            placeholder="e.g. Municipal search"
            autoComplete="off"
            value={n}
            onChange={(e) => {
              setN(e.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="d-d">What it does</label>
          <input
            className="inp"
            id="d-d"
            placeholder="One line, shown on the departments list"
            autoComplete="off"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div className="fld">
          <label htmlFor="d-a">How work reaches it</label>
          <select
            className="inp"
            id="d-a"
            value={auto ? '1' : '0'}
            onChange={(e) => setAuto(e.target.value === '1')}
          >
            <option value="1">Every order, in pipeline order</option>
            <option value="0">On demand — an exception branch</option>
          </select>
          <div className="hint">
            Pipeline stages are assigned automatically. An exception branch is only used when an
            order needs it.
          </div>
        </div>
        <div className="fld">
          <label htmlFor="d-p">Is it a QC of another stage?</label>
          <select className="inp" id="d-p" value={pair} onChange={(e) => setPair(e.target.value)}>
            <option value="">No — it does its own work</option>
            {others.map((x) => (
              <option key={x.id} value={x.n}>
                Yes — it checks {x.n}
              </option>
            ))}
          </select>
          <div className="hint">A QC stage never goes to whoever did the stage it checks.</div>
        </div>
      </div>

      {d ? (
        <Banner kind="b" icon="◔" style={{ margin: '16px 0 0' }}>
          <span style={{ fontSize: '12.5px' }}>
            <b>{people} people</b> belong to {d.n}
            {load ? `, carrying ${load} stage tasks today` : ''}.
          </span>
        </Banner>
      ) : (
        <Banner
          kind="r"
          icon="⚑"
          title={<span style={{ fontSize: '12.5px' }}>A new department starts with nobody in it</span>}
          style={{ margin: '16px 0 0' }}
        >
          <span style={{ fontSize: '12.5px' }}>
            If you make it part of the pipeline, every order will need it and none of them will find
            an owner until you add staff. Those show up as exceptions, not as silent failures.
          </span>
        </Banner>
      )}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        {id ? (
          <Btn variant="danger" onClick={() => onRemove(id)}>
            Remove
          </Btn>
        ) : null}
        <Btn onClick={submit}>{id ? 'Save changes' : 'Add department'}</Btn>
      </div>
    </>
  )
}

/** Removing a department, with what it takes with it stated first. */
export function DeptDelete({
  id,
  onCancel,
  onDone,
}: {
  id: string
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const depts = useDepartments()
  const staff = useStaff()
  const { dwork } = board()
  const d = depts.find((x) => x.id === id)
  if (!d) return null

  const people = staff.filter((s) => s.dep.includes(d.n))
  const work = dwork[d.n]?.tot ?? 0
  const checkedBy = depts.filter((x) => x.pair === d.n).map((x) => x.n)

  return (
    <>
      <p style={{ fontSize: '13.5px' }}>
        {people.length
          ? `${people.length} ${people.length === 1 ? 'person' : 'people'} would lose ${d.n} from their departments.`
          : 'Nobody belongs to it.'}
        {work ? ` It is carrying ${work} stage tasks today.` : ''}
      </p>
      {checkedBy.length ? (
        <Banner kind="d" icon="⚑" style={{ marginTop: 14 }}>
          <span style={{ fontSize: '12.5px' }}>
            {checkedBy.join(', ')} check{checkedBy.length === 1 ? 's' : ''} {d.n}. That pairing goes
            with it, and the self-review rule stops applying to those stages.
          </span>
        </Banner>
      ) : null}
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn
          variant="danger"
          onClick={() => {
            removeDept(id)
            onDone(`${d.n} removed`)
          }}
        >
          Remove {d.n}
        </Btn>
      </div>
    </>
  )
}
