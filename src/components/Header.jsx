import { NavLink, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useFavoritesContext } from '../contexts/FavoritesContext'

const NAV_ITEMS = [
  { to: '/',          label: 'Catalog',   end: true },
  { to: '/favorites', label: 'Favorites', badge: true },
  { to: '/profile',   label: 'Profile' },
]

export default function Header() {
  const navigate = useNavigate()
  const { favorites } = useFavoritesContext()
  const favCount = favorites?.length ?? 0

  return (
    <header className="header">
      <div
        className="header-brand-wrap"
        onClick={() => navigate('/')}
        style={{ cursor: 'pointer' }}
      >
        <div className="header-logo-badge">
          <img src="/logo.png" alt="Bore & Barrel" />
        </div>
        <span className="brand display">Bore &amp; Barrel</span>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map(({ to, label, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {label}
            {badge && favCount > 0 && (
              <span className="nav-badge">{favCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        className="btn btn--primary btn--sm header-cta"
        onClick={() => navigate('/create')}
        title="Register new hardware"
      >
        <Plus size={15} /> Add Hardware
      </button>
    </header>
  )
}
