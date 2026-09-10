import { useUi } from '@/state/ui'
import { ClientForm, ClientDelete } from '@/screens/company/forms/ClientForm'

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
