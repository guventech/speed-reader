import { downloadSessionCsv, type SessionEntry } from '../storage/sessionLog'

type Props = {
  entries: SessionEntry[]
  onBack: () => void
}

export function LogScreen({ entries, onBack }: Props) {
  return (
    <div className="screen">
      <header className="top-bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <h1 className="screen-title">Session log</h1>
        <span className="top-bar-spacer" />
      </header>

      <div className="panel">
        <button
          type="button"
          className="btn"
          disabled={entries.length === 0}
          onClick={() => downloadSessionCsv(entries)}
        >
          Export CSV
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="muted pad">No sessions yet. Press Play to start one.</p>
      ) : (
        <div className="table-wrap">
          <table className="log-table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Mode</th>
                <th scope="col">WPM</th>
                <th scope="col">Words</th>
                <th scope="col">Minutes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatWhen(entry.startedAt)}</td>
                  <td>{entry.mode}</td>
                  <td>{entry.wpm}</td>
                  <td>{entry.wordsRead}</td>
                  <td>{entry.minutesRead.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
