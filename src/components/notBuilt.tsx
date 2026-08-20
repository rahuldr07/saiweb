import { Btn } from './ui'
import { useUi } from '@/state/ui'
import type { CsvResult } from '@/lib/csv'

/**
 * Saying plainly that something is not built.
 *
 * The design has one of these behind about ten buttons — connect a mailbox,
 * import a CSV, open a scan, render a PDF. They are all the same admission: the
 * screen knows what the action means, and the thing it would need to actually do
 * it is not here. A button that silently did nothing, or a toast claiming
 * success, would both be worse than saying so.
 *
 * It always offers the way out that does work. The design's line is that CSV
 * carries the same fields and is working now, so the refusal is never a dead
 * end — you leave with the data, just not in the format you asked for. The
 * caller supplies the export, because only the caller knows what "the same
 * fields" means on its own screen.
 */
export function useNotBuilt() {
  const { openModal, closeModal, toast } = useUi()

  return (what: string, needs: string, csv?: () => CsvResult) =>
    openModal({
      title: `${what} is not built here`,
      body: (
        <>
          <p style={{ fontSize: '13.5px' }}>
            It needs <b>{needs}</b>, which this build does not have.
          </p>
          <p className="gr" style={{ fontSize: '12.5px' }}>
            {csv
              ? 'CSV carries the same fields and is working now — every value on this screen. Everything around this action is real; what is missing is the part that has to reach outside the workspace.'
              : 'Everything around it is real — the screen knows what the action means and where its result would go. What is missing is the part that has to reach outside this workspace.'}
          </p>
        </>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Close
          </Btn>
          {csv ? (
            <Btn
              onClick={() => {
                closeModal()
                const out = csv()
                toast(`${out.name} — ${out.rows.length - 1} rows`)
              }}
            >
              Export CSV instead
            </Btn>
          ) : null}
        </>
      ),
    })
}
