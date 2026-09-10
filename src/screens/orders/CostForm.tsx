import { useState } from 'react'
import { Banner, Btn, Field, Form, FormActions } from '@/components/ui'

export function CostForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (what: string, amount: number) => void
}) {
  const [what, setWhat] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const amt = parseFloat(amount)
    if (!what.trim() || !(amt > 0)) {
      return setError(
        'Both a description and an amount above zero — a cost line with neither cannot be billed on.',
      )
    }
    onSubmit(what.trim(), Math.round(amt * 100) / 100)
  }

  return (
    <>
      <Form>
        <Field label="What for">
          <input
            className="inp"
            aria-label="What for"
            placeholder="County copy fee"
            value={what}
            onChange={(e) => {
              setWhat(e.target.value)
              setError(null)
            }}
          />
        </Field>
        <Field label="Amount">
          <input
            className="inp mono"
            aria-label="Amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="12.50"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              setError(null)
            }}
          />
        </Field>
      </Form>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 4 }}>
        Pass-through costs are billed on at cost. They do not touch the product fee.
      </p>

      {error ? (
        <Banner kind="r" icon="⚠" style={{ margin: '12px 0 0' }}>
          {error}
        </Banner>
      ) : null}

      <FormActions>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit}>Add</Btn>
      </FormActions>
    </>
  )
}
