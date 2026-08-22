import { Banner, Btn, Card, Chip, Label, SecHead } from '@/components/ui'
import { useUi } from '@/state/ui'
import { DeptForm, DeptDelete } from './forms/DeptForm'
import { useStaff } from '@/state/company'
import { board } from '@/lib/engine'
import { csvName, downloadCSV } from '@/lib/csv'
import { moveDept, useDepartments } from '@/state/company'

/**
 * The stages an order moves through, and who staffs them.
 *
 * The pipeline strip at the top is the part worth reading first: an order runs
 * the numbered stages in order, and an exception branch is entered on demand
 * from any of them and returns the order to where it left. That is a different
 * shape from a list, so it is drawn as one.
 */

const COLS = '170px 1fr 130px 110px 110px 120px 140px'

export function DepartmentsTab({ onOpenStaff }: { onOpenStaff: () => void }) {
  const { openModal, closeModal, toast } = useUi()
  const depts = useDepartments()
  const STAFF = useStaff()
  const { dwork } = board()

  const editDept = (id?: string) =>
    openModal({
      title: id ? `Edit ${depts.find((d) => d.id === id)?.n ?? ''}` : 'Add a department',
      body: (
        <DeptForm
          id={id}
          onCancel={closeModal}
          onDone={(m) => { closeModal(); toast(m) }}
          onRemove={(x) => confirmRemove(x)}
        />
      ),
    })

  const confirmRemove = (id: string) =>
    openModal({
      title: `Remove ${depts.find((d) => d.id === id)?.n ?? ''}?`,
      body: (
        <DeptDelete
          id={id}
          onCancel={() => editDept(id)}
          onDone={(m) => { closeModal(); toast(m) }}
        />
      ),
    })

  const auto = depts.filter((d) => d.auto)
  const exc = depts.filter((d) => !d.auto)

  const head = (name: string) => {
    const people = STAFF.filter((s) => s.dep.includes(name) && s.active !== false)
    return {
      n: people.length,
      avail: people.filter((s) => s.avail === 'ok').length,
      load: dwork[name]?.tot ?? 0,
    }
  }

  const thin = depts.filter((d) => head(d.n).n <= 1)

  const exportDepts = () =>
    downloadCSV(csvName('departments'), [
      ['Department', 'What it does', 'In the pipeline', 'People', 'Available', "Today's work"],
      ...depts.map((d) => {
        const h = head(d.n)
        return [
          d.n,
          d.desc ?? '',
          d.auto ? `Step ${auto.indexOf(d) + 1}` : 'On demand',
          h.n,
          h.avail,
          h.load,
        ]
      }),
    ])

  return (
    <>
      <SecHead
        sub="The stages an order moves through, and who staffs them."
        actions={
          <>
            <Btn
              variant="ghost"
              onClick={() => {
                const out = exportDepts()
                toast(`${out.name} — ${out.rows.length - 1} departments`)
              }}
            >
              Export
            </Btn>
            <Btn onClick={() => editDept()}>＋ Add department</Btn>
          </>
        }
      />

      <Card padded>
        <Label>Pipeline order</Label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          {auto.map((d, i) => (
            <span key={d.id} style={{ display: 'contents' }}>
              <Chip kind="b" plain>
                <span style={{ fontWeight: 600 }}>
                  {i + 1}. {d.n}
                </span>
              </Chip>
              {i < auto.length - 1 ? <span className="gr">→</span> : null}
            </span>
          ))}
        </div>
        {exc.length ? (
          <div
            style={{
              display: 'flex',
              gap: 7,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 11,
            }}
          >
            <span className="gr" style={{ fontSize: '12.5px' }}>
              Off to one side:
            </span>
            {exc.map((d) => (
              <Chip key={d.id} kind="n" plain>
                {d.n}
              </Chip>
            ))}
          </div>
        ) : null}
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          An order passes through the numbered stages in order. An exception branch is entered on
          demand from any stage, and the order returns to where it left.
        </p>
      </Card>

      <Card style={{ marginTop: 18 }}>
        <div className="tsc">
          <div style={{ minWidth: 940 }}>
            <div className="trow h" style={{ gridTemplateColumns: COLS }}>
              <span>Department</span>
              <span>What it does</span>
              <span>In the pipeline</span>
              <span>People</span>
              <span>Available</span>
              <span>Today’s work</span>
              <span />
            </div>
            <div className="tb">
              {depts.map((d, i) => {
                const h = head(d.n)
                return (
                  <div className="trow" key={d.id} style={{ gridTemplateColumns: COLS }}>
                    <div className="cell">
                      <div className="v">
                        <b>{d.n}</b>
                      </div>
                      {d.pair ? <div className="s">checks {d.pair}</div> : null}
                    </div>
                    <div className="cell">
                      <div className="v gr" style={{ fontSize: '12.5px' }}>
                        {d.desc || '—'}
                      </div>
                    </div>
                    <div className="cell">
                      {d.auto ? (
                        <Chip kind="b">Step {auto.indexOf(d) + 1}</Chip>
                      ) : (
                        <Chip kind="n">On demand</Chip>
                      )}
                    </div>
                    <div className="cell">
                      <div className={`v mono ${h.n === 0 ? 'bad' : h.n === 1 ? 'warn' : ''}`}>
                        {h.n}
                      </div>
                      {h.n <= 1 ? (
                        <div className={`s ${h.n ? '' : 'bad'}`}>{h.n ? 'single point' : 'nobody'}</div>
                      ) : null}
                    </div>
                    <div className="cell">
                      <div className={`v mono ${h.avail === 0 ? 'bad' : ''}`}>{h.avail}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{h.load || '—'}</div>
                    </div>
                    <div className="cell" style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <Btn
                        variant="ghost"
                        small
                        disabled={i === 0}
                        aria-label={`Move ${d.n} up`}
                        onClick={() => moveDept(d.id, -1)}
                      >
                        ↑
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        disabled={i === depts.length - 1}
                        aria-label={`Move ${d.n} down`}
                        onClick={() => moveDept(d.id, 1)}
                      >
                        ↓
                      </Btn>
                      <Btn
                        variant="ghost"
                        small
                        onClick={() => editDept(d.id)}
                      >
                        Edit
                      </Btn>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {thin.length ? (
        <Banner
          kind="r"
          icon="⚠"
          title="Some departments rest on one person"
          style={{ marginTop: 16 }}
          actions={
            <Btn variant="ghost" small onClick={onOpenStaff}>
              Staff
            </Btn>
          }
        >
          {thin.map((d) => d.n).join(', ')}. If they are away, that stage stops and every order
          needing it becomes an exception.
        </Banner>
      ) : null}
    </>
  )
}
