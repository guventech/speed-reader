import type { AppSettings, ThemePreference } from '../storage/settings'

type Props = {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
  onBack: () => void
}

export function SettingsScreen({ settings, onChange, onBack }: Props) {
  return (
    <div className="screen">
      <header className="top-bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <h1 className="screen-title">Settings</h1>
        <span className="top-bar-spacer" />
      </header>

      <section className="panel stack">
        <label className="stack-label" htmlFor="theme">
          Theme
        </label>
        <select
          id="theme"
          className="select"
          value={settings.theme}
          onChange={(e) =>
            onChange({ ...settings, theme: e.target.value as ThemePreference })
          }
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>

        <label className="stack-label" htmlFor="font-size">
          Font size ({settings.fontSizePx}px)
        </label>
        <input
          id="font-size"
          type="range"
          min={14}
          max={32}
          step={1}
          value={settings.fontSizePx}
          onChange={(e) =>
            onChange({ ...settings, fontSizePx: Number(e.target.value) })
          }
        />

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.orpEnabled}
            onChange={(e) => onChange({ ...settings, orpEnabled: e.target.checked })}
          />
          Coloured letter (ORP) in RSVP
        </label>
      </section>
    </div>
  )
}
