import { useMemo } from 'react'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import type { Person } from '@/data/types'
import { csvName, downloadCSV } from '@/lib/csv'
import type { Payslip } from '@/lib/payroll'
import {
  payslipFileStem,
  payslipRows,
  registerFileStem,
  registerRows,
} from '@/lib/payroll-csv'

/**
 * The payslip downloads, named the way the design names them.
 *
 * A payslip is offered from three screens — the register, a person's own
 * history, and the payslip document itself — and all three have to produce the
 * same file, under the same name, with the same toast. `lib/payroll-csv` holds
 * the rows and the file stems; this holds the step past them that needs the
 * tenant and the toast, so a screen offering a download has nothing left to get
 * wrong.
 */
export interface PayslipDownloads {
  payslip: (person: Person, month: string) => void
  register: (month: string, list: Payslip[]) => void
}

export function usePayslipDownloads(): PayslipDownloads {
  const { toast } = useUi()
  const { tenant } = useSession()

  return useMemo(
    () => ({
      payslip: (person: Person, month: string) => {
        const out = downloadCSV(
          csvName(payslipFileStem(person, month)),
          payslipRows(person, month, tenant.name),
        )
        toast(out.name)
      },
      register: (month: string, list: Payslip[]) => {
        const out = downloadCSV(csvName(registerFileStem(month)), registerRows(list))
        toast(`${out.name} — ${out.rows.length - 1} people`)
      },
    }),
    [toast, tenant.name],
  )
}
