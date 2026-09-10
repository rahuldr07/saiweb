import { useState } from 'react'
import { Banner, Btn, Field, FormActions } from '@/components/ui'
import { QC_CRITERIA } from '@/lib/quality'

/**
 * Logging a defect against an order.
 *
 * The criterion is a choice and the sentence is not optional: a defect with no
 * reason attached teaches nobody anything, and that sentence is what appears on
 * the Quality report and on the person's own page as the thing to do
 * differently.
 */
export function DefectForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (criterion: string, note: string) => void
}) {
  const [criterion, setCriterion] = useState(QC_CRITERIA[0][0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!note.trim()) {
      return setError('Say what was wrong. That sentence is the whole value of the record.')
    }
    onSubmit(criterion, note.trim())
  }

  return (
    <>
      <Field label="Which criterion">
        <select
          className="inp"
          aria-label="Which criterion"
          value={criterion}
          onChange={(e) => setCriterion(e.target.value)}
        >
          {QC_CRITERIA.map(([name]) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="What was wrong"
        hint="A defect without a reason teaches nobody anything — this is the line that appears on the Quality report."
      >
        <textarea
          className="inp"
          aria-label="What was wrong"
          rows={3}
          placeholder="Book/Page transposed from the index"
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setError(null)
          }}
        />
      </Field>

      {error ? (
        <Banner kind="r" icon="⚠" style={{ margin: '12px 0 0' }}>
          {error}
        </Banner>
      ) : null}

      <FormActions>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit}>Log it</Btn>
      </FormActions>
    </>
  )
}
