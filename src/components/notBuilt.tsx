import { Btn } from './ui'
import { useUi } from '@/state/ui'

/**
 * Saying plainly that something is not built.
 *
 * The design has one of these behind about ten buttons — connect a mailbox,
 * import a CSV, open a scan, render a PDF. They are all the same admission: the
 * screen knows what the action means, and the thing it would need to actually do
 * it is not here. A button that silently did nothing, or a toast claiming success,
 * would both be worse than saying so.
 *
 * The design's version was written for the two export buttons and reused for the
 * other eight, so a connect button announced "Connecting Gmail / Outlook export
 * is not built yet" and offered a CSV download. This one names what is missing
 * and stops there.
 */
export function useNotBuilt() {
  const { openModal, closeModal } = useUi()

  return (what: string, needs: string) =>
    openModal({
      title: `${what} is not built here`,
      body: (
        <>
          <p style={{ fontSize: '13.5px' }}>
            It needs <b>{needs}</b>, which this build does not have.
          </p>
          <p className="gr" style={{ fontSize: '12.5px' }}>
            Everything around it is real — the screen knows what the action means and where its result
            would go. What is missing is the part that has to reach outside this workspace.
          </p>
        </>
      ),
      footer: <Btn onClick={closeModal}>Close</Btn>,
    })
}
