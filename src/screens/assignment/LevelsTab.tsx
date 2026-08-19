/**
 * Assignment → Levels. A level is one coverage — the products, states and counties
 * everyone on it can be given — and it governs Search and Search QC only, the
 * stages where local knowledge is what is being bought.
 */
import { useState } from 'react'
import { Avatar, Banner, Btn, Card, Chip, Empty, Rows } from '@/components/ui'
import { useLevels } from '@/state/levels'
import { useUi } from '@/state/ui'
import { COVSTAGES, EVERYSTATE, stateName } from '@/lib/coverage'
import { PRODUCTS } from '@/data/catalog'
import { STAFF } from '@/data/people'
import { RUN } from '@/lib/engine'
import type { Gap } from '@/lib/coverage'

/** A ticked/unticked run of pills with All and None beside the count. */
function PillRow({
  label,
  count,
  total,
  onAll,
  onNone,
  children,
}: {
  label: string
  count: number
  total: number
  onAll: () => void
  onNone: () => void
  children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
        <div className="lb" style={{ margin: 0 }}>
          {label}
        </div>
        <span className="gr" style={{ fontSize: '11.5px' }}>
          {count} of {total}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Btn variant="ghost" small disabled={count === total} title={count === total ? 'Already all of them' : undefined} onClick={onAll}>
            All
          </Btn>
          <Btn variant="ghost" small disabled={count === 0} title={count === 0 ? 'Already none' : undefined} onClick={onNone}>
            None
          </Btn>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function AddCountyForm({ st, onDone }: { st: string; onDone: (msg: string) => void }) {
  const { addCounty, countiesIn } = useLevels()
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const have = countiesIn(st).length

  return (
    <>
      <div className="frm">
        <div className="fld">
          <label htmlFor="lc-n">County name</label>
          <input
            className="inp"
            id="lc-n"
            placeholder="Allegheny"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="fld">
          <label>State</label>
          <div className="ro mono">
            {st} — {stateName(st)}
          </div>
        </div>
      </div>
      {err ? (
        <Banner kind="r" icon="⚠" style={{ margin: '12px 0 0' }}>
          {err}
        </Banner>
      ) : null}
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        It is added to the county list with no links on file, so it shows up under <b>Counties</b> as something to
        fill in.{' '}
        {have
          ? `${stateName(st)} currently has ${have} on file.`
          : `This would be the first county on file for ${stateName(st)}.`}
      </p>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn
          onClick={() => {
            const r = addCounty(st, name)
            if (!r.ok) return setErr(r.error)
            onDone(`${name.trim()} added to ${stateName(st)}`)
          }}
        >
          Add county
        </Btn>
      </div>
    </>
  )
}

export function LevelsTab() {
  const lv = useLevels()
  const { openModal, closeModal, toast } = useUi()
  const {
    levels,
    selected,
    select,
    setCov,
    setCounty,
    onLevel,
    countiesIn,
    allStates,
    coverageGaps,
    levelSentence,
    personLevel,
  } = lv

  const level = levels.find((l) => l.id === selected) ?? levels[0]
  const gaps = coverageGaps()
  const eligible = STAFF.filter((x) => x.dep.some((d) => COVSTAGES.includes(d)) && x.active !== false)
  const ungraded = eligible.filter((x) => !personLevel(x.id))
  const covExc = RUN.exc.filter((e) => e.today && e.why === 'coverage')

  const showGaps = (kind: Gap['kind']) => {
    const list = gaps.filter((g) => g.kind === kind)
    const noun = kind === 'place' ? 'county' : 'product'
    if (!list.length)
      return openModal({
        title: `Every ${noun} is covered`,
        body: (
          <>
            <Rows>
              {COVSTAGES.map((s) => (
                <div className="rw" key={s}>
                  <span className="ok">✓</span>
                  <span>
                    <b>{s}</b>
                    <div className="sd">
                      {kind === 'place'
                        ? `all ${lv.counties.length} counties have somebody`
                        : `all ${PRODUCTS.length} products have somebody`}
                    </div>
                  </span>
                  <span />
                </div>
              ))}
            </Rows>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 14 }}>
              Nothing will hold for want of somebody qualified. This is the number to watch when you narrow
              someone — it is the first thing that moves.
            </p>
          </>
        ),
      })

    openModal({
      title: `No ${kind === 'place' ? 'counties' : 'products'} cover — ${list.length}`,
      body: (
        <>
          <Rows>
            {list.map((g, i) => (
              <div className="rw" key={i}>
                <span className="bad">⚑</span>
                <span>
                  <b>
                    {g.stage} · {g.kind === 'place' ? `${g.co}, ${g.st}` : g.pr}
                  </b>
                  <div className="sd">
                    {g.kind === 'place'
                      ? g.near.length
                        ? `${g.near.length} cover ${g.st} elsewhere — ${g.near
                            .slice(0, 3)
                            .map((id) => STAFF.find((s) => s.id === id)?.n)
                            .join(', ')}`
                        : `nobody covers ${g.st} at all`
                      : 'nobody in this stage works it'}
                  </div>
                </span>
                <span>
                  <Chip kind="d">gap</Chip>
                </span>
              </div>
            ))}
          </Rows>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 14 }}>
            Each of these becomes an exception the moment an order arrives for it. Closing the gap is widening
            somebody's coverage, or hiring for it.
          </p>
        </>
      ),
      footer: <Btn onClick={closeModal}>Close</Btn>,
    })
  }

  if (!levels.length || !level)
    return (
      <Card>
        <Empty
          icon="◈"
          action={
            <Btn small onClick={() => { lv.addLevel(); toast('Level 1 added — it covers nothing until you say what') }}>
              ＋ Create the first level
            </Btn>
          }
        >
          No levels yet. A level is one coverage — the products, states and counties everyone on it can be given.
        </Empty>
      </Card>
    )

  const prodsOn = level.products === 'all' ? PRODUCTS.length : level.products.length
  const chosenStates = level.states === 'all' ? EVERYSTATE() : level.states
  const rest = EVERYSTATE().filter((x) => !chosenStates.includes(x))
  const shownStates = level.states === 'all' ? allStates() : level.states
  const held = onLevel(level.id)

  return (
    <>
      <div className="fbar" role="group" aria-label="Levels">
        {levels.map((l) => (
          <button
            key={l.id}
            className={`pill ${l.id === level.id ? 'on' : ''}`}
            aria-pressed={l.id === level.id}
            onClick={() => select(l.id)}
          >
            {l.n}
            <span className="n">{onLevel(l.id).length}</span>
          </button>
        ))}
        <div className="sp">
          <Btn small onClick={() => { lv.addLevel(); toast('Level added — it covers nothing until you say what') }}>
            ＋ New level
          </Btn>
        </div>
      </div>

      {covExc.length || gaps.length ? (
        <Banner
          kind={covExc.length ? 'r' : 'd'}
          icon="⚑"
          title={[
            covExc.length ? `${covExc.length} order${covExc.length === 1 ? '' : 's'} held today` : '',
            gaps.length ? `${gaps.length} gap${gaps.length === 1 ? '' : 's'} nobody covers` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          actions={gaps.length ? <Btn variant="ghost" small onClick={() => showGaps('place')}>The gaps</Btn> : undefined}
        >
          {gaps.length
            ? `Nothing can be given for ${gaps
                .slice(0, 3)
                .map((g) => (g.kind === 'place' ? `${g.co}, ${g.st}` : g.pr))
                .join(', ')}${gaps.length > 3 ? ` and ${gaps.length - 3} more` : ''}.`
            : 'Every county and product has somebody. '}
          {covExc.length ? ' Held work is on the Exceptions tab.' : ''}
        </Banner>
      ) : null}

      <Card padded>
        <div className="frm">
          <div className="fld">
            <label htmlFor="lv-n">Level name</label>
            <input
              className="inp"
              id="lv-n"
              defaultValue={level.n}
              key={`n-${level.id}`}
              onBlur={(e) => lv.rename(level.id, e.target.value)}
            />
          </div>
          <div className="fld">
            <label htmlFor="lv-note">What it means</label>
            <input
              className="inp"
              id="lv-note"
              defaultValue={level.note ?? ''}
              key={`note-${level.id}`}
              placeholder="Learning — the counties they have been shown"
              onBlur={(e) => lv.setNote(level.id, e.target.value)}
            />
          </div>
        </div>

        <PillRow
          label="Products"
          count={prodsOn}
          total={PRODUCTS.length}
          onAll={() => setCov(level.id, 'allproducts')}
          onNone={() => setCov(level.id, 'noproducts')}
        >
          {PRODUCTS.map((pr) => {
            const on = level.products === 'all' || level.products.includes(pr.id)
            return (
              <button
                key={pr.id}
                className={`pill ${on ? 'on' : ''}`}
                aria-pressed={on}
                title={pr.n}
                onClick={() => setCov(level.id, 'product', pr.id)}
              >
                {pr.id}
              </button>
            )
          })}
        </PillRow>

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9, flexWrap: 'wrap' }}>
            <div className="lb" style={{ margin: 0 }}>
              States
            </div>
            <span className="gr" style={{ fontSize: '11.5px' }}>
              {level.states === 'all' ? 'every state' : `${chosenStates.length} of ${EVERYSTATE().length}`}
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                className="inp"
                aria-label={`Add a state to ${level.n}`}
                style={{ minWidth: 170, fontSize: '12.5px' }}
                value=""
                disabled={!rest.length}
                onChange={(e) => e.target.value && setCov(level.id, 'addstate', e.target.value)}
              >
                <option value="">{rest.length ? '＋ Add a state…' : 'every state already'}</option>
                {rest.map((st) => (
                  <option key={st} value={st}>
                    {st} — {stateName(st)}
                    {countiesIn(st).length ? ` (${countiesIn(st).length} counties on file)` : ''}
                  </option>
                ))}
              </select>
              <Btn
                variant="ghost"
                small
                disabled={level.states === 'all'}
                title={level.states === 'all' ? 'Already every state' : undefined}
                onClick={() => setCov(level.id, 'allstates')}
              >
                All
              </Btn>
              <Btn
                variant="ghost"
                small
                disabled={!chosenStates.length}
                title={!chosenStates.length ? 'Already none' : undefined}
                onClick={() => setCov(level.id, 'nostates')}
              >
                None
              </Btn>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {level.states === 'all' ? (
              <span className="gr" style={{ fontSize: '13.5px' }}>
                Every state in the country — including any you have not taken work in yet.
              </span>
            ) : chosenStates.length ? (
              chosenStates.map((st) => (
                <button
                  key={st}
                  className="pill on"
                  aria-pressed="true"
                  title={`Remove ${stateName(st)}`}
                  onClick={() => setCov(level.id, 'state', st)}
                >
                  {st} ×
                </button>
              ))
            ) : (
              <span className="gr" style={{ fontSize: '13.5px' }}>
                No states yet — add one above.
              </span>
            )}
          </div>
        </div>

        {shownStates.length ? (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <div className="lb" style={{ margin: 0 }}>
                Counties
              </div>
              <span className="gr" style={{ fontSize: '11.5px' }}>
                a state with none unticked means the whole state
              </span>
            </div>
            {shownStates.map((st) => {
              const named = level.counties?.[st] ?? []
              const have = countiesIn(st)
              return (
                <div
                  key={st}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--hair)',
                  }}
                >
                  <span style={{ width: 126, flex: 'none', paddingTop: 4 }}>
                    <b className="mono" style={{ fontSize: '12.5px' }}>
                      {st}
                    </b>
                    <span className="gr" style={{ fontSize: '11.5px' }}>
                      {' '}
                      {stateName(st)}
                    </span>
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
                    {have.map((co) => {
                      const on = !named.length || named.includes(co)
                      return (
                        <button
                          key={co}
                          className={`pill ${on ? 'on' : ''}`}
                          aria-pressed={on}
                          onClick={() => setCounty(level.id, st, co)}
                        >
                          {co}
                        </button>
                      )
                    })}
                    {have.length ? null : (
                      <span className="gr" style={{ fontSize: '12.5px' }}>
                        No counties on file — this level covers the whole state.
                      </span>
                    )}
                    <Btn
                      variant="ghost"
                      small
                      title={`Add a county in ${stateName(st)}`}
                      onClick={() =>
                        openModal({
                          title: `Add a county in ${stateName(st)}`,
                          body: (
                            <AddCountyForm
                              st={st}
                              onDone={(msg) => {
                                closeModal()
                                toast(msg)
                              }}
                            />
                          ),
                        })
                      }
                    >
                      ＋ County
                    </Btn>
                  </div>
                  <span
                    className="gr"
                    style={{ fontSize: '11.5px', width: 76, textAlign: 'right', flex: 'none', paddingTop: 4 }}
                  >
                    {!have.length ? 'whole state' : named.length ? `${named.length} of ${have.length}` : 'all'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 16 }}>
            Add a state above to choose counties within it.
          </p>
        )}

        <Banner
          kind={prodsOn && shownStates.length ? 'n' : 'd'}
          icon={prodsOn && shownStates.length ? '·' : '⚑'}
          title={levelSentence(level)}
          style={{ marginTop: 20 }}
          actions={
            <Btn
              variant="ghost"
              small
              onClick={() => {
                const r = lv.remove(level.id)
                if (r.ok) return toast(`${level.n} removed`)
                openModal({
                  title: `${level.n} is in use`,
                  body: (
                    <>
                      <Rows>
                        {r.held.map((p) => (
                          <div className="rw" key={p.id}>
                            <Avatar name={p.n} />
                            <span>
                              <b>{p.n}</b>
                              <div className="sd">{p.dep.join(', ')}</div>
                            </span>
                            <span className="gr" style={{ fontSize: '12.5px' }}>
                              on this level
                            </span>
                          </div>
                        ))}
                      </Rows>
                      <p className="gr" style={{ fontSize: '12.5px', marginTop: 14 }}>
                        Move these people to another level first. Removing a level out from under somebody would
                        silently widen what they can be given, which is the one change nobody would notice.
                      </p>
                    </>
                  ),
                })
              }}
            >
              Delete level
            </Btn>
          }
        >
          {held.length
            ? `${held.length} ${held.length === 1 ? 'person is' : 'people are'} on this level, so a change here moves ${held.length === 1 ? 'them' : 'them all'} tonight.`
            : 'Nobody is on this level yet, so changing it moves nobody.'}
        </Banner>
      </Card>

      <Card padded style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="lb" style={{ margin: 0 }}>
            Who is on {level.n}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="gr" style={{ fontSize: '11.5px' }} htmlFor="lv-add">
              Add somebody
            </label>
            <select
              className="inp"
              id="lv-add"
              style={{ minWidth: 200 }}
              value=""
              onChange={(e) => e.target.value && toast(lv.setPersonLevel(e.target.value, level.id))}
            >
              <option value="">— choose —</option>
              {eligible
                .filter((x) => personLevel(x.id) !== level.id)
                .map((x) => {
                  const cur = personLevel(x.id)
                  return (
                    <option key={x.id} value={x.id}>
                      {x.n} — {cur ? (levels.find((l) => l.id === cur)?.n ?? '') : 'no level'}
                    </option>
                  )
                })}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 13 }}>
          {held.length ? (
            held.map((x) => (
              <span
                key={x.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid var(--hair)',
                  borderRadius: 99,
                  padding: '5px 6px 5px 5px',
                  background: 'var(--tint)',
                }}
              >
                <Avatar name={x.n} style={{ width: 24, height: 24, fontSize: '9.5px' }} />
                <b style={{ fontSize: '12.5px' }}>{x.n}</b>
                <Btn
                  variant="ghost"
                  small
                  style={{ padding: '1px 7px' }}
                  title={`Take ${x.n} off ${level.n}`}
                  onClick={() => toast(lv.setPersonLevel(x.id, ''))}
                >
                  ×
                </Btn>
              </span>
            ))
          ) : (
            <span className="gr" style={{ fontSize: '13.5px' }}>
              Nobody yet — add someone above.
            </span>
          )}
        </div>
        {ungraded.length ? (
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 14 }}>
            <b>{ungraded.length} not on any level:</b> {ungraded.map((x) => x.n).join(', ')} — they are unrestricted
            until you put them on one.
          </p>
        ) : null}
      </Card>

      <Card padded style={{ marginTop: 16 }}>
        <div className="lb">The whole ladder</div>
        <div style={{ marginTop: 8 }}>
          <Rows>
            {levels.map((l) => (
              <div className="rw" key={l.id}>
                <span className="ava">{(l.n.match(/\d+/) ?? [l.n.slice(0, 2)])[0]}</span>
                <span>
                  <b>{l.n}</b>
                  <div className="sd gr">{levelSentence(l)}</div>
                </span>
                <span className="mono gr">{onLevel(l.id).length}</span>
              </div>
            ))}
          </Rows>
        </div>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          Levels govern <b>{COVSTAGES.join(' and ')}</b> only — the stages where local knowledge is what is being
          bought. Typing and RTS work from what the searcher found.
        </p>
      </Card>
    </>
  )
}
