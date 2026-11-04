import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Plus, Loader, AlertCircle, PackageOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import { clearAllCache } from '../utils/queryCache'
import { matchesSearch, matchesCategory, sortItems, extractCategories } from '../utils/helpers'

const PAGE_SIZE = 12

export default function Catalog() {
  const navigate = useNavigate()

  // ---- filters / sort ----
  const [search, setSearch]               = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey]             = useState('name')
  const [sortOrder, setSortOrder]         = useState('asc')
  const [page, setPage]                   = useState(1)

  // Stable params — prevents new object ref every render
  const apiParams = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    sort_by: sortKey === 'price' ? 'price' : 'name',
    order: sortOrder,
  }), [page, sortKey, sortOrder])

  const { guns: apiGuns, loading, error, pagination, refetch } = useGuns(apiParams)
  const [useLocal, setUseLocal] = useState(false)

  // Local fallback (API unreachable)
  const localFiltered = useMemo(() => {
    if (!useLocal && !(error && apiGuns.length === 0)) return null
    const base = GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` }))
    return sortItems(
      base.filter((g) => matchesSearch(g, search) && matchesCategory(g, activeCategory)),
      sortKey, sortOrder,
    )
  }, [useLocal, error, apiGuns.length, search, activeCategory, sortKey, sortOrder])

  // Client-side filter on current API page
  const displayGuns = useMemo(() => {
    if (localFiltered) return localFiltered
    return apiGuns.filter((g) => matchesSearch(g, search) && matchesCategory(g, activeCategory))
  }, [localFiltered, apiGuns, search, activeCategory])

  const categories = useMemo(
    () => extractCategories(localFiltered || apiGuns),
    [localFiltered, apiGuns],
  )

  const handleSearch   = (v) => { setSearch(v);   setPage(1) }
  const handleCategory = (v) => { setActiveCategory(v); setPage(1) }
  const handleSort     = ({ key, order }) => { setSortKey(key); setSortOrder(order); setPage(1) }

  const totalPages = localFiltered
    ? Math.ceil(localFiltered.length / PAGE_SIZE)
    : (pagination?.totalPages ?? 1)

  const pagedGuns = localFiltered
    ? displayGuns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : displayGuns

  const totalCount = localFiltered
    ? localFiltered.length
    : (pagination?.total ?? apiGuns.length)

  // ---- delete ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]         = useState(false)
  const [deleteError, setDeleteError]   = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      const res = await gunService.archiveGun(deleteTarget.id)
      if (res && res.success === false) throw new Error(res.message)
      clearAllCache()
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteError(err.message || 'Failed to archive.')
    } finally {
      setDeleting(false)
    }
  }

  const goPage = (p) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>Current stock</h2>
          <div className="list-head-right">
            <span className="count">{totalCount} piece{totalCount !== 1 ? 's' : ''}</span>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => navigate('/create')}
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        <AdvancedFilter
          search={search}       onSearch={handleSearch}
          categories={categories}
          activeCategory={activeCategory} onCategory={handleCategory}
          sortKey={sortKey}     sortOrder={sortOrder}  onSort={handleSort}
        />

        {loading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
              <button type="button" className="btn btn--outline" onClick={() => setUseLocal(true)}>
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && pagedGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {pagedGuns.length > 0 && (
          <ul className="stock">
            {pagedGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={(g) => navigate(`/catalog/${g.id}`)}
                onEdit={(g) => navigate(`/edit/${g.id}`)}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => goPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            <div className="pagination-pages">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} className="pagination-ellipsis">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`pagination-page${p === page ? ' pagination-page--active' : ''}`}
                      onClick={() => goPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={p === page ? 'page' : undefined}
                    >
                      {p}
                    </button>
                  ),
                )}
            </div>

            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => goPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button type="button" className="link-btn" onClick={() => { setUseLocal(false); refetch() }}>
              Retry server
            </button>
          </p>
        )}
      </section>

      <ConfirmModal
        open={!!deleteTarget}
        title="Archive Product"
        message={`Archive "${deleteTarget?.name}"? It can be restored or permanently deleted from Profile > Archive.`}
        confirmLabel="Archive"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError('') }}
      />
      {deleteError && <div className="toast toast--error">{deleteError}</div>}
    </>
  )
}
