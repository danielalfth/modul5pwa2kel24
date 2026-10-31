import { Search, SlidersHorizontal } from 'lucide-react'

/**
 * Search bar + category pills + sort dropdown.
 *
 * @param {Object}   props
 * @param {string}   props.search        — current search query
 * @param {Function} props.onSearch      — (value) => void
 * @param {string[]} props.categories    — e.g. ['All','Pistol','Rifle','Shotgun']
 * @param {string}   props.activeCategory
 * @param {Function} props.onCategory    — (value) => void
 * @param {string}   props.sortKey       — 'name' | 'price'
 * @param {string}   props.sortOrder     — 'asc' | 'desc'
 * @param {Function} props.onSort        — ({ key, order }) => void
 */
export default function AdvancedFilter({
  search,
  onSearch,
  categories,
  activeCategory,
  onCategory,
  sortKey,
  sortOrder,
  onSort,
}) {
  return (
    <div className="adv-filter">
      {/* Search */}
      <div className="adv-filter__search">
        <Search size={16} className="adv-filter__icon" />
        <input
          type="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="adv-filter__input"
          aria-label="Search products"
        />
      </div>

      {/* Category pills */}
      <div className="adv-filter__pills">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`pill${activeCategory === cat ? ' pill--active' : ''}`}
            onClick={() => onCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="adv-filter__sort">
        <SlidersHorizontal size={14} />
        <select
          value={`${sortKey}_${sortOrder}`}
          onChange={(e) => {
            const [key, order] = e.target.value.split('_')
            onSort({ key, order })
          }}
          aria-label="Sort products"
          className="adv-filter__select"
        >
          <option value="name_asc">Name A → Z</option>
          <option value="name_desc">Name Z → A</option>
          <option value="price_asc">Price Low → High</option>
          <option value="price_desc">Price High → Low</option>
        </select>
      </div>
    </div>
  )
}
