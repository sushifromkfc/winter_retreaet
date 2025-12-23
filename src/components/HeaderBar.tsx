import type { User } from 'firebase/auth'

type HeaderBarProps = {
  user: User | null
  loadingProfile: boolean
  currentNumber: string
  onSignOut: () => void
  onIdClick: () => void
}

export const HeaderBar = ({
  user,
  loadingProfile,
  currentNumber,
  onSignOut,
  onIdClick,
}: HeaderBarProps) => (
  <header className="brand">
    <div>
      <p className="eyebrow">Winter Retreat Mystery</p>
      <h1>VKPC Winter Retreat</h1>
      <p className="lede">
        Track the timeline, connect with teammates, and report to the police
        before the final night.
      </p>
    </div>
    {user ? (
      <div className="account">
        <button
          className="chip chip-button"
          type="button"
          onClick={onIdClick}
        >
          {loadingProfile ? 'Loading ID...' : `ID ${currentNumber || '------'}`}
        </button>
        <button className="ghost" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    ) : null}
  </header>
)
