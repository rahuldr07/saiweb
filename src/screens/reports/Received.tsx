import { useState } from 'react'
import { Card, Label, SectionHead } from '@/components/ui'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusHead, FocusKpis } from '@/components/FocusKpis'
import { DayPicker } from './DayPicker'
import { board, curStage, type Arrival } from '@/lib/engine'
import { ASSIGN_STAGES, STAGES } from '@/data/org'
import { CLIENTS, PRODUCTS } from '@/data/catalog'
import { money } from '@/lib/format'
import { now } from '@/lib/clock'
import { fmtDate } from '@/lib/format'

const val = (n: number) => (n ? <b className="mono">{n}</b> : <span className="gr">—</span>)

/** What came in, from whom, and what kind. */
export function Received() {
  const { run } = board()
  const [day, setDay] = useState(() => fmtDate(now()))
  const [focus, setFocus] = useState('all')

  const os = day === 'all' ? run.orders : run.orders.filter((o) => o.dk === day)
  const scope = day === 'all' ? `all ${run.days.length} days` : day
  const stageOf = curStage

  const done = os.filter((o) => !stageOf(o)).length
  const wip = os.length - done
  const clients = [...new Set(os.map((o) => o.cl))].sort()
  const products = PRODUCTS.map((p) => p.id).filter((id) => os.some((o) => o.pr === id))
  const cell = (c: string, st: string) => os.filter((o) => o.cl === c && stageOf(o) === st).length

  const COLS = '110px 150px 130px 150px 1fr 130px'
  const orderRows = (list: Arrival[]) => (
    <FlexTable cols={COLS} min={880} head={['Arrived', 'Order', 'Client', 'Product', 'Where it is now', 'County']}>
      {list.map((o) => {
        const st = stageOf(o)
        return (
          <FlexRow cols={COLS} key={o.id}>
            <Cell v={`${o.hr}:00`} s={o.dk} mono />
            <Cell v={o.id} mono />
            <Cell v={o.cl} />
            <Cell v={o.pr} />
            {st ? (
              <Cell v={st} s={`stage ${ASSIGN_STAGES.indexOf(st) + 1} of ${ASSIGN_STAGES.length}`} />
            ) : (
              <Cell v="Completed" tone="ok" s={`all ${ASSIGN_STAGES.length} stages done`} />
            )}
            <Cell v={o.co || o.st} />
          </FlexRow>
        )
      })}
    </FlexTable>
  )

  const quiet = CLIENTS.filter((c) => !clients.includes(c.n))

  return (
    <>
      <DayPicker value={day} onChange={setDay} />

      <FocusKpis
        focus={focus}
        onFocus={setFocus}
        cards={[
          { key: 'all', title: 'Orders received', value: os.length, detail: scope, count: os.length },
          {
            key: 'done',
            title: 'Completed',
            value: <span className="ok">{done}</span>,
            detail: `${os.length ? Math.round((done / os.length) * 100) : 0}% of intake`,
            count: done,
          },
          {
            key: 'wip',
            title: 'Work in progress',
            value: <span className={wip ? 'warn' : ''}>{wip}</span>,
            tone: wip ? 'warn' : undefined,
            detail: 'still moving through the stages',
            count: wip,
          },
          {
            key: 'clients',
            title: 'Clients ordering',
            value: clients.length,
            detail: `of ${CLIENTS.length} on the books`,
            count: clients.length,
          },
        ]}
      />

      {focus === 'clients' ? (
        <>
          <FocusHead
            title={`${clients.length} client${clients.length === 1 ? '' : 's'} ordered — ${scope}`}
            onBack={() => setFocus('all')}
          >
            {quiet.length
              ? `${quiet.length} on the books sent nothing.`
              : 'Every client on the books ordered.'}{' '}
            Volume alone does not say who matters; the value column does.
          </FocusHead>

          <SectionHead>Who ordered</SectionHead>
          <FlexTable
            cols="190px 120px 1fr 130px 140px"
            min={760}
            head={['Client', 'Orders', 'Share of intake', 'Value', 'Terms']}
          >
            {clients.map((n) => {
              const mine = os.filter((o) => o.cl === n)
              const rec = CLIENTS.find((c) => c.n === n)
              const value = mine.reduce((a, o) => a + (PRODUCTS.find((p) => p.id === o.pr)?.fee ?? 0), 0)
              const pct = Math.round((mine.length / os.length) * 100)
              return (
                <FlexRow cols="190px 120px 1fr 130px 140px" key={n}>
                  <Cell v={n} />
                  <Cell v={mine.length} mono />
                  <Cell>
                    <span className="bar" style={{ marginTop: 5 }}>
                      <i style={{ width: `${pct}%`, background: 'var(--brand2)' }} />
                    </span>
                    <div className="s">{pct}%</div>
                  </Cell>
                  <Cell v={money(value)} mono />
                  <Cell v={rec?.terms ?? '—'} tone="gr" />
                </FlexRow>
              )
            })}
          </FlexTable>

          {quiet.length ? (
            <>
              <SectionHead>On the books, but nothing {scope}</SectionHead>
              <Card padded>
                <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
                  {quiet.map((c) => (
                    <div className="rw" key={c.n}>
                      <span className="gr">·</span>
                      <span>
                        <b>{c.n}</b>
                        <div className="sd gr">
                          {c.orders.toLocaleString()} orders all time · terms {c.terms}
                        </div>
                      </span>
                      <span />
                    </div>
                  ))}
                </div>
                <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
                  A quiet day is not a lost client, but a quiet fortnight usually is. This is the list worth
                  checking against.
                </p>
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {focus === 'done' || focus === 'wip' ? (
        <>
          {(() => {
            const list = focus === 'done' ? os.filter((o) => !stageOf(o)) : os.filter((o) => stageOf(o))
            return (
              <>
                <FocusHead
                  title={
                    focus === 'done'
                      ? `The ${list.length} completed — ${scope}`
                      : `The ${list.length} still in progress — ${scope}`
                  }
                  onBack={() => setFocus('all')}
                >
                  {focus === 'wip'
                    ? 'Grouped by the stage each one is sitting in right now.'
                    : 'Through every department and ready to send.'}
                </FocusHead>
                {focus === 'wip'
                  ? ASSIGN_STAGES.filter((st) => list.some((o) => stageOf(o) === st)).map((st) => {
                      const g = list.filter((o) => stageOf(o) === st)
                      return (
                        <div key={st}>
                          <SectionHead>
                            {st} — {g.length}
                          </SectionHead>
                          {orderRows(g)}
                        </div>
                      )
                    })
                  : (
                      <>
                        <SectionHead>Completed</SectionHead>
                        {orderRows(list)}
                      </>
                    )}
              </>
            )
          })()}
        </>
      ) : null}

      {focus === 'all' ? (
        <>
          <SectionHead>By client and stage — where every order is sitting right now</SectionHead>
          <Card>
            <div className="tsc">
              <table className="mat" style={{ minWidth: 880 }}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Received</th>
                    {STAGES.map((c) => (
                      <th key={c} style={{ textAlign: 'right' }}>
                        {c}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Completed</th>
                    <th style={{ textAlign: 'right' }}>WIP</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length ? (
                    clients.map((c) => {
                      const mine = os.filter((o) => o.cl === c)
                      const cd = mine.filter((o) => !stageOf(o)).length
                      return (
                        <tr key={c}>
                          <td>
                            <b>{c}</b>
                          </td>
                          <td className="n">{val(mine.length)}</td>
                          {STAGES.map((st) => (
                            <td className="n" key={st} title={`${c} — ${cell(c, st)} in ${st}`}>
                              {val(cell(c, st))}
                            </td>
                          ))}
                          <td className="n">
                            {cd ? <b className="mono ok">{cd}</b> : <span className="gr">—</span>}
                          </td>
                          <td className="tot">{mine.length - cd || '—'}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={STAGES.length + 4}
                        className="gr"
                        style={{ padding: 22, textAlign: 'center' }}
                      >
                        No orders received on {scope}.
                      </td>
                    </tr>
                  )}
                  {clients.length ? (
                    <tr>
                      <td style={{ fontWeight: 700 }}>All clients</td>
                      <td className="tot">{os.length}</td>
                      {STAGES.map((st) => (
                        <td className="tot" key={st}>
                          {os.filter((o) => stageOf(o) === st).length || '—'}
                        </td>
                      ))}
                      <td className="tot">{done || '—'}</td>
                      <td className="tot corner">{wip || '—'}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            A stage column counts orders <i>currently</i> in that stage, so the stage columns plus Completed
            equal Received. Doc Req is raised by hand when a document is missing, which is why it is usually
            empty.
          </p>

          <SectionHead>By client and product — what kind of work came in</SectionHead>
          <Card>
            <div className="tsc">
              <table className="mat" style={{ minWidth: 260 + products.length * 72 }}>
                <thead>
                  <tr>
                    <th>Client</th>
                    {products.map((p) => (
                      <th
                        key={p}
                        style={{ textAlign: 'right' }}
                        title={PRODUCTS.find((x) => x.id === p)?.n ?? p}
                      >
                        {p}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const mine = os.filter((o) => o.cl === c)
                    return (
                      <tr key={c}>
                        <td>
                          <b>{c}</b>
                        </td>
                        {products.map((p) => (
                          <td className="n" key={p} title={`${c} · ${p}`}>
                            {val(mine.filter((o) => o.pr === p).length)}
                          </td>
                        ))}
                        <td className="tot">{mine.length}</td>
                      </tr>
                    )
                  })}
                  {clients.length ? (
                    <tr>
                      <td style={{ fontWeight: 700 }}>All clients</td>
                      {products.map((p) => (
                        <td className="tot" key={p}>
                          {os.filter((o) => o.pr === p).length || '—'}
                        </td>
                      ))}
                      <td className="tot corner">{os.length}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          {products.length ? (
            <Card padded style={{ marginTop: 14 }}>
              <Label>Product mix — {scope}</Label>
              {products
                .map((p) => ({ p, n: os.filter((o) => o.pr === p).length }))
                .sort((a, b) => b.n - a.n)
                .map((r) => (
                  <div
                    key={r.p}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '170px 1fr 74px',
                      gap: 12,
                      alignItems: 'center',
                      padding: '5px 0',
                      fontSize: '12.5px',
                    }}
                  >
                    <span className="gr">
                      {r.p} <span style={{ fontSize: '11.5px' }}>{PRODUCTS.find((x) => x.id === r.p)?.n}</span>
                    </span>
                    <span className="bar">
                      <i
                        style={{
                          width: `${os.length ? Math.round((r.n / os.length) * 100) : 0}%`,
                          background: 'var(--brand2)',
                        }}
                      />
                    </span>
                    <span className="mono" style={{ textAlign: 'right' }}>
                      {r.n} · {os.length ? Math.round((r.n / os.length) * 100) : 0}%
                    </span>
                  </div>
                ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  )
}
