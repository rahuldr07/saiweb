import { useUi } from '@/state/ui'
import { ClientForm, ClientDelete } from './ClientForm'

/**
 * Editing a client, from wherever their name appears.
 *
 * The design reaches one `editClient(name)` from both the list and the client
 * page, and the remove step returns to the form rather than closing on a
 * decision not taken. Holding that in one place is what keeps the two entry
 * points behaving the same. `useStaffEditor` is the same arrangement on the roster.
 */
export function useClientEditor() {
  const { openModal, closeModal, toast } = useUi()

  const editClient = (name?: string) =>
    openModal({
      title: name ? `Edit ${name}` : 'Add a client',
      body: (
        <ClientForm
          name={name}
          onCancel={closeModal}
          onDone={(m) => {
            closeModal()
            toast(m)
          }}
          onRemove={(x) => confirmRemove(x)}
        />
      ),
    })

  const confirmRemove = (name: string) =>
    openModal({
      title: `Remove ${name}?`,
      body: (
        <ClientDelete
          name={name}
          onCancel={() => editClient(name)}
          onDone={(m) => {
            closeModal()
            toast(m)
          }}
        />
      ),
    })

  return { editClient, confirmRemove }
}
