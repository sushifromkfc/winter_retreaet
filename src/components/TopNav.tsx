type Page = 'home' | 'messages'

type TopNavProps = {
  page: Page
  onChange: (page: Page) => void
}

export const TopNav = ({ page, onChange }: TopNavProps) => (
  <nav className="top-nav">
    <button
      className={page === 'home' ? 'nav-link active' : 'nav-link'}
      type="button"
      onClick={() => onChange('home')}
    >
      Main page
    </button>
    <button
      className={page === 'messages' ? 'nav-link active' : 'nav-link'}
      type="button"
      onClick={() => onChange('messages')}
    >
      Messages
    </button>
  </nav>
)
