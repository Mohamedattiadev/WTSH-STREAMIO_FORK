// Copyright (C) 2017-2023 Smart code 203358507

if (typeof process.env.SENTRY_DSN === 'string') {
    const Sentry = require('@sentry/browser');
    Sentry.init({ dsn: process.env.SENTRY_DSN });
}

const Bowser = require('bowser');
const browser = Bowser.parse(window.navigator?.userAgent || '');
if (browser?.platform?.type === 'desktop') {
    document.querySelector('meta[name="viewport"]')?.setAttribute('content', '');
}

const React = require('react');
const ReactDOM = require('react-dom/client');
const { HashRouter } = require('react-router-dom');
const i18n = require('i18next');
const { initReactI18next } = require('react-i18next');
const stremioTranslations = require('stremio-translations');
const customTranslations = require('./common/customTranslations.json');
const App = require('./App');
const { default: WebUpdateScreen } = require('./App/WebUpdateScreen');
const { CoreProvider } = require('./core');
const { FileDropProvider, PlatformProvider } = require('./common');

// Every string this redesign added (Chat, Calendar reminders, Add to Calendar, the streaming-
// server picker, the Gemini API key card, the language menu itself, etc.) is genuinely new
// content stremio-translations was never going to have - upstream only covers the original
// Stremio UI. Layered on top of the real upstream resources per-locale rather than editing the
// vendored package (which `pnpm install` would just overwrite). Only covers the 6 languages the
// top-bar quick switcher offers for now - the ~40-language full picker in Settings still falls
// back to English for these specific strings in any other language.
const translations = Object.fromEntries(Object.entries(stremioTranslations()).map(([key, value]) => [key, {
    translation: {
        ...value,
        ...Object.fromEntries(
            Object.entries(customTranslations)
                .filter(([, byLocale]) => typeof byLocale[key] === 'string')
                .map(([translationKey, byLocale]) => [translationKey, byLocale[key]])
        )
    }
}]));

i18n
    .use(initReactI18next)
    .init({
        resources: translations,
        lng: 'en-US',
        fallbackLng: 'en-US',
        interpolation: {
            escapeValue: false
        }
    });

const appInfo = {
    appVersion: process.env.VERSION,
    shellVersion: null
};

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(
    <React.StrictMode>
        <PlatformProvider>
            <CoreProvider appInfo={appInfo}>
                <FileDropProvider>
                    <HashRouter>
                        <>
                            <WebUpdateScreen />
                            <App />
                        </>
                    </HashRouter>
                </FileDropProvider>
            </CoreProvider>
        </PlatformProvider>
    </React.StrictMode>
);
