// Copyright (C) 2017-2026 Smart code 203358507

export const SETUP_COMMANDS = {
    unix: 'curl -fsSL https://raw.githubusercontent.com/Mohamedattiadev/WTSH-STREAMIO_FORK/stremio-server-setup/scripts/stremio-server-setup/install.sh | bash',
    windows: 'irm https://raw.githubusercontent.com/Mohamedattiadev/WTSH-STREAMIO_FORK/stremio-server-setup/scripts/stremio-server-setup/install.ps1 | iex',
} as const;

export type Platform = keyof typeof SETUP_COMMANDS;

export const PLATFORM_LABEL: Record<Platform, string> = {
    unix: 'macOS / Linux',
    windows: 'Windows',
};

export const detectPlatform = (): Platform => {
    if (typeof navigator !== 'undefined' && /win/i.test(navigator.userAgent)) {
        return 'windows';
    }
    return 'unix';
};
