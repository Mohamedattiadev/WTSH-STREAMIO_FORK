// Copyright (C) 2017-2026 Smart code 203358507

// Discovery catalogs shown on the Addons page's "Official"/"Community" tabs.
// Both are served by Cinemeta (installed by default in every Stremio setup)
// via the addon protocol's `addon_catalog` resource, maintained by Stremio
// itself rather than an unvetted third party. Verified live:
// - https://v3-cinemeta.strem.io/addon_catalog/all/official.json  (7 vetted addons)
// - https://v3-cinemeta.strem.io/addon_catalog/all/community.json (~95 addons)
const CINEMETA_TRANSPORT_URL = 'https://v3-cinemeta.strem.io/manifest.json';

const OFFICIAL_ADDON_CATALOG = {
    type: 'all',
    transportUrl: CINEMETA_TRANSPORT_URL,
    catalogId: 'official'
};

const COMMUNITY_ADDON_CATALOG = {
    type: 'all',
    transportUrl: CINEMETA_TRANSPORT_URL,
    catalogId: 'community'
};

// Curated regional addon hub (see routes/Addons/RegionalHub) - one-tap installs surfaced
// for Arabic/Turkish/English users so they don't have to know these addons exist or paste
// manifest URLs manually. Every transportUrl below was verified by hand (most recently
// 2026-08-25): stremio-addons.net only links to a human-readable addon *page*, not the raw
// manifest, so each one was resolved by inspecting that page's install link and confirmed
// live by fetching the manifest.json itself and checking its `behaviorHints`. A number of
// addons found via stremio-addons.net search turned out to be dead (DZ-Arabic, Wyzie AR Sub,
// SubAlchemy, USA TV all returned errors/parked pages), self-hosted-only (TvVoo's manifest is
// a `localhost` URL), or explicitly using unauthorized studio branding (a "Disney Arabic Dub"
// addon) - none of those are included here. The Turkish "Dizipal" entry that used to be here
// was removed on 2026-08-25 after its backend started resetting every connection
// (HTTP/2 PROTOCOL_ERROR) - domain/cert still resolve, but nothing live is behind them anymore.
//
// `autoInstall: true` marks addons that are legitimate by construction (metadata-only, or a
// genuinely licensed/ad-supported source) AND don't need any setup to return results
// (`behaviorHints.configurationRequired` is not true) - same bar as useAutoInstallEssentialAddons.
// Those are silently installed on first run. Everything else is intentionally opt-in only: the
// hub shows it with an Install (or, if it needs setup first, Configure) button, but it is never
// installed without an explicit tap. Two different reasons keep an addon out of autoInstall -
// don't assume `autoInstall: false` always means "unlicensed": check the `caveat`.
const REGIONAL_ADDONS = [
    {
        region: 'arabic',
        regionLabel: 'Arabic',
        id: 'com.arabcity.addon',
        transportUrl: 'https://arabcity.fly.dev/manifest.json',
        autoInstall: false,
        caveat: 'Streams are sourced from third-party sites (Akwam, Alooytv), not a licensed catalog.'
    },
    {
        region: 'arabic',
        regionLabel: 'Arabic',
        id: 'community.animo.arabic.anime',
        transportUrl: 'https://animo-hym4.onrender.com/manifest.json',
        autoInstall: false,
        caveat: 'Sources anime streams via a torrent indexer through your own Debrid account - requires configuring a Debrid API key to return anything.'
    },
    {
        region: 'arabic',
        regionLabel: 'Arabic',
        id: 'org.reptilia.aradeb',
        transportUrl: 'https://aradeb.518878.xyz/manifest.json',
        autoInstall: false,
        caveat: 'Resolves Arabic-content streams from private trackers through your own Debrid account - not a licensed catalog.'
    },
    {
        region: 'arabic',
        regionLabel: 'Arabic',
        id: 'community.elcinema.metadata',
        transportUrl: 'https://arabcinemeta.osamayousry.com/manifest.json',
        autoInstall: true
    },
    {
        region: 'turkish',
        regionLabel: 'Turkish',
        id: 'org.store.turkcealtyaziorg-stremio-addon',
        transportUrl: 'https://turkcealtyaziorg-stremio-addon.mycodelab.com.tr/manifest.json',
        autoInstall: false,
        caveat: 'Turkish subtitles from a clean, non-piracy source - needs a one-time setup step (tap Configure) before it returns results.'
    },
    {
        region: 'turkish',
        regionLabel: 'Turkish',
        id: 'com.ege.altyazitr',
        transportUrl: 'https://altyazi-stremio.online/manifest.json',
        autoInstall: false,
        caveat: 'Turkish subtitles from a clean, non-piracy source - needs a one-time setup step (tap Configure) before it returns results.'
    },
    {
        region: 'english',
        regionLabel: 'English',
        id: 'org.plutotv',
        transportUrl: 'https://dev.nebulawp.org/stremio/pluto-tv-addon/manifest.json',
        autoInstall: true
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'pw.ers.netflix-catalog',
        transportUrl: 'https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club/manifest.json',
        autoInstall: true
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'tmdb-addon',
        transportUrl: 'https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json',
        autoInstall: true
    }
];

module.exports = { OFFICIAL_ADDON_CATALOG, COMMUNITY_ADDON_CATALOG, REGIONAL_ADDONS };
