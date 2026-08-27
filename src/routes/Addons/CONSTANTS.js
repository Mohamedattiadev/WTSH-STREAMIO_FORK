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
// 2026-08-25 addition: a batch of addons sourced from two r/StremioAddons threads ("The
// Ultimate List Of Free Add-ons" and "torrentio like addon that has arabic shows and movies").
// Every entry added below was fetched and confirmed live from this machine, directly or (for
// HdHub, whose host this sandbox's direct TLS layer couldn't complete a handshake with -
// `WRONG_VERSION_NUMBER`, consistent with network-level interception rather than the addon being
// down) via an independent read-proxy that returned the exact manifest JSON. Two names from
// those threads were checked and deliberately left out: the standalone "Akwam" addon's domain
// now serves a mismatched/expired TLS cert pointing at an unrelated parked host (dead); "Watcho"
// hits the same local TLS interception as HdHub did, but every proxy retry got a genuine
// Cloudflare "temporarily rate limited - owner has reached their plan limits" page instead of
// the manifest - so the addon is real and live, but its id/name/behaviorHints were never
// actually confirmed. Re-check it (directly, or proxied) before adding. Most of these are
// torrent/debrid or unlicensed-HTTP scrapers, so none are `autoInstall` - each is opt-in with a
// caveat describing what it needs and where its streams come from.
//
// 2026-08-25 second addition: a broader sweep for Arabic/English/Korean/Japanese addons (Reddit
// itself was unreachable from this machine for this pass, so stremio-addons.net listings -
// which embed a signed `stremioAddonsConfig` proving the maintainer intentionally submitted
// there - plus GitHub commit activity were used as the corroboration signal instead; every
// transportUrl was still fetched directly here to confirm it's live). One candidate this sweep
// turned up, "Disney Arabic Dub", is the exact addon already excluded above for unauthorized
// studio branding - not added. Another, "Consumet", is served over plain `http://` with no TLS
// at all, which a browser will block as mixed content when fetched from this app over https -
// not added.
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
        region: 'arabic',
        regionLabel: 'Arabic',
        id: 'community.stream_ar',
        transportUrl: 'https://2ecbbd610840-stremio-ar.baby-beamup.club/manifest.json',
        autoInstall: false,
        caveat: 'Streams are sourced from third-party sites (Akwam, Wecima), not a licensed catalog - community-maintained and has had uptime gaps in the past.'
    },
    {
        region: 'arabic',
        regionLabel: 'Arabic',
        id: 'com.dcbi.addon',
        transportUrl: 'https://subass.site/manifest.json',
        autoInstall: false,
        caveat: 'Torrent-sourced Arabic movie/series catalog - streams only resolve well with a Real-Debrid or TorBox key configured.'
    },
    {
        region: 'arabic',
        regionLabel: 'Arabic',
        id: 'org.bidooo.arabic.addon',
        transportUrl: 'https://ozpwgjjkvrpxbeuhmmdr.supabase.co/functions/v1/bidooo-addon/manifest.json',
        autoInstall: false,
        caveat: 'Arabic-dubbed animation and live-action catalog scraped from the Bidooo Index, IMDB-matched - unlicensed source, hosted on a Supabase edge function of unknown long-term stability.'
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
        region: 'spanish',
        regionLabel: 'Spanish/Latino',
        id: 'stremio.cometa.fast',
        transportUrl: 'https://cometa.stremx.net/manifest.json',
        autoInstall: false,
        caveat: 'Spanish-tuned instance of the open-source Comet torrent/debrid search engine - works without setup, but best with your own Debrid account configured.'
    },
    {
        region: 'spanish',
        regionLabel: 'Spanish/Latino',
        id: 'community.latinobrid',
        transportUrl: 'https://latinobrid.stremx.net/manifest.json',
        autoInstall: false,
        caveat: 'Spanish-Latino dubbed movies/series, quality-focused - needs a Debrid account configured at its Configure page.'
    },
    {
        region: 'spanish',
        regionLabel: 'Spanish/Latino',
        id: 'org.progresolatino.addon',
        transportUrl: 'https://progreso-latino.xyz/api/addon/manifest.json',
        autoInstall: false,
        caveat: 'Manually-curated Latino movie/series catalog, still in beta - only works with a TorBox Debrid account configured.'
    },
    {
        region: 'spanish',
        regionLabel: 'Spanish/Latino',
        id: 'com.github.IsraPerez98.Stremio-TuSubtitulo',
        transportUrl: 'https://58196d6c26cf-stremio-tusubtitulo.baby-beamup.club/manifest.json',
        autoInstall: false,
        caveat: 'Subtitles only (Spain and Latino Spanish, Catalan, English) scraped from TuSubtitulo.com - no configuration needed, series only.'
    },
    {
        region: 'hindi',
        regionLabel: 'Hindi/Indian',
        id: 'in.rdata.indiastreams',
        transportUrl: 'https://indiastreams.rdata.in/manifest.json',
        autoInstall: true
    },
    {
        region: 'hindi',
        regionLabel: 'Hindi/Indian',
        id: 'com.stremio.indianStreamCatalog',
        transportUrl: 'https://indian-regional-catalog.vercel.app/manifest.json',
        autoInstall: false,
        caveat: 'Scrapes streams across 9 Indian languages (Telugu, Hindi, Tamil, Bengali, Malayalam, Kannada, Marathi, Gujarati, Punjabi) plus Hindi-dubbed/OTT-release catalogs - unofficial scraper, no config required but per-title reliability varies.'
    },
    {
        region: 'english',
        regionLabel: 'English',
        id: 'org.plutotv',
        transportUrl: 'https://dev.nebulawp.org/stremio/pluto-tv-addon/manifest.json',
        autoInstall: true
    },
    {
        region: 'english',
        regionLabel: 'English',
        id: 'com.aiostreams.viren070',
        transportUrl: 'https://aiostreams.elfhosted.com/stremio/manifest.json',
        autoInstall: false,
        caveat: 'Super-addon that consolidates 80+ community addons and debrid/usenet services into one, with filtering/sorting/formatting - needs your own debrid keys configured, but is widely recommended as the single best all-in-one pick.'
    },
    {
        region: 'english',
        regionLabel: 'English',
        id: 'io.wyzie.subs',
        transportUrl: 'https://stremio.wyzie.io/manifest.json',
        autoInstall: false,
        caveat: 'Free subtitle aggregator (OpenSubtitles, SubDL, Podnapisi, 125 languages) - needs a free Wyzie API key configured. Distinct from an older Arabic-specific "Wyzie AR Sub" addon that is dead; this is the maintained general one.'
    },
    {
        region: 'english',
        regionLabel: 'English',
        id: 'com.stremio.submaker',
        transportUrl: 'https://submaker.elfhosted.com/manifest.json',
        autoInstall: false,
        caveat: 'Fetches subtitles from OpenSubtitles/SubScene/SubDL and translates them with your own AI provider key (Gemini, OpenAI, Anthropic, and more) - needs setup at its Configure page.'
    },
    {
        region: 'english',
        regionLabel: 'English',
        id: 'community.dualsubtitles',
        transportUrl: 'https://stremio-dual-subtitles.vercel.app/manifest.json',
        autoInstall: false,
        caveat: 'Shows two subtitle languages simultaneously for language learners - no account or API key needed, just pick a primary/secondary language at its Configure page.'
    },
    {
        region: 'english',
        regionLabel: 'English',
        id: 'com.community.stremio-subtitles',
        transportUrl: 'https://stremio-community-subtitles.top/manifest.json',
        autoInstall: false,
        caveat: 'Lets users upload and curate their own subtitle files tied to an account so they sync across devices - needs a free account signup at its Configure page.'
    },
    {
        region: 'english',
        regionLabel: 'English',
        id: 'au.itcon.aisearch',
        transportUrl: 'https://stremio.tomz.dev/aisearch/manifest.json',
        autoInstall: false,
        caveat: 'Catalog-only (no streams) natural-language movie/series discovery via TMDB and your own AI provider key - needs that key configured at its Configure page.'
    },
    {
        region: 'korean',
        regionLabel: 'Korean',
        id: 'org.stremio.kdramas',
        transportUrl: 'https://83e20802dcf1-kdramacrush.baby-beamup.club/manifest.json',
        autoInstall: true
    },
    {
        region: 'korean',
        regionLabel: 'Korean',
        id: 'community.asian-tv',
        transportUrl: 'https://k-drama-kq1pjckm.on-forge.com/manifest.json',
        autoInstall: true
    },
    {
        region: 'korean',
        regionLabel: 'Korean',
        id: 'community.dramayo',
        transportUrl: 'https://dramayo.stream/manifest.json',
        autoInstall: false,
        caveat: 'Streams Asian dramas and movies from scraped direct links, not a licensed catalog - no configuration required.'
    },
    {
        region: 'korean',
        regionLabel: 'Korean',
        id: 'community.DEL.Kdrama',
        transportUrl: 'https://6172e63fd702-del-kdrama-series-movies.baby-beamup.club/manifest.json',
        autoInstall: false,
        caveat: 'Streams Korean movies/series (catalogued by originating platform - Netflix/Viu/Disney+ - but not an official or licensed source); small, early-stage project, no configuration required.'
    },
    {
        region: 'korean',
        regionLabel: 'Korean',
        id: 'yukistreams.stremio.public',
        transportUrl: 'https://stremio.yukistreams.xyz/manifest.json',
        autoInstall: false,
        caveat: 'Solo-maintained Asian drama and anime streaming gateway (Korean/Japanese/Chinese/Hong Kong, plus Thai/Filipino) - needs setup at its Configure page (direct HTTP or bring-your-own debrid).'
    },
    {
        region: 'asian',
        regionLabel: 'Asian (Korean/Chinese)',
        id: 'community.yastream',
        transportUrl: 'https://yastream.tamthai.de/manifest.json',
        autoInstall: false,
        caveat: 'Streams are sourced from third-party Asian-drama sites (kisskh, onetouchtv, and others), not a licensed catalog - results are usually HD or lower and reliability varies by provider.'
    },
    {
        region: 'anime',
        regionLabel: 'Anime',
        id: 'org.community.nexiotorii',
        transportUrl: 'https://torii.nexioapp.org/manifest.json',
        autoInstall: false,
        caveat: 'Sources anime streams from Nyaa via your own Debrid account, or optional direct P2P - needs a one-time setup step (tap Configure) before it returns results.'
    },
    {
        region: 'anime',
        regionLabel: 'Anime',
        id: 'community.anime.kitsu',
        transportUrl: 'https://anime-kitsu.strem.fun/manifest.json',
        autoInstall: true
    },
    {
        region: 'anime',
        regionLabel: 'Anime',
        id: 'org.stremio.animecatalogs',
        transportUrl: 'https://1fe84bc728af-stremio-anime-catalogs.baby-beamup.club/manifest.json',
        autoInstall: false,
        caveat: 'Multi-source metadata catalog (MyAnimeList, AniDB, AniList, Kitsu, aniSearch, LiveChart.me, Notify.Moe) with dub filtering - catalog-only, no streams, but needs picking sources at its Configure page.'
    },
    {
        region: 'anime',
        regionLabel: 'Anime',
        id: 'community.aniscraper.anime.addon',
        transportUrl: 'https://c5541ffce7d3-aniscraper.baby-beamup.club/manifest.json',
        autoInstall: false,
        caveat: 'Streams anime torrents scraped from Nyaa/AnimeTosho/AniRena/TsukiHime, not licensed - works via P2P by default or with your own Debrid account configured for instant streaming; reliability reports are mixed.'
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
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'com.stremio.torrentio.addon',
        transportUrl: 'https://torrentio.strem.fun/manifest.json',
        autoInstall: false,
        caveat: 'Resolves streams from public torrent indexers (YTS, 1337x, ThePirateBay, and more) through your own Debrid account - without one configured, only uncached magnet links are returned.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'com.elfhosted.stremthru.torz',
        transportUrl: 'https://stremthru.elfhosted.com/stremio/torz/manifest.json',
        autoInstall: false,
        caveat: 'ElfHosted\'s public instance for crowdsourced torrent streams - needs your own Debrid account set up via its Configure page before it returns anything.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'com.keopps.peerflix',
        transportUrl: 'https://peerflix.mov/manifest.json',
        autoInstall: false,
        caveat: 'Sources Spanish/English torrent links through your own Debrid account - configure a provider at its Configure page to get cached results.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'community.meteor',
        transportUrl: 'https://meteorfortheweebs.midnightignite.me/manifest.json',
        autoInstall: false,
        caveat: 'Conservative, franchise-aware torrent matching for movies/series/anime - needs a Debrid (or TorBox) API key configured at its Configure page before it reliably returns streams.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'comet.elfhosted.com',
        transportUrl: 'https://comet.elfhosted.com/manifest.json',
        autoInstall: false,
        caveat: 'ElfHosted\'s public instance of the Comet torrent/debrid search addon - needs your own Debrid account configured to return cached, playable streams.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'stremio.addons.mediafusion|elfhosted',
        transportUrl: 'https://mediafusion.elfhosted.com/manifest.json',
        autoInstall: false,
        caveat: 'ElfHosted\'s public instance of MediaFusion, a universal torrent & debrid addon - needs your own Debrid account configured to return cached, playable streams instead of raw uncached torrents.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'com.torrentsdb.addon',
        transportUrl: 'https://torrentsdb.com/manifest.json',
        autoInstall: false,
        caveat: 'Resolves streams from public torrent indexers (YTS, 1337x, TamilMV/TamilBlasters, and more) through your own Debrid account - without one configured, only uncached magnet links are returned.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'com.torrentclaw.addon',
        transportUrl: 'https://torrentclaw.com/api/stremio/manifest.json',
        autoInstall: false,
        caveat: 'Combines torrent streams, metadata, subtitles and anime IDs from 30+ sources - works best with your own Debrid account configured for instant cached playback.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'com.penguplay',
        transportUrl: 'https://pengu.uk/manifest.json',
        autoInstall: false,
        caveat: 'Streams are sourced from third-party HTTP sites (4KHDHub, MovieBox, VegaMovies, and others, toggleable per-source), not a licensed catalog.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'community.febboxaddon',
        transportUrl: 'https://febbox-addon.onrender.com/manifest.json',
        autoInstall: false,
        caveat: 'Streams from your own FebBox account (needs a FebBox token, tap Configure) - free-tier FebBox accounts are capped at 10GB.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'com.sootio.debrid-search',
        transportUrl: 'https://sootio.forthewizards.uk/manifest.json',
        autoInstall: false,
        caveat: 'Mostly a Debrid-cached-torrent search addon (needs a Real-Debrid/AllDebrid/TorBox key configured to return most results) - reliability varies; this is a community-run mirror after the official host was pulled.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'webstreamr-mbg',
        transportUrl: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club/manifest.json',
        autoInstall: false,
        caveat: 'Streams are sourced from third-party HTTP sites (4KHDHub, HDHub4u, MovieBox, VidSrc, VixSrc, and more, toggleable per-source/language), not a licensed catalog.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'org.flixstreams.free',
        transportUrl: 'https://free.flixnest.app/manifest.json',
        autoInstall: false,
        caveat: 'Free tier only (HDHub, HDHub4u, Dailymotion, DLStreams Live TV/Sports) - a separate paid plan with more sources exists. Streams are sourced from third-party HTTP sites, not a licensed catalog.'
    },
    {
        region: 'general',
        regionLabel: 'General (any language)',
        id: 'com.stremio.HdHub',
        transportUrl: 'https://hdhub.thevolecitor.qzz.io/eyJ0b3Jib3giOiJ1bnNldCIsInF1YWxpdGllcyI6IjIxNjBwLDEwODBwLDcyMHAiLCJzb3J0IjoiZGVzYyJ9/manifest.json',
        autoInstall: false,
        caveat: 'Streams are sourced from a third-party HTTP site (HdHub), not a licensed catalog. Reddit rates it "works sometimes" - flakier than the consistently-good picks above.'
    }
];

module.exports = { OFFICIAL_ADDON_CATALOG, COMMUNITY_ADDON_CATALOG, REGIONAL_ADDONS };
