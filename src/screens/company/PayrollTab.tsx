import { Assumption, Banner, Card, Label } from '@/components/ui'
import { PAYMONTHS } from '@/data/hrms'
import { inr, payTotals } from '@/lib/payroll'
import { setPayCfg, useCompany } from '@/state/company'
import type { PayConfig } from '@/data/types'

/**
 * The salary structure, and what it produces.
 *
 * One set of rules applied to every payslip — nothing is stored per person
 * except the CTC. That is what makes this screen worth having and also what
 * makes it dangerous: the panel on the right recomputes across the whole roster
 * as you type, so a change that looks wrong here is about to look wrong on
 * twenty-eight payslips.
 */

/** The 50% wage rule the labour codes set. Below it, PF and gratuity understate. */
const WAGE_RULE = 50

function Num({
  k,
  label,
  hint,
  suffix,
  value,
  width = 120,
  min,
  max,
}: {
  k: keyof PayConfig
  label: string
  hint: string
  suffix?: string
  value: number
  width?: number
  min?: number
  max?: number
}) {
  return (
    <div className="fld">
      <label htmlFor={`pc-${k}`}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="inp mono"
          id={`pc-${k}`}
          type="number"
          step="any"
          min={min}
          max={max}
          style={{ width }}
          defaultValue={value}
          key={`${k}-${value}`}
          onBlur={(e) => setPayCfg(k, e.target.value)}
        />
        {suffix ? (
          <span className="gr" style={{ fontSize: '12.5px' }}>
            {suffix}
          </span>
        ) : null}
      </div>
      <div className="hint">{hint}</div>
    </div>
  )
}

export function PayrollTab() {
  const { pay } = useCompany()
  const month = PAYMONTHS[PAYMONTHS.length - 1]
  const t = payTotals(month)

  /* What contributing on the full basic would cost, rather than describing it. */
  const pfOnFull = t.list.reduce((a, x) => a + Math.round((x.earn[0][1] * pay.pfPct) / 100), 0)
  const gratuity = t.list.reduce((a, x) => a + x.st.grat, 0)

  const produced: [string, number][] = [
    ['Gross this month', t.gross],
    ['Employee deductions', t.ded],
    ['Net payable', t.net],
    ['Employer PF', t.erpf],
    ['Gratuity provisioned', gratuity],
  ]

  return (
    <>
      <div className="ch" style={{ border: 'none', padding: '2px 0 15px', alignItems: 'flex-start' }}>
        <div className="gr" style={{ fontSize: '12.5px', maxWidth: '70ch' }}>
          One set of rules, applied to every payslip. Change a number here and the whole register
          moves — nothing is stored per person except the CTC.
        </div>
      </div>

      <div className="two">
        <div>
          <Card padded>
            <Label>Salary structure</Label>
            <div className="frm">
              <Num
                k="basicPct"
                label="Basic as a share of CTC"
                suffix="%"
                value={pay.basicPct}
                hint="The labour codes require at least 50%. Below that the structure is not compliant, and PF and gratuity are understated."
              />
              <Num
                k="hraPctOfBasic"
                label="House rent allowance"
                suffix="% of basic"
                value={pay.hraPctOfBasic}
                hint="A share of basic. The balance of the package becomes special allowance."
              />
              <Num
                k="gratuityPct"
                label="Gratuity provision"
                suffix="% of basic"
                value={pay.gratuityPct}
                hint="Set aside monthly against the eventual payout, rather than found at exit."
              />
            </div>
          </Card>

          {pay.basicPct < WAGE_RULE ? (
            <Banner
              kind="d"
              icon="⚑"
              title={`Basic is below the ${WAGE_RULE}% the labour codes require`}
              style={{ marginTop: 12 }}
            >
              Every payslip produced at this setting understates PF and gratuity. Raise it before the
              next run.
            </Banner>
          ) : (
            <Banner kind="v" icon="✓" style={{ marginTop: 12 }}>
              Basic at {pay.basicPct}% meets the {WAGE_RULE}% wage rule.
            </Banner>
          )}
        </div>

        <div>
          <Card padded>
            <Label>Statutory</Label>
            <div className="frm">
              <Num
                k="pfPct"
                label="Provident fund"
                suffix="% of wage"
                value={pay.pfPct}
                hint="Employee contributes this; the company matches it."
              />
              <Num
                k="pfWageCeiling"
                label="PF wage ceiling"
                suffix={pay.sym}
                value={pay.pfWageCeiling}
                hint="PF is calculated on basic up to this figure unless you contribute on the full basic."
              />
              <Num
                k="esiPct"
                label="ESI — employee share"
                suffix="%"
                value={pay.esiPct}
                hint="Applies only below the gross limit beside it."
              />
              <Num
                k="esiGrossLimit"
                label="ESI gross limit"
                suffix={pay.sym}
                value={pay.esiGrossLimit}
                hint="Statutory. Anyone above it is out of ESI entirely."
              />
              <Num
                k="ptAmount"
                label="Professional tax"
                suffix={`${pay.sym} a month`}
                value={pay.ptAmount}
                hint="A state levy. Two offices in two states means two figures."
              />
            </div>
          </Card>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: '13.5px',
              padding: '11px 13px',
              border: '1px solid var(--hair)',
              borderRadius: 9,
              marginTop: 12,
            }}
          >
            <input
              type="checkbox"
              checked={pay.pfOnFullBasic}
              onChange={(e) => setPayCfg('pfOnFullBasic', e.target.checked)}
            />
            <span>
              <b>Contribute PF on the full basic</b>
              <div className="sd gr">
                Rather than capping at the {inr(pay.pfWageCeiling)} wage. More generous, and more
                expensive — {inr(t.erpf)} becomes roughly {inr(pfOnFull)} a month.
              </div>
            </span>
          </label>
        </div>
      </div>

      <div className="two" style={{ marginTop: 16 }}>
        <Card padded>
          <Label>Where the state levy applies</Label>
          <div className="frm">
            <div className="fld">
              <label htmlFor="pc-ptState">Professional tax state</label>
              <input
                className="inp"
                id="pc-ptState"
                defaultValue={pay.ptState}
                key={`pt-${pay.ptState}`}
                onBlur={(e) => setPayCfg('ptState', e.target.value)}
              />
              <div className="hint">
                Shown on every payslip, so it should say the state you actually pay in.
              </div>
            </div>
            <Num
              k="payDay"
              label="Salary credited on"
              value={pay.payDay}
              width={90}
              min={1}
              max={28}
              hint="Day of the following month. Stated on the payslip so nobody has to ask."
            />
          </div>
        </Card>

        <Card padded>
          <Label>What the current settings produce</Label>
          {produced.map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 0',
                fontSize: '13.5px',
                borderBottom: '1px solid var(--hair)',
              }}
            >
              <span className="gr">{label}</span>
              <b className="mono">{inr(value)}</b>
            </div>
          ))}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Recomputed as you change the settings above, across all {t.list.length} people. If a
            change here looks wrong, it will look wrong on {t.list.length} payslips.
          </p>
        </Card>
      </div>

      <Assumption title="Tax slabs are the new regime, FY 2025-26">
        The arithmetic is right and the rates are current, but real TDS depends on declarations,
        other income and prior employment. <b>Have your provider confirm before anyone is paid on
        these figures.</b>
      </Assumption>
    </>
  )
}
