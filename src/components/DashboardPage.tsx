import type { FormEvent } from 'react'

type DashboardPageProps = {
  currentNumber: string
  nameInput: string
  status: string
  error: string
  onNameChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const DashboardPage = ({
  currentNumber,
  nameInput,
  status,
  error,
  onNameChange,
  onSubmit,
}: DashboardPageProps) => (
  <section className="dashboard">
    <div className="panel dashboard-card">
      <h2>Your Dashboard</h2>
      <p className="helper">
        Update the name other players will see in messages.
      </p>
      <div className="dashboard-id">
        <span>Your 6-digit ID</span>
        <strong>{currentNumber || '------'}</strong>
      </div>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span>Display name</span>
          <input
            className="input"
            placeholder="e.g. Detective Park"
            value={nameInput}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <button className="primary" type="submit">
          Save name
        </button>
        {error ? <p className="error">{error}</p> : null}
        {status ? <p className="status">{status}</p> : null}
      </form>
    </div>
  </section>
)
