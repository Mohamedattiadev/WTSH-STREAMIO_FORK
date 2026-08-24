// Copyright (C) 2017-2023 Smart code 203358507

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const webpack = require('webpack');
const threadLoader = require('thread-loader');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WorkboxPlugin = require('workbox-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const packageJson = require('./package.json');

// Local-dev only: fills in process.env from .env/.env.local for whatever isn't already set
// (dotenv never overrides real env vars, so this is a no-op on Vercel, which sets these via its
// own project settings before the build even starts - see webpack.EnvironmentPlugin below).
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

// Used purely as a cache-busting path segment for build assets - doesn't need to be an actual
// git hash. Vercel CLI deploys (not Git-integrated) upload a plain file tarball with no .git
// directory, so `git rev-parse` has nothing to read there; VERCEL_GIT_COMMIT_SHA covers
// Git-integrated Vercel builds, and a random fallback covers everything else.
const COMMIT_HASH = (() => {
    try {
        return execSync('git rev-parse HEAD').toString().trim();
    } catch (e) {
        return process.env.VERCEL_GIT_COMMIT_SHA || crypto.randomUUID().replace(/-/g, '');
    }
})();

const THREAD_LOADER = {
    loader: 'thread-loader',
    options: {
        name: 'shared-pool',
        workers: os.cpus().length,
    },
};

threadLoader.warmup(
    THREAD_LOADER.options,
    [
        'babel-loader',
        'ts-loader',
        'css-loader',
        'postcss-loader',
        'less-loader',
    ],
);

module.exports = (env, argv) => ({
    mode: argv.mode,
    devtool: argv.mode === 'production' ? 'source-map' : 'eval-source-map',
    entry: {
        main: './src/index.js',
        worker: './node_modules/@stremio/stremio-core-web/worker.js'
    },
    output: {
        path: path.join(__dirname, 'build'),
        filename: `${COMMIT_HASH}/scripts/[name].js`,
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: [
                    THREAD_LOADER,
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                '@babel/preset-env',
                                '@babel/preset-react'
                            ],
                        }
                    }
                ]
            },
            {
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: [
                    THREAD_LOADER,
                    {
                        loader: 'ts-loader',
                        options: {
                            happyPackMode: true,
                        }
                    }
                ]
            },
            {
                test: /\.less$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: MiniCssExtractPlugin.loader,
                        options: {
                            esModule: false
                        }
                    },
                    THREAD_LOADER,
                    {
                        loader: 'css-loader',
                        options: {
                            esModule: false,
                            importLoaders: 2,
                            modules: {
                                namedExport: false,
                                localIdentName: '[local]-[hash:base64:5]'
                            }
                        }
                    },
                    {
                        loader: 'postcss-loader',
                        options: {
                            postcssOptions: {
                                plugins: [
                                    ['cssnano', {
                                        preset: [
                                            'advanced',
                                            {
                                                autoprefixer: {
                                                    add: true,
                                                    remove: true,
                                                    flexbox: false,
                                                    grid: false
                                                },
                                                cssDeclarationSorter: true,
                                                calc: false,
                                                colormin: false,
                                                convertValues: false,
                                                discardComments: {
                                                    removeAll: true,
                                                },
                                                discardOverridden: false,
                                                discardUnused: false,
                                                mergeIdents: false,
                                                normalizeDisplayValues: false,
                                                normalizePositions: false,
                                                normalizeRepeatStyle: false,
                                                normalizeUnicode: false,
                                                normalizeUrl: false,
                                                reduceIdents: false,
                                                reduceInitial: false,
                                                zindex: false
                                            }
                                        ]
                                    }]
                                ]
                            }
                        }
                    },
                    {
                        loader: 'less-loader',
                        options: {
                            lessOptions: {
                                strictMath: true,
                                ieCompat: false
                            }
                        }
                    }
                ]
            },
            {
                test: /\.(ttf|woff2)$/,
                exclude: /node_modules/,
                type: 'asset/resource',
                generator: {
                    filename: 'fonts/[name][ext][query]'
                }
            },
            {
                test: /\.(png|jpe?g|svg)$/,
                exclude: /node_modules/,
                type: 'asset/resource',
                generator: {
                    filename: 'images/[name][ext][query]'
                }
            },
            {
                test: /\.wasm$/,
                type: 'asset/resource',
                generator: {
                    filename: `${COMMIT_HASH}/binaries/[name][ext][query]`
                }
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.json', '.less', '.wasm'],
        alias: {
            'stremio': path.resolve(__dirname, 'src'),
            'stremio-router': path.resolve(__dirname, 'src', 'router')
        }
    },
    devServer: {
        host: '0.0.0.0',
        static: false,
        hot: false,
        // Plain http by default so the local Streaming Server (http://127.0.0.1:11470,
        // no TLS) is reachable — a secure (https) page has its outgoing http:// fetches
        // auto-upgraded to https by the browser, which fails against a non-TLS server.
        // Set DEV_SERVER_HTTPS=true to serve over https instead (needed to test
        // Chromecast locally, which requires a secure origin).
        server: process.env.DEV_SERVER_HTTPS === 'true' ? 'https' : 'http',
        liveReload: false,
        // The Streaming Server (whether a local native install or the stremio/server
        // Docker image) doesn't send Access-Control-Allow-Origin for arbitrary dev
        // origins, so a direct cross-origin fetch from the app gets CORS-blocked
        // (confirmed: browser reports "No 'Access-Control-Allow-Origin' header").
        // Proxying it under the app's own origin sidesteps CORS entirely — add
        // `http://localhost:8080/streaming-server/` as a Streaming Server URL in
        // Settings to use this instead of the direct 127.0.0.1:11470 URL.
        proxy: [
            {
                context: ['/streaming-server'],
                target: 'http://127.0.0.1:11470',
                pathRewrite: { '^/streaming-server': '' },
                changeOrigin: true,
                ws: true
            }
        ],
        // Vercel serverless functions under api/ don't run under plain `webpack serve` - only
        // Vercel's own runtime (or `vercel dev`) executes them. This re-hosts api/chat.js's
        // handler directly on the dev server's own (already-Express) app so `/api/chat` works
        // identically to production without requiring a Vercel account/link for local dev.
        setupMiddlewares: (middlewares, devServer) => {
            devServer.app.post('/api/chat', (req, res) => {
                let body = '';
                req.on('data', (chunk) => { body += chunk; });
                req.on('end', async () => {
                    try {
                        req.body = body.length > 0 ? JSON.parse(body) : {};
                    } catch (error) {
                        res.status(400).json({ error: 'Invalid JSON body' });
                        return;
                    }
                    delete require.cache[require.resolve('./api/chat.js')];
                    const handler = require('./api/chat.js');
                    await handler(req, res);
                });
            });
            return middlewares;
        }
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                test: /\.js$/,
                extractComments: false,
                terserOptions: {
                    ecma: 5,
                    mangle: true,
                    warnings: false,
                    output: {
                        comments: false,
                        beautify: false,
                        wrap_iife: true
                    }
                }
            })
        ]
    },
    plugins: [
        new webpack.ProgressPlugin(),
        new webpack.EnvironmentPlugin({
            SENTRY_DSN: null,
            SUPABASE_URL: null,
            SUPABASE_ANON_KEY: null,
            ...env,
            SERVICE_WORKER_DISABLED: false,
            DEBUG: argv.mode !== 'production',
            VERSION: packageJson.version,
            COMMIT_HASH
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer']
        }),
        argv.mode === 'production' &&
            new WorkboxPlugin.GenerateSW({
                maximumFileSizeToCacheInBytes: 20000000,
                clientsClaim: true,
                skipWaiting: true
            }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'assets/favicons', to: 'favicons' },
                { from: 'assets/images', to: 'images' },
                { from: 'assets/fonts', to: 'assets/fonts' },
                { from: 'assets/screenshots/*.webp', to: 'screenshots/[name][ext]' },
                { from: '.well-known', to: '.well-known' },
                { from: 'manifest.json', to: 'manifest.json' },
            ]
        }),
        new MiniCssExtractPlugin({
            filename: `${COMMIT_HASH}/styles/[name].css`
        }),
        new HtmlWebPackPlugin({
            template: './src/index.html',
            inject: false,
            scriptLoading: 'blocking',
            faviconsPath: 'favicons',
            imagesPath: 'images',
        }),
    ].filter(Boolean)
});
