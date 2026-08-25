import { useUi } from '@/state/ui'
import { useStaff } from '@/state/company'
import { StaffForm, StaffDelete } from './StaffForm'
import { RoleForm } from './RoleForm'
import type { Person } from '@/data/types'

/**
 * Editing a person, from wherever their name appears.
 *
 * The design has one `editStaff(id)` reached from two places — the roster and
 * the staff profile — and the two-step flow inside it is the reason this is a
 * hook rather than a component: creating a role without leaving the form has to
 * put back everything already typed, so the draft has to survive a second modal
 * opening on top of the first. Duplicating that per screen is how the two
 * quietly stop behaving the same.
 */
export function useStaffEditor() {
  const { openModal, closeModal, toast } = useUi()
  const staff = useStaff()

  const nameOf = (id: string) => staff.find((s) => s.id === id)?.n ?? ''

  const editStaff = (id?: string, draft?: Partial<Person> | null) =>
    openModal({
      title: id ? `Edit ${nameOf(id)}` : 'Add staff',
      body: (
        <StaffForm
          id={id}
          draft={draft}
          onCancel={closeModal}
          onDone={(m) => {
            closeModal()
            toast(m)
          }}
          onRemove={(rid) => confirmRemove(rid)}
          onNewRole={(typed) => newRoleFor(id, typed)}
        />
      ),
    })

  const confirmRemove = (id: string) =>
    openModal({
      title: `Remove ${nameOf(id)}?`,
      body: (
        <StaffDelete
          id={id}
          onCancel={() => editStaff(id)}
          onDone={(m) => {
            closeModal()
            toast(m)
          }}
        />
      ),
    })

  const newRoleFor = (id: string | undefined, typed: Partial<Person>) =>
    openModal({
      title: 'Add a role',
      body: (
        <RoleForm
          isAdmin
          onCancel={() => editStaff(id, typed)}
          onManagePerms={() => editStaff(id, typed)}
          onRemove={() => editStaff(id, typed)}
          onDone={(m, roleId) => {
            toast(m)
            /* Straight back to the staff form, with the new role already chosen
               and nothing that was typed lost. */
            editStaff(id, { ...typed, r: roleId })
          }}
        />
      ),
    })

  return { editStaff, confirmRemove }
}
