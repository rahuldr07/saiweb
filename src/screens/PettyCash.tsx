import { useMemo, useRef } from 'react'
import { Banner, Btn, Card, Label, Kpi, Kpis, PageHead, Row, Rows, SectionHead } from '@/components/ui'
import { ErrorBoundary } from '@/components/async'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { fmtDate } from '@/lib/format'
import { inr } from '@/lib/payroll'
import { csvName, downloadCSV } from '@/lib/csv'
import {
  countDrift,
  countDue,
  daysSince,
  expectedAt,
  lastCount,
  overCeiling,
  pettyLedger,
  spentWithin,
  total,
  unvouched,
} from '@/lib/petty'
import { recordCount, recordEntry, setConfig, useBox } from './petty/store'
import { EntryForm } from './petty/EntryForm'
import { CountForm } from './petty/CountForm'

/**
 * Petty cash.
 *
 * The screen is built around one identity — previous + credit − debit = new
 * balance — shown on every row rather than summarised at the bottom, because
 * that is the only check that catches a mistake at the moment it is made.
 *
 * The three things that go wrong with a cash box each get a banner rather than a
 * column: nobody has counted it, money left with no voucher, and a payment large
 * enough that it should not have been cash at all.
 */

const LEDGER_COLS = '105px 1fr 150px 120px 120px 120px 130px'

/** Below this share of the float the box is close to empty and says so. */
const LOW = 0.2

function PettyCash() {
  const { me } = useSession()
  const { openModal, closeModal, toast } = useUi()
  const { entries, counts, cfg } = useBox()
  const countsPanel = useRef<HTMLDivElement>(null)

  const ledger = useMemo(() => pettyLedger(entries), [entries])
  const balance = ledger.length ? ledger[ledger.length - 1].after : 0
  const noReceipt = useMemo(() => unvouched(entries), [entries])
  const overLimit = useMemo(() => overCeiling(entries, cfg), [entries, cfg])
  const recent = useMemo(() => spentWithin(entries), [entries])
  const last = lastCount(counts)
  const due = countDue(counts, cfg)

  const focusCounts = () => {
    const el = countsPanel.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('lit')
    setTimeout(() => el.classList.remove('lit'), 1500)
  }

  /* ── the two things you can do to the box ──────────────────────────────── */

  const addEntry = () =>
    openModal({
      title: 'Petty cash entry',
      body: (
        <EntryForm
          balance={balance}
          cfg={cfg}
          onCancel={closeModal}
          onSubmit={(entry) => {
            const saved = recordEntry(entry)
            closeModal()
            toast(
              `Recorded — balance ${inr(
                saved.kind === 'credit' ? balance + saved.amt : balance - saved.amt,
              )}`,
            )
          }}
        />
      ),
    })

  const openCount = () =>
    openModal({
      title: 'Count the box',
      body: (
        <CountForm
          expected={balance}
          countedBy={me.n}
          onCancel={closeModal}
          onSubmit={(count) => {
            recordCount(count)
            closeModal()
            toast(
              count.counted === balance ? 'Counted — matches' : 'Counted — difference recorded',
            )
          }}
        />
      ),
    })

  /* ── what each tile opens ──────────────────────────────────────────────── */

  const showBalance = () =>
    openModal({
      title: 'What the box should hold',
      body: (
        <>
          <Rows>
            <Row
              icon={<span className="ok" style={{ fontSize: '14.5px' }}>✓</span>}
              title="Put in"
              detail={`${entries.filter((e) => e.kind === 'credit').length} top-ups including the opening float`}
              right={
                <span className="mono ok">
                  {inr(total(entries.filter((e) => e.kind === 'credit')))}
                </span>
              }
            />
            <Row
              icon={<span className="bad" style={{ fontSize: '14.5px' }}>⚑</span>}
              title="Paid out"
              detail={`${entries.filter((e) => e.kind === 'debit').length} payments`}
              right={
                <span className="mono bad">
                  −{inr(total(entries.filter((e) => e.kind === 'debit')))}
                </span>
              }
            />
          </Rows>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '13px 2px 0',
              fontSize: '14.5px',
              borderTop: '1px solid var(--hair)',
              marginTop: 10,
            }}
          >
            <b>Should be in the box</b>
            <b className="mono">{inr(balance)}</b>
          </div>
          <p className="gr" style={{ fontSize: '12.5px', margin: '14px 0 0' }}>
            <b>Previous + credit − debit = new balance</b>, checked on every single row.{' '}
            {last
              ? `Last actually counted on ${fmtDate(last.d)} by ${last.by}.`
              : 'Nobody has counted it yet.'}{' '}
            Until someone independent counts it, this is a figure rather than a fact.
          </p>
        </>
      ),
      footer: (
        <>
          <Btn
            variant="ghost"
            onClick={() => {
              closeModal()
              openCount()
            }}
          >
            Count the box
          </Btn>
          <Btn onClick={closeModal}>Close</Btn>
        </>
      ),
    })

  const showSpent = () =>
    openModal({
      title: `Paid out in the last 30 days — ${inr(total(recent))}`,
      body: (
        <>
          {recent.length ? (
            <Rows>
              {[...recent]
                .sort((a, b) => b.d.getTime() - a.d.getTime())
                .map((e) => {
                  const bad = !e.receipt || e.amt > cfg.limit
                  return (
                    <Row
                      key={e.id}
                      icon={
                        <span className={bad ? 'bad' : 'ok'} style={{ fontSize: '14.5px' }}>
                          {bad ? '⚑' : '✓'}
                        </span>
                      }
                      title={e.what}
                      detail={`${fmtDate(e.d)} · ${e.by}${
                        e.receipt ? ` · voucher ${e.ref}` : ' · no voucher'
                      }`}
                      right={<span className="mono">{inr(e.amt)}</span>}
                    />
                  )
                })}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing has been paid out of the box in the last 30 days.
            </p>
          )}
          <p className="gr" style={{ fontSize: '12.5px', margin: '14px 0 0' }}>
            Anything above the {inr(cfg.limit)} ceiling should have gone by bank transfer against an
            invoice, so there is a second record of it.
          </p>
        </>
      ),
    })

  const showUnvouched = () =>
    openModal({
      title: `Paid out with no receipt — ${noReceipt.length}`,
      body: (
        <>
          {noReceipt.length ? (
            <Rows>
              {noReceipt.map((e) => (
                <Row
                  key={e.id}
                  icon={<span className="bad" style={{ fontSize: '14.5px' }}>⚑</span>}
                  title={e.what}
                  detail={`${fmtDate(e.d)} · ${e.by}`}
                  right={<span className="mono bad">{inr(e.amt)}</span>}
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Every payment has a voucher against it.
            </p>
          )}
          <p className="gr" style={{ fontSize: '12.5px', margin: '14px 0 0' }}>
            Cash paid out without a voucher is the entry an auditor asks about first, and the one
            nobody remembers.
          </p>
        </>
      ),
    })

  const exportLedger = () => {
    const out = downloadCSV(csvName('petty-cash'), [
      [
        'Date',
        'What for',
        'Who',
        'Credit',
        'Debit',
        'Balance before',
        'Balance after',
        'Voucher',
        'Receipt held',
      ],
      ...ledger.map((e) => [
        fmtDate(e.d),
        e.what,
        e.by,
        e.kind === 'credit' ? e.amt : '',
        e.kind === 'debit' ? e.amt : '',
        e.before,
        e.after,
        e.ref,
        e.receipt ? 'yes' : 'no',
      ]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  /* A setting is only written when the new value is usable — an empty custodian
     or a zero float is a mis-key, not an instruction. */
  const num = (key: 'float' | 'limit') => (raw: string) => {
    const n = Number(raw)
    if (n > 0) setConfig(key, n)
  }

  const rows = [...ledger].reverse()

  return (
    <>
      <PageHead
        title="Petty cash"
        sub={`${cfg.custodian} holds the box · counted every ${cfg.countEvery}`}
        actions={
          <>
            <Btn variant="ghost" onClick={exportLedger}>
              Export
            </Btn>
            <Btn variant="ghost" onClick={openCount}>
              Count the box
            </Btn>
            <Btn onClick={addEntry}>＋ Entry</Btn>
          </>
        }
      />

      <Kpis>
        <Kpi
          title="In the box, on paper"
          value={
            <span className={balance < cfg.float * LOW ? 'warn' : ''} style={{ fontSize: '23px' }}>
              {inr(balance)}
            </span>
          }
          tone={balance < cfg.float * LOW ? 'warn' : undefined}
          detail={`float ${inr(cfg.float)}`}
          icon="›"
          hint="How this balance is arrived at"
          onClick={showBalance}
        />
        <Kpi
          title="Spent in 30 days"
          value={<span style={{ fontSize: '23px' }}>{inr(total(recent))}</span>}
          detail={`${recent.length} payment${recent.length === 1 ? '' : 's'}`}
          icon="›"
          hint="Every payment in the window"
          onClick={showSpent}
        />
        <Kpi
          title="Without a receipt"
          value={<span className={noReceipt.length ? 'bad' : 'ok'}>{noReceipt.length}</span>}
          tone={noReceipt.length ? 'alert' : undefined}
          detail={`${inr(total(noReceipt))} unvouched`}
          icon="›"
          hint="The unvouched payments"
          onClick={showUnvouched}
        />
        <Kpi
          title="Last counted"
          value={<span style={{ fontSize: '17px' }}>{last ? fmtDate(last.d) : 'never'}</span>}
          tone={due ? 'warn' : undefined}
          detail={
            due ? <span className="warn">a count is due</span> : last ? `by ${last.by}` : undefined
          }
          icon="›"
          hint="Every count of the box"
          onClick={focusCounts}
        />
      </Kpis>

      {due ? (
        <Banner
          kind="r"
          icon="◷"
          title={`Nobody has counted the box for ${last ? daysSince(last.d) : '—'} days`}
          style={{ marginTop: 16 }}
          actions={<Btn onClick={openCount}>Count it</Btn>}
        >
          The ledger says {inr(balance)}. Until someone independent has counted it and agreed, that
          is a figure rather than a fact.
        </Banner>
      ) : null}

      {noReceipt.length ? (
        <Banner
          kind="d"
          icon="⚑"
          title={`${noReceipt.length} payment${noReceipt.length === 1 ? '' : 's'} with no receipt — ${inr(total(noReceipt))}`}
          style={{ marginTop: 14 }}
        >
          {noReceipt.map((e) => `${e.what} (${e.by}, ${inr(e.amt)})`).join(' · ')}. Cash paid out
          without a voucher is the entry an auditor asks about first, and the one nobody remembers.
        </Banner>
      ) : null}

      {overLimit.length ? (
        <Banner
          kind="r"
          icon="⚠"
          title={`${overLimit.length} payment${overLimit.length === 1 ? '' : 's'} above the ${inr(cfg.limit)} cash ceiling`}
          style={{ marginTop: 14 }}
        >
          Anything larger should go through a bank transfer against an invoice, so there is a second
          record of it.
        </Banner>
      ) : null}

      <SectionHead>The ledger</SectionHead>
      <Card>
        <div className="tsc">
          <div style={{ minWidth: 1020 }}>
            <div className="trow h" style={{ gridTemplateColumns: LEDGER_COLS }}>
              <span>Date</span>
              <span>What for</span>
              <span>Who</span>
              <span>Credit</span>
              <span>Debit</span>
              <span>Balance</span>
              <span>Voucher</span>
            </div>
            <div className="tb">
              {!rows.length ? (
                <div className="empty" style={{ padding: '26px 10px' }}>
                  <span className="ei">·</span>
                  <p>
                    No entries yet. The first one is normally the opening float going in — until
                    then the box holds nothing and there is nothing to reconcile.
                  </p>
                  <Btn small onClick={addEntry}>
                    ＋ First entry
                  </Btn>
                </div>
              ) : (
                rows.map((e) => (
                  <div key={e.id} className="trow" style={{ gridTemplateColumns: LEDGER_COLS }}>
                    <div className="cell">
                      <div className="v mono" style={{ fontSize: '12.5px' }}>
                        {fmtDate(e.d)}
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v" style={{ fontSize: '12.5px' }}>
                        {e.what}
                      </div>
                      {e.kind === 'debit' && e.amt > cfg.limit ? (
                        <div className="s warn">above the {inr(cfg.limit)} ceiling</div>
                      ) : null}
                    </div>
                    <div className="cell">
                      <div className="v" style={{ fontSize: '12.5px' }}>
                        {e.by}
                      </div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${e.kind === 'credit' ? 'ok' : 'gr'}`}>
                        {e.kind === 'credit' ? inr(e.amt) : '—'}
                      </div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${e.kind === 'debit' ? 'warn' : 'gr'}`}>
                        {e.kind === 'debit' ? inr(e.amt) : '—'}
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v mono" style={{ fontWeight: 650 }}>
                        {inr(e.after)}
                      </div>
                      <div className="s gr">was {inr(e.before)}</div>
                    </div>
                    <div className="cell">
                      {e.receipt ? (
                        <span className="ok" style={{ fontSize: '12.5px' }}>
                          ✓ {e.ref}
                        </span>
                      ) : (
                        <span className="bad" style={{ fontSize: '12.5px' }}>
                          none
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Every row shows the balance before and after, because{' '}
        <b>previous + credit − debit = new balance</b> is the only check that catches a mistake at
        the moment it is made rather than at the month end. The running figure is computed from the
        entries — there is nowhere to type it.
      </p>

      <div className="two" style={{ marginTop: 18 }}>
        <Card padded>
          <div ref={countsPanel}>
            <Label>Counts of the box</Label>
            {counts.length ? (
              [...counts]
                .sort((a, b) => b.d.getTime() - a.d.getTime())
                .map((x) => {
                  const should = expectedAt(entries, x.d)
                  const drift = countDrift(x, entries)
                  return (
                    <div className="rw" key={x.id} style={{ padding: '9px 0' }}>
                      <span className={drift === 0 ? 'ok' : 'bad'} style={{ fontSize: '14.5px' }}>
                        {drift === 0 ? '✓' : '⚑'}
                      </span>
                      <span>
                        <b>
                          {fmtDate(x.d)} — counted {inr(x.counted)}
                        </b>
                        <div className="sd gr">
                          Ledger said {inr(should)} · counted by {x.by}
                        </div>
                        {drift === 0 ? (
                          <div className="sd">{x.note}</div>
                        ) : (
                          <div className="sd bad">
                            {drift > 0 ? 'Over' : 'Short'} by {inr(Math.abs(drift))} — {x.note}
                          </div>
                        )}
                      </span>
                      <span />
                    </div>
                  )
                })
            ) : (
              <p className="gr" style={{ fontSize: '13.5px', margin: '10px 0 0' }}>
                Nobody has counted the box yet, so the ledger figure has never been checked against
                what is actually in it.
              </p>
            )}
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              Counted by somebody other than the person holding the box. A custodian who checks
              their own float is not a control.
            </p>
          </div>
        </Card>

        <Card padded>
          <Label>How this box is run</Label>
          <div className="frm">
            <div className="fld">
              <label htmlFor="pc-float">Float</label>
              <input
                className="inp mono"
                id="pc-float"
                type="number"
                min={1}
                defaultValue={cfg.float}
                key={`float-${cfg.float}`}
                onBlur={(e) => num('float')(e.target.value)}
              />
              <div className="hint">Topped back up to this when it runs low.</div>
            </div>
            <div className="fld">
              <label htmlFor="pc-limit">Cash ceiling</label>
              <input
                className="inp mono"
                id="pc-limit"
                type="number"
                min={1}
                defaultValue={cfg.limit}
                key={`limit-${cfg.limit}`}
                onBlur={(e) => num('limit')(e.target.value)}
              />
              <div className="hint">Anything above goes by bank transfer against an invoice.</div>
            </div>
          </div>
          <div className="fld" style={{ marginTop: 12 }}>
            <label htmlFor="pc-cust">Who holds the box</label>
            <input
              className="inp"
              id="pc-cust"
              defaultValue={cfg.custodian}
              key={`cust-${cfg.custodian}`}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v) setConfig('custodian', v)
              }}
            />
          </div>
          <div className="fld">
            <label htmlFor="pc-ce">Counted every</label>
            <select
              className="inp"
              id="pc-ce"
              value={cfg.countEvery}
              onChange={(e) => setConfig('countEvery', e.target.value)}
            >
              <option value="week">week</option>
              <option value="month">month</option>
            </select>
          </div>
        </Card>
      </div>
    </>
  )
}

export default function PettyCashRoute() {
  return (
    <RequireCap cap="pricing">
      <ErrorBoundary what="Petty cash">
        <PettyCash />
      </ErrorBoundary>
    </RequireCap>
  )
}
