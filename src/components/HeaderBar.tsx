import type { User } from 'firebase/auth'

type HeaderBarProps = {
  user: User | null
  loadingProfile: boolean
  currentNumber: string
  onSignOut: () => void
}

export const HeaderBar = ({
  user,
  loadingProfile,
  currentNumber,
  onSignOut,
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
        <div className="chip">
          {loadingProfile ? 'Loading ID...' : `ID ${currentNumber || '------'}`}
        </div>
        <button className="ghost" type="button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    ) : null}
  </header>
)
