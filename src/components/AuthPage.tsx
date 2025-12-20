import type { FormEvent } from 'react'

type AuthPageProps = {
  authMode: 'login' | 'signup'
  onAuthModeChange: (mode: 'login' | 'signup') => void
  numberInput: string
  passwordInput: string
  confirmInput: string
  authError: string
  onNumberChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const AuthPage = ({
  authMode,
  onAuthModeChange,
  numberInput,
  passwordInput,
  confirmInput,
  authError,
  onNumberChange,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
}: AuthPageProps) => (
  <section className="auth-shell">
    <div className="panel auth-card">
      <div className="tabs">
        <button
          className={authMode === 'login' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => onAuthModeChange('login')}
        >
          Sign in
        </button>
        <button
          className={authMode === 'signup' ? 'tab active' : 'tab'}
          type="button"
          onClick={() => onAuthModeChange('signup')}
        >
          Create account
        </button>
      </div>

      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span>6-digit ID</span>
          <input
            className="input"
            inputMode="numeric"
            pattern="\\d{6}"
            placeholder="e.g. 482901"
            value={numberInput}
            onChange={(event) => onNumberChange(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            placeholder="Your secret"
            value={passwordInput}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </label>
        {authMode === 'signup' ? (
          <label className="field">
            <span>Confirm password</span>
            <input
              className="input"
              type="password"
              placeholder="Repeat password"
              value={confirmInput}
              onChange={(event) => onConfirmChange(event.target.value)}
            />
          </label>
        ) : null}
        {authError ? <p className="error">{authError}</p> : null}
        <button className="primary" type="submit">
          {authMode === 'login' ? 'Enter case' : 'Join the case'}
        </button>
        <p className="helper">
          Use any six digits as your ID. Your password is stored securely in
          Firebase Auth.
        </p>
      </form>
    </div>

    <div className="panel highlight">
      <h2>How to win</h2>
      <ul>
        <li>Play each challenge to uncover hidden clues.</li>
        <li>Share theories privately and compare alibis.</li>
        <li>Report the murderer to the police before the final night.</li>
      </ul>
      <div className="highlight-footer">
        <span>Trust no one until the final reveal.</span>
      </div>
    </div>
  </section>
)
