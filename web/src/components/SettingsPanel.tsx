"use client";

import { languageName, SUMMARY_LANGS, UI_LANGS, type SummaryLang, type UiLang, type UiStrings } from "@/lib/i18n";
import { MAX_PLACES, updateSettings, type Settings } from "@/lib/settings";
import { clearLetters } from "@/lib/letters";

// The small gear in the bottom-left corner, and the panel it opens.
// Everything here is saved in this browser only (lib/settings.ts).
export function SettingsButton({ label, onClick, hidden }: { label: string; onClick: () => void; hidden: boolean }) {
  return (
    <button type="button" className="settings-button" onClick={onClick} aria-label={label} data-hidden={hidden || undefined}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

const formatPlace = (p: { lat: number; lng: number }) =>
  `${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? "N" : "S"}  ${Math.abs(p.lng).toFixed(1)}°${p.lng >= 0 ? "E" : "W"}`;

export default function SettingsPanel({
  settings,
  letterCount,
  t,
  onAddPlace,
  onAbout,
  onClose,
}: {
  settings: Settings;
  letterCount: number;
  t: UiStrings;
  onAddPlace: () => void;
  onAbout: () => void;
  onClose: () => void;
}) {
  const clearHistory = () => {
    if (window.confirm(t.clearHistoryConfirm)) clearLetters();
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <section className="settings-panel" onClick={(e) => e.stopPropagation()} aria-label={t.settings}>
        <header className="settings-head">
          <h2>{t.settings}</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label={t.close}>
            ×
          </button>
        </header>

        <label className="settings-row">
          <span>{t.uiLanguage}</span>
          <select
            value={settings.uiLang ?? ""}
            onChange={(e) => updateSettings({ uiLang: (e.target.value || null) as UiLang | null })}
          >
            <option value="">{t.auto}</option>
            {UI_LANGS.map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-row">
          <span>{t.summaryLanguage}</span>
          <select
            value={settings.summaryLang ?? ""}
            onChange={(e) => updateSettings({ summaryLang: (e.target.value || null) as SummaryLang | null })}
          >
            <option value="">{t.auto}</option>
            {SUMMARY_LANGS.map((code) => (
              <option key={code} value={code}>
                {languageName(code)}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-row">
          <span>{t.sound}</span>
          <input
            type="checkbox"
            role="switch"
            className="settings-switch"
            checked={settings.sound}
            onChange={(e) => updateSettings({ sound: e.target.checked })}
          />
        </label>

        <div className="settings-block">
          <div className="settings-row settings-row-flat">
            <span>{t.places}</span>
          </div>
          <p className="settings-hint">{t.placesHint}</p>
          <ul className="settings-places">
            {settings.places.map((p, i) => (
              <li key={`${p.lat},${p.lng},${i}`}>
                <span className="settings-pin" aria-hidden />
                <span>{formatPlace(p)}</span>
                <button
                  type="button"
                  aria-label={t.close}
                  onClick={() => updateSettings({ places: settings.places.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {settings.places.length < MAX_PLACES && (
            <button type="button" className="settings-action" onClick={onAddPlace}>
              + {t.addPlace}
            </button>
          )}
        </div>

        <div className="settings-block">
          <div className="settings-row settings-row-flat">
            <span>{t.history}</span>
            <span className="settings-value">
              {letterCount} {t.letters}
            </span>
          </div>
          {letterCount > 0 && (
            <button type="button" className="settings-action settings-action-danger" onClick={clearHistory}>
              {t.clearHistory}
            </button>
          )}
        </div>

        <a
          href="/about"
          className="settings-about"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onAbout();
          }}
        >
          {t.about} →
        </a>
      </section>
    </div>
  );
}
