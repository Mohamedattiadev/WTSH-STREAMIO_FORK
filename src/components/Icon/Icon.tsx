// Copyright (C) 2017-2026 Smart code 203358507

import React, { forwardRef } from 'react';
import StremioIcon from '@stremio/stremio-icons/react';
import { ICON_MAP } from './iconMap';

type Props = {
    name?: string,
    className?: string,
    outline?: boolean,
};

const OUTLINE_SUFFIX = '-outline';

// Drop-in replacement for @stremio/stremio-icons/react's Icon, same (name, className) API,
// so every existing call site (`<Icon name={'x'} className={...} />`) keeps working unchanged.
// Generic UI icons render via lucide-react (see iconMap.ts); anything not in that map - brand
// marks the app doesn't own the artwork to reinterpret, or a name we simply haven't mapped yet
// - falls back to the original icon set so nothing silently disappears.
const Icon = forwardRef<SVGSVGElement, Props>(({ name, className }, ref) => {
    if (typeof name !== 'string' || name.length === 0) {
        return null;
    }

    const baseName = name.endsWith(OUTLINE_SUFFIX) ? name.slice(0, -OUTLINE_SUFFIX.length) : name;
    const LucideIcon = ICON_MAP[baseName];
    if (!LucideIcon) {
        return <StremioIcon ref={ref} className={className} name={name} />;
    }

    return <LucideIcon ref={ref} className={className} strokeWidth={2} absoluteStrokeWidth={false} />;
});

Icon.displayName = 'Icon';

export default Icon;
