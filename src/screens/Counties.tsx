import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Banner, Btn, Chip, Kpi, Kpis, PageHead } from '@/components/ui'
import { ErrorBoundary } from '@/components/async'
import { useNotBuilt } from '@/components/notBuilt'
import { useUi } from '@/state/ui'
import { useSession } from '@/state/session'
import { BADSTATES } from '@/data/catalog'
import { LSTATE, brokenLinks, days, linkStats } from '@/lib/derived'
import { csvName, downloadCSV } from '@/lib/csv'
import { useCoverage } from '@/state/coverage'
import { CountyEdit } from './counties/CountyEdit'
import { FixLink } from './counties/FixLink'
import { LinkTypes, type LtView } from './counties/LinkTypes'
import type { County } from '@/data/types'

/**
 * County coverage.
 *
 * The workspace's own record of where it can search, and whether the sources it
 * searches with are still answering. Order intake validates against it, which is
 * why removing a county says so rather than just doing it.
 *
 * Every status on the grid is a button: the useful thing to do with a broken
 * link is fix it, and making somebody navigate to a different screen to do that
 * is how a red chip stays red for a month.
 */

type Filter = 'all' | 'bad' | 'gap' | 'ok'

function Counties() {
  const navigate = useNavigate()
  const { openModal, closeModal, toast } = useUi()
  const { can } = useSession()
  const notBuilt = useNotBuilt()
  const { counties, linkTypes, check } = useCoverage()
  const search = useSearch({ from: '/counties' })
  const [query, setQuery] = useState('')

  /* The filter is in the URL so the link monitor can hand one over, and so a
     particular view of the register can be sent to somebody. */
  const FILTERS: Filter[] = ['all', 'bad', 'gap', 'ok']
  const filter: Filter = FILTERS.includes(search.f as Filter) ? (search.f as Filter) : 'all'
  const setFilter = (f: Filter) =>
    navigate({ to: '/counties', search: f === 'all' ? {} : { f }, replace: true })

  const isAdmin = can('all')
  const linkOf = (c: County, k: string) => c.links[k] ?? { u: '', s: 'none' as const }

  /* The four filters, each counted over the whole record so a pill says how much
     it would show rather than how much is showing. */
  const counts = useMemo(() => {
    const has = (c: County, p: (s: string) => boolean) => linkTypes.some((t) => p(linkOf(c, t.k).s))
    return {
      all: counties.length,
      bad: counties.filter((c) => has(c, (s) => BADSTATES.includes(s as never))).length,
      gap: counties.filter((c) => has(c, (s) => s === 'none')).length,
      ok: counties.filter((c) => linkTypes.every((t) => linkOf(c, t.k).s === 'ok')).length,
    }
  }, [counties, linkTypes])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return counties.filter((c) => {
      const states = linkTypes.map((t) => linkOf(c, t.k).s)
      const passes =
        filter === 'all'
          ? true
          : filter === 'bad'
            ? states.some((s) => BADSTATES.includes(s as never))
            : filter === 'gap'
              ? states.some((s) => s === 'none')
              : states.every((s) => s === 'ok')
      if (!passes) return false
      return !q || c.n.toLowerCase().includes(q) || c.st.toLowerCase().includes(q)
    })
  }, [counties, linkTypes, filter, query])

  const stats = linkStats()
  const bad = brokenLinks()

  /* One column per link type, so adding a fifth type widens the grid rather than
     needing this string edited. */
  const cols = `150px 70px 120px repeat(${linkTypes.length}, minmax(120px, 1fr)) 100px`

  const exportCounties = () =>
    downloadCSV(csvName('counties'), [
      ['County', 'State', 'Index from', ...linkTypes.flatMap((t) => [t.n, `${t.n} status`])],
      ...rows.map((c) => [
        c.n,
        c.st,
        c.idx ?? 'manual',
        ...linkTypes.flatMap((t) => [linkOf(c, t.k).u, LSTATE[linkOf(c, t.k).s][0]]),
      ]),
    ])

  const editCounty = (county: County | null) =>
    openModal({
      title: county ? `${county.n} County, ${county.st}` : 'Add a county',
      body: (
        <CountyEdit
          county={county}
          onCancel={closeModal}
          onDone={() => {
            closeModal()
            toast(county ? `${county.n} saved` : 'County added')
          }}
        />
      ),
    })

  const fixLink = (county: County, k: string) => {
    const type = linkTypes.find((t) => t.k === k)
    if (!type) return
    openModal({
      title: `${type.n} link — ${county.n}, ${county.st}`,
      body: (
        <FixLink
          county={county}
          type={type}
          onCancel={closeModal}
          onDone={(message) => {
            closeModal()
            toast(message)
          }}
        />
      ),
    })
  }

  /* Re-opened per step so the modal's own title says which step it is on, the
     way the design does — "Add a link type", not "Link types". */
  const manageTypes = (view: LtView = { at: 'list' }): void => {
    const named = view.at !== 'list' && view.k ? linkTypes.find((t) => t.k === view.k)?.n : null
    const title =
      view.at === 'confirm'
        ? `Remove ${named ?? 'link type'}?`
        : view.at === 'edit'
          ? named
            ? `Edit ${named}`
            : 'Add a link type'
          : 'Link types'

    openModal({
      title,
      body: <LinkTypes view={view} onView={manageTypes} onClose={closeModal} />,
    })
  }

  const PILLS: [Filter, string, number][] = [
    ['all', 'All', counts.all],
    ['bad', 'Broken links', counts.bad],
    ['gap', 'Missing links', counts.gap],
    ['ok', 'All working', counts.ok],
  ]

  return (
    <>
      <PageHead
        title="County coverage"
        sub="Your own county record — this workspace maintains it, and nobody else can see or change it."
        actions={
          <>
            {isAdmin ? (
              <Btn variant="ghost" onClick={() => manageTypes()}>
                Link types
              </Btn>
            ) : null}
            <Btn variant="ghost" onClick={() => navigate({ to: '/linkcheck' })}>
              Link monitor
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => notBuilt('Importing a CSV', 'a file picker and a column mapper', exportCounties)}
            >
              Import CSV
            </Btn>
            <Btn onClick={() => editCounty(null)}>＋ Add county</Btn>
          </>
        }
      />

      {bad.length ? (
        <Banner
          kind="d"
          icon="⚑"
          title={`${bad.length} link${bad.length === 1 ? '' : 's'} stopped working`}
          actions={
            <Btn variant="ghost" small onClick={() => navigate({ to: '/linkcheck' })}>
              See them
            </Btn>
          }
        >
          {[...new Set(bad.map((x) => x.c.n))].join(', ')}. Found by the check{' '}
          {days(check.last) === 0 ? 'today' : `${days(check.last)} days ago`}.
        </Banner>
      ) : null}

      <Kpis>
        <Kpi
          title="Counties on file"
          value={counties.length}
          detail="across every state we search"
          icon="›"
          hint="Show all counties"
          onClick={() => setFilter('all')}
        />
        <Kpi
          title="Links held"
          value={
            <>
              {stats.covered}
              <span className="gr" style={{ fontSize: '14.5px' }}> / {stats.total}</span>
            </>
          }
          detail={`${linkTypes.length} per county`}
          icon="›"
          hint="Counties with every link working"
          onClick={() => setFilter('ok')}
        />
        <Kpi
          title="Not working"
          value={<span className={stats.bad ? 'bad' : 'ok'}>{stats.bad}</span>}
          tone={stats.bad ? 'alert' : undefined}
          detail={stats.bad ? 'needs attention' : 'all good'}
          icon="›"
          hint="Filter to broken links"
          onClick={() => setFilter('bad')}
        />
        <Kpi
          title="Missing"
          value={<span className={stats.by.none ? 'warn' : 'gr'}>{stats.by.none}</span>}
          tone={stats.by.none ? 'warn' : undefined}
          detail="no address on file"
          icon="›"
          hint="Filter to missing links"
          onClick={() => setFilter('gap')}
        />
      </Kpis>

      <div className="fbar" style={{ marginTop: 16 }} role="group" aria-label="Which counties">
        {PILLS.map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            className={`pill ${k === 'bad' && n ? 'urg' : ''} ${filter === k ? 'on' : ''}`}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {label}
            <span className="n">{n}</span>
          </button>
        ))}
        <div className="sp">
          <input
            className="inp"
            type="search"
            placeholder="Search county or state"
            aria-label="Search counties"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <p className="cnt">
        <span>ⓘ</span> Showing <b>{rows.length}</b> of <b>{counties.length}</b> counties
      </p>

      <div className="tbl">
        <div className="tsc">
          <div style={{ minWidth: 1000 }}>
            <div className="trow h" style={{ gridTemplateColumns: cols }}>
              <span>County</span>
              <span>State</span>
              <span>Index from</span>
              {linkTypes.map((t) => (
                <span key={t.k}>{t.n}</span>
              ))}
              <span />
            </div>
            <div className="tb">
              {rows.length ? (
                rows.map((c) => (
                  <div className="trow" key={`${c.st}-${c.n}`} style={{ gridTemplateColumns: cols }}>
                    <div className="cell">
                      <div className="v">
                        <b>{c.n}</b>
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{c.st}</div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${c.idx ? '' : 'warn'}`}>{c.idx ?? 'manual'}</div>
                    </div>
                    {linkTypes.map((t) => {
                      const l = linkOf(c, t.k)
                      return (
                        <div className="cell" key={t.k}>
                          <button
                            type="button"
                            style={{ font: 'inherit', textAlign: 'left' }}
                            title={l.err || l.u || 'no link on file'}
                            aria-label={`${t.n} for ${c.n} — ${LSTATE[l.s][0]}`}
                            onClick={() => fixLink(c, t.k)}
                          >
                            <Chip kind={LSTATE[l.s][1]}>{LSTATE[l.s][0]}</Chip>
                            {l.since ? <div className="s bad">{days(l.since)}d</div> : null}
                          </button>
                        </div>
                      )
                    })}
                    <div className="cell">
                      <Btn
                        variant="ghost"
                        small
                        aria-label={`Edit ${c.n}, ${c.st}`}
                        onClick={() => editCounty(c)}
                      >
                        Edit
                      </Btn>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <span className="ei">◈</span>
                  <p>
                    {query.trim()
                      ? `No county matches “${query.trim()}” under this filter.`
                      : 'No counties match this filter.'}
                  </p>
                  {filter !== 'all' || query.trim() ? (
                    <Btn
                      small
                      onClick={() => {
                        setFilter('all')
                        setQuery('')
                      }}
                    >
                      Show every county
                    </Btn>
                  ) : (
                    <Btn small onClick={() => editCounty(null)}>
                      ＋ Add the first county
                    </Btn>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        Click any status to see the address and fix it. All {linkTypes.length} types are checked
        automatically every {check.every} days
        {isAdmin ? (
          <>
            {' — '}
            <button type="button" className="br" style={{ fontWeight: 600 }} onClick={() => manageTypes()}>
              add another type
            </button>{' '}
            and every county gets a slot for it
          </>
        ) : null}
        .
      </p>
    </>
  )
}

export default function CountiesRoute() {
  return (
    <ErrorBoundary what="County coverage">
      <Counties />
    </ErrorBoundary>
  )
}
