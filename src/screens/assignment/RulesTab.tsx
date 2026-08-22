import { useCallback, useEffect, useRef, useState } from 'react'
import { Btn, Card, Chip, Kpi, Kpis, Label } from '@/components/ui'
import { useUi } from '@/state/ui'
import { useRules } from '@/state/rules'
import { ASSIGN_STAGES, ENGINEOPTS } from '@/data/org'
import { PRODUCTS } from '@/data/catalog'
import { STAFF } from '@/data/people'
import { EVERYSTATE, stateName } from '@/lib/coverage'
import { ruleMatches, type AssignmentBoard } from '@/lib/engine'
import {
  RULE_KIND,
  canRemove,
  ruleEffectParts,
  ruleProblem,
  ruleThen,
  ruleWhen,
  type RuleDraft,
} from '@/lib/rules'
import type { EngineConfig, Rule } from '@/data/types'

/**
 * The rules, in the order they run, and the two things you can do with them
 * before they touch anybody's queue: see what each one actually did today, and
 * try a change against today's orders without saving it.
 */

const blankDraft = (): RuleDraft => ({ n: '', k: 'route', on: true, cond: {}, pool: [] })

const draftOf = (r: Rule): RuleDraft => ({
  n: r.n,
  k: r.k,
  on: r.on,
  cond: { ...(r.cond ?? {}) },
  pool: [...(r.pool ?? [])],
})

export function RulesTab({ board, onTab }: { board: AssignmentBoard; onTab: (t: 'Levels') => void }) {
  const { openModal, closeModal, toast } = useUi()
  const { rules, engine, setEngine, toggle, save, remove, dryRun } = useRules()
  const { run } = board

  /* The editor's draft lives here rather than inside the modal, because the
     modal takes a body and a footer and both have to see the same draft. */
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)
  const [draft, setDraft] = useState<RuleDraft>(blankDraft)
  const [problem, setProblem] = useState<string | null>(null)

  const on = rules.filter((r) => r.on).length

  const showDryRun = useCallback(
    (d?: RuleDraft) => {
      const r = dryRun(d)
      const live = run.assigns.filter((a) => a.today).length
      const liveExc = run.exc.filter((e) => e.today).length
      openModal({
        title: d?.n ? `Dry run — ${d.n}, not saved` : 'Dry run — nothing was changed',
        body: (
          <>
            <Kpis style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Kpi
                title="Would place"
                value={r.placed}
                detail={
                  <span className={r.placed === live ? 'gr' : r.placed > live ? 'ok' : 'warn'}>
                    {r.placed === live
                      ? 'the same as now'
                      : `${r.placed > live ? '+' : ''}${r.placed - live} against now`}
                  </span>
                }
              />
              <Kpi
                title="Would leave unplaced"
                value={r.unplaced}
                tone={r.unplaced ? 'warn' : undefined}
                detail={
                  <span className="gr">
                    {r.unplaced === liveExc ? 'unchanged' : 'different from now'}
                  </span>
                }
              />
            </Kpis>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              Run against today’s {run.today.length} orders with the rules exactly as they stand. No
              queue was touched — this is what <i>would</i> happen.
            </p>
          </>
        ),
        footer: <Btn onClick={closeModal}>Close</Btn>,
      })
    },
    [dryRun, openModal, closeModal, run],
  )

  const ruleHistory = () =>
    openModal({
      title: 'Rule change history',
      body: (
        <>
          <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
            {rules.map((r) => (
              <div className="rw" key={r.id}>
                <span className={r.on ? 'ok' : 'gr'}>{r.on ? '✓' : '·'}</span>
                <span>
                  <b>{r.n}</b>
                  <div className="sd gr">
                    {r.on ? 'on' : 'off'} · {r.k} rule{r.lock ? ' · cannot be turned off' : ''}
                  </div>
                </span>
                <span className="mono gr">{run.fired[r.id] ?? 0} checks today</span>
              </div>
            ))}
          </div>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            This is the current state and how often each rule was consulted today.{' '}
            <b>A dated change log needs somewhere to store it</b> — nothing here writes to a database
            yet, so edits live only in this session.
          </p>
        </>
      ),
      footer: <Btn onClick={closeModal}>Close</Btn>,
    })

  const startEdit = (r?: Rule) => {
    setProblem(null)
    setDraft(r ? draftOf(r) : blankDraft())
    setEditing({ id: r?.id ?? null })
  }

  const stopEdit = useCallback(() => {
    setEditing(null)
    closeModal()
  }, [closeModal])

  const commit = useCallback(() => {
    const bad = ruleProblem(draft, rules, editing?.id ?? null)
    if (bad) return setProblem(bad)
    save(draft, editing?.id ?? null)
    toast(editing?.id ? `${draft.n.trim()} saved` : `${draft.n.trim()} added`)
    stopEdit()
  }, [draft, rules, editing, save, toast, stopEdit])

  /**
   * The editor's buttons, reached through a ref rather than through the effect's
   * dependencies.
   *
   * `useUi` rebuilds `closeModal` every time the modal changes, so anything
   * derived from it changes identity too. An effect that both depends on those
   * and opens the modal is a loop: open → modal state → new closeModal → deps
   * moved → open again. The handlers are read at click time instead, which is
   * the only moment they are needed.
   */
  const actions = useRef({ commit, stopEdit, showDryRun })
  useEffect(() => {
    actions.current = { commit, stopEdit, showDryRun }
  })

  /* Re-opened on every draft change so the preview below the form is live. The
     modal is one slot in the shell, so replacing the spec re-renders it. */
  useEffect(() => {
    if (!editing) return
    const locked = editing.id ? rules.find((r) => r.id === editing.id)?.lock : false
    const hits = run.orders.filter((o) =>
      ASSIGN_STAGES.some((st) => ruleMatches({ cond: draft.cond } as Rule, o, st)),
    ).length
    const noCond = !Object.keys(draft.cond).length
    const noPool = draft.k !== 'block' && !draft.pool.length

    const setCond = (k: 'stage' | 'product' | 'state', v: string) =>
      setDraft((d) => {
        const cond = { ...d.cond }
        if (v) cond[k] = v
        else delete cond[k]
        return { ...d, cond }
      })

    openModal({
      title: editing.id ? `Edit rule — ${rules.find((r) => r.id === editing.id)?.n ?? ''}` : 'New rule',
      body: (
        <>
          <div className="frm">
            <div className="fld" style={{ gridColumn: '1/-1' }}>
              <label htmlFor="ru-n">Name</label>
              <input
                className="inp"
                id="ru-n"
                value={draft.n}
                placeholder="e.g. Alaska searches to the courthouse pair"
                onChange={(e) => setDraft((d) => ({ ...d, n: e.target.value }))}
              />
            </div>
            <div className="fld">
              <label htmlFor="ru-k">What it does</label>
              <select
                className="inp"
                id="ru-k"
                disabled={locked}
                value={draft.k}
                onChange={(e) => setDraft((d) => ({ ...d, k: e.target.value as Rule['k'] }))}
              >
                <option value="route">Routes — only these people may take it</option>
                <option value="block">Blocks — nobody may take it</option>
                <option value="prefer">Prefers — pick these first</option>
              </select>
            </div>
            <div className="fld">
              <label htmlFor="ru-o">Active</label>
              <select
                className="inp"
                id="ru-o"
                disabled={locked}
                value={draft.on ? 'on' : 'off'}
                onChange={(e) => setDraft((d) => ({ ...d, on: e.target.value !== 'off' }))}
              >
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </div>
          </div>

          <div className="lb" style={{ marginTop: 18 }}>
            When an order matches all of these
          </div>
          <p className="gr" style={{ fontSize: '12.5px', margin: '0 0 10px' }}>
            Leave one as <b>any</b> to ignore it. This is the condition the engine runs — not a
            description of one.
          </p>
          <div className="frm">
            <div className="fld">
              <label htmlFor="ru-st">Stage</label>
              <select
                className="inp"
                id="ru-st"
                value={draft.cond.stage ?? ''}
                onChange={(e) => setCond('stage', e.target.value)}
              >
                <option value="">any stage</option>
                {ASSIGN_STAGES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div className="fld">
              <label htmlFor="ru-pr">Product</label>
              <select
                className="inp"
                id="ru-pr"
                value={draft.cond.product ?? ''}
                onChange={(e) => setCond('product', e.target.value)}
              >
                <option value="">any product</option>
                {PRODUCTS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="fld">
              <label htmlFor="ru-sta">State</label>
              <select
                className="inp"
                id="ru-sta"
                value={draft.cond.state ?? ''}
                onChange={(e) => setCond('state', e.target.value)}
              >
                <option value="">any state</option>
                {EVERYSTATE().map((x) => (
                  <option key={x} value={x}>
                    {x} — {stateName(x)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {draft.k !== 'block' ? (
            <div style={{ marginTop: 18 }}>
              <div className="lb">Who it routes to</div>
              <p className="gr" style={{ fontSize: '12.5px', margin: '0 0 10px' }}>
                Tick the people this rule allows. Narrowing it to nobody is how an order ends up with
                nowhere to go.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STAFF.filter((x) => x.dep.length && x.active !== false).map((p) => {
                  const picked = draft.pool.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pill ${picked ? 'on' : ''}`}
                      aria-pressed={picked}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          pool: picked ? d.pool.filter((x) => x !== p.id) : [...d.pool, p.id],
                        }))
                      }
                    >
                      {p.n}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Says what the rule will do before it does it, counted against today. */}
          <div className={`bnr ${noPool ? 'd' : noCond ? 'r' : 'n'}`} style={{ marginTop: 18 }}>
            <span className="bi">·</span>
            <div>
              <b>
                When {ruleWhen({ cond: draft.cond })} → {ruleThen({ k: draft.k, pool: draft.pool })}
              </b>
              <div className="bs">
                {noCond ? <b>No condition set, so this matches every order. </b> : null}
                Matches <b>{hits.toLocaleString()}</b> of today’s {run.orders.length.toLocaleString()}{' '}
                orders.{' '}
                {noPool ? (
                  <b>Nobody is ticked — every match would become an exception.</b>
                ) : null}
              </div>
            </div>
          </div>

          {problem ? (
            <div className="bnr r" style={{ margin: '14px 0 0' }}>
              <span className="bi">⚠</span>
              <div>{problem}</div>
            </div>
          ) : null}

          {locked ? (
            <div className="bnr r" style={{ margin: '14px 0 0' }}>
              <span className="bi">🔒</span>
              <div style={{ fontSize: '12.5px' }}>
                <div className="bt" style={{ fontSize: '12.5px' }}>
                  This rule cannot be switched off or retyped
                </div>
                {draft.k === 'prefer'
                  ? 'Something has to decide between two equally eligible people.'
                  : 'Assigning outside a department, or letting somebody check their own work, are the two things this system must never do.'}
              </div>
            </div>
          ) : null}

          <div className="bnr b" style={{ margin: '14px 0 0' }}>
            <span className="bi">◷</span>
            <div style={{ fontSize: '12.5px' }}>
              <div className="bt" style={{ fontSize: '12.5px' }}>
                Applies to new orders only
              </div>
              Changing a rule does not move work already in somebody’s queue. A dry run shows what it
              would do first.
            </div>
          </div>
        </>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={() => actions.current.stopEdit()}>
            Cancel
          </Btn>
          <Btn variant="ghost" onClick={() => actions.current.showDryRun(draft)}>
            Dry run
          </Btn>
          <Btn onClick={() => actions.current.commit()}>
            {editing.id ? 'Save rule' : 'Create rule'}
          </Btn>
        </>
      ),
    })
  }, [editing, draft, problem, rules, run, openModal])

  return (
    <>
      <div className="bnr b">
        <span className="bi">⚙</span>
        <div>
          <div className="bt">Applied in order, top to bottom — each one narrows what is left</div>
          {Object.entries(RULE_KIND).map(([k, v], i) => (
            <span key={k}>
              {i ? ' · ' : ''}
              <Chip kind={v[1]}>{v[0]}</Chip> {v[2]}
            </span>
          ))}
        </div>
        <div className="ba">
          <Btn onClick={() => startEdit()}>＋ Add rule</Btn>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="ch">
          <h2>Rules</h2>
          <div className="r gr" style={{ fontSize: '12.5px' }}>
            {on} of {rules.length} on
          </div>
        </div>
        <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
          {rules.map((r, i) => {
            const kind = RULE_KIND[r.k] ?? RULE_KIND.prefer
            return (
              <div className="rw" key={r.id} style={r.on ? undefined : { opacity: 0.55 }}>
                <span className="mono gr" style={{ width: 16, textAlign: 'right' }}>
                  {i + 1}
                </span>
                <span>
                  <b>{r.n}</b> <Chip kind={kind[1]}>{kind[0]}</Chip>
                  {r.lock ? (
                    <>
                      {' '}
                      <Chip>Locked</Chip>
                    </>
                  ) : null}
                  {r.on ? null : (
                    <>
                      {' '}
                      <Chip>Off</Chip>
                    </>
                  )}
                  <div className="sd">
                    When <b>{ruleWhen(r)}</b> → {ruleThen(r)}
                  </div>
                  <div className="sd gr">
                    {(() => {
                      const [before, em, after] = ruleEffectParts(
                        r,
                        run.fired[r.id] ?? 0,
                        run.narrowed[r.id],
                      )
                      return (
                        <>
                          {before}
                          {em ? <b>{em}</b> : null}
                          {after}
                        </>
                      )
                    })()}
                  </div>
                </span>
                <span style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                  <Btn
                    variant="ghost"
                    small
                    onClick={() => (r.k === 'cover' ? onTab('Levels') : startEdit(r))}
                  >
                    {r.k === 'cover' ? 'Levels' : 'Edit'}
                  </Btn>
                  {r.lock ? null : (
                    <Btn variant="ghost" small onClick={() => toggle(r.id)}>
                      {r.on ? 'Turn off' : 'Turn on'}
                    </Btn>
                  )}
                  {canRemove(r) ? (
                    <Btn
                      variant="ghost"
                      small
                      title={`Remove ${r.n}`}
                      onClick={() => {
                        const gone = remove(r.id)
                        if (gone) toast(`${gone.n} removed`)
                      }}
                    >
                      ×
                    </Btn>
                  ) : null}
                </span>
              </div>
            )
          })}
        </div>
        <div className="cb">
          <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
            <b>Department membership</b> and <b>self-review</b> cannot be switched off — doing so would
            let the system do something it should never do. <b>Fill the emptiest first</b> is locked for
            a different reason: there has to be some way to choose between two equally eligible people.
          </p>
        </div>
      </Card>

      <div className="two" style={{ marginTop: 18 }}>
        <Card padded>
          <Label>When the engine runs</Label>
          <div style={{ display: 'grid', gap: 14 }}>
            {(
              [
                ['trigger', 'Trigger'],
                ['commit', 'Commit'],
                ['onChange', 'If a rule changes'],
              ] as [keyof EngineConfig, string][]
            ).map(([k, label]) => {
              const opts = ENGINEOPTS[k]
              const cur = opts.find((o) => o[0] === engine[k]) ?? opts[0]
              return (
                <div className="fld" key={k}>
                  <label id={`eg-${k}`}>{label}</label>
                  <div className="seg" role="group" aria-labelledby={`eg-${k}`}>
                    {opts.map((o) => (
                      <button
                        key={o[0]}
                        type="button"
                        className={engine[k] === o[0] ? 'on' : ''}
                        aria-pressed={engine[k] === o[0]}
                        onClick={() => toast(setEngine(k, o[0] as EngineConfig[typeof k]))}
                      >
                        {o[1]}
                      </button>
                    ))}
                  </div>
                  <div className="hint">{cur[2]}</div>
                </div>
              )
            })}
            {engine.trigger !== 'arrival' || engine.commit !== 'auto' ? (
              <div className="bnr r" style={{ margin: 0 }}>
                <span className="bi">⚑</span>
                <div>
                  <b>The board still shows placement on arrival.</b> The setting is saved and would be
                  read by a real engine — this build only simulates the one behaviour, and drawing the
                  others would be inventing a result.
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        <Card padded>
          <Label>Test a change before it goes live</Label>
          <p className="gr" style={{ fontSize: '12.5px' }}>
            Run the current rules against today’s {run.today.length} orders and see what would move.
          </p>
          <Btn style={{ width: '100%', marginTop: 12 }} onClick={() => showDryRun()}>
            Dry run against today
          </Btn>
          <Btn variant="ghost" style={{ width: '100%', marginTop: 8 }} onClick={ruleHistory}>
            Rule change history
          </Btn>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            A dry run never touches anyone’s queue. It reports what the rules <i>would</i> have done.
          </p>
        </Card>
      </div>
    </>
  )
}
