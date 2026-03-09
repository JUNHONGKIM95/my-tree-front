import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'

function MainLayout() {
  const navigate = useNavigate()
  const { currentUser, signOut } = useAuth()

  const handleLogout = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          my-tree
        </Link>
        <div className="topbar-actions">
          <span className="user-chip">{currentUser.userId}</span>
          <button className="secondary-button" onClick={handleLogout} type="button">
            로그아웃
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
