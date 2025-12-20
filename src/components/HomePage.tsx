import type { FormEvent } from 'react'
import type { GamePhase } from '../types'

type HomePageProps = {
  progressPercent: number
  currentPhase?: GamePhase
  phases: GamePhase[]
  policeNumber: string
  policeError: string
  policeStatus: string
  onPoliceNumberChange: (value: string) => void
  onPoliceSubmit: (event: FormEvent<HTMLFormElement>) => void
  onOpenMessages: () => void
}

export const HomePage = ({
  progressPercent,
  currentPhase,
  phases,
  policeNumber,
  policeError,
  policeStatus,
  onPoliceNumberChange,
  onPoliceSubmit,
  onOpenMessages,
}: HomePageProps) => (
  <section className="home-grid">
    <div className="panel progress-card">
      <div className="progress-header">
        <div>
          <h2>Time Passed</h2>
          <p className="helper">4 Nights • 3 Days</p>
        </div>
        <span className="chip muted">{Math.round(progressPercent)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="progress-meta">
        <span>{currentPhase?.label}</span>
        <span>{currentPhase?.detail}</span>
      </div>
      <div className="phase-row">
        {phases.map((phase) => (
          <div key={phase.label} className="phase-pill">
            <span>{phase.label}</span>
            <small>{phase.detail}</small>
          </div>
        ))}
      </div>
    </div>
    <div className="panel action-card">
      <h2>Operations</h2>
      <p className="helper">Move between private chats and the police line.</p>
      <button className="primary action-button" type="button" onClick={onOpenMessages}>
        Open messages
      </button>
      <form className="police-form" onSubmit={onPoliceSubmit}>
        <label className="field">
          <span>Police 6-digit ID</span>
          <input
            className="input"
            inputMode="numeric"
            pattern="\\d{6}"
            placeholder="Police/admin ID"
            value={policeNumber}
            onChange={(event) => onPoliceNumberChange(event.target.value)}
          />
        </label>
        <button className="primary" type="submit">
          Call police
        </button>
        {policeError ? <p className="error">{policeError}</p> : null}
        {policeStatus ? <p className="status">{policeStatus}</p> : null}
      </form>
    </div>
  </section>
)
