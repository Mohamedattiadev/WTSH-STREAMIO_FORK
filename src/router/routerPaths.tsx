// Copyright (C) 2017-2025 Smart code 203358507

import React from 'react';
import routes from 'stremio/routes';

export default [
    {
        path: '/intro',
        view: 1,
        element: <routes.Intro />,
    },
    {
        path: '/discover/:transportUrl?/:type?/:catalogId?',
        view: 1,
        element: <routes.Discover />,
    },
    {
        path: '/library/:type?',
        view: 1,
        element: <routes.Library />,
    },
    {
        path: '/calendar/:year?/:month?',
        view: 1,
        element: <routes.Calendar />,
    },
    {
        path: '/continuewatching/:type?',
        view: 1,
        element: <routes.Library />,
    },
    {
        path: '/search',
        view: 1,
        element: <routes.Search />,
    },
    {
        path: '/chat',
        view: 1,
        element: <routes.Chat />,
    },
    {
        path: '/metadetails/:type?/:id?/:videoId?',
        view: 2,
        element: <routes.MetaDetails />,
    },
    {
        path: '/detail/:type?/:id?/:videoId?',
        view: 2,
        element: <routes.MetaDetails />,
    },
    {
        path: '/addons/:type?/:transportUrl?/:catalogId?',
        view: 1,
        element: <routes.Addons />,
    },
    {
        path: '/settings',
        view: 1,
        element: <routes.Settings />,
    },
    {
        // Was view: 4 (a stacked overlay above every other route, the entire mechanism behind
        // the old fullscreen takeover) - now view: 1, same depth as every other content route,
        // so it renders as a normal route swap inside the shared MainNavBars shell instead of
        // painting over the whole app. See Player.js for the embedded-vs-fullscreen split this
        // enables.
        path: '/player/:stream/:streamTransportUrl?/:metaTransportUrl?/:type?/:id?/:videoId?',
        view: 1,
        element: <routes.Player />,
    },
    {
        path: '/',
        view: 1,
        element: <routes.Board />,
    },
    {
        path: '*',
        view: 1,
        element: <routes.NotFound />,
    },
];
