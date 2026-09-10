import { useUi } from '@/state/ui'
import { useStaff } from '@/state/company'
import { StaffForm, StaffDelete } from '@/screens/company/forms/StaffForm'
import { RoleForm } from '@/screens/company/forms/RoleForm'
import type { Person } from '@/data/types'

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
            editStaff(id, { ...typed, r: roleId })
          }}
        />
      ),
    })

  return { editStaff, confirmRemove }
}
