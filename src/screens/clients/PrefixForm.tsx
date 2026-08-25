import { useState } from 'react'
import { Banner, Btn, Field } from '@/components/ui'
import { addPrefix, clashOf } from './prefixes'
import type { Client } from '@/data/types'

/**
 * Claiming an order-number prefix for a client.
 *
 * The refusal is the reason this is a form rather than an inline input. An
 * overlapping prefix does not fail — it routes somebody else's mail to this
 * client, silently, and stays wrong until a person notices. So the overlap is
 * named, along with whose it is, before anything is written.
 */
export function PrefixForm({
  client,
  onCancel,
  onDone,
}: {
  client: Client
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const [value, setValue] = useState(client.dn)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const v = value.trim()
    if (!v) return setError('A prefix cannot be empty.')

    const clash = clashOf(v)
    if (clash) {
      const [who, existing] = clash
      if (existing === v) {
        return setError(
          who === client.n
            ? `${client.n} already claims ${v}.`
            : `${v} already belongs to ${who}. One prefix cannot resolve to two clients.`,
        )
      }
      return setError(
        who === client.n
          ? `${v} overlaps ${existing}, which ${client.n} already claims. An order number matching one matches the other, so only one of them can decide where the mail goes.`
          : `${v} overlaps ${existing}, already used by ${who}. Overlapping prefixes route mail to whichever matches first, which is not a decision anyone made.`,
      )
    }

    addPrefix(client.n, v)
    onDone(`${v} added — mail carrying it now resolves to ${client.n}`)
  }

  return (
    <>
      {error ? (
        <Banner kind="r" icon="⚠" style={{ margin: '0 0 14px' }}>
          {error}
        </Banner>
      ) : null}

      <Field
        label="Prefix"
        hint={`Any incoming order number starting with this resolves to ${client.n}. Keep them distinct — an ambiguous prefix routes mail to the wrong client silently.`}
      >
        <input
          className="inp mono"
          aria-label="Prefix"
          placeholder={`${client.dn}OH-`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
        />
      </Field>

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit}>Add</Btn>
      </div>
    </>
  )
}
