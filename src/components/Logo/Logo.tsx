// Copyright (C) 2017-2026 Smart code 203358507

import React, { memo, useId } from 'react';

type Props = {
    className?: string,
};

// The WTSH brand mark: an ember-gradient play triangle, matching the design mockup exactly
// (design/ember-rail-mockup.html's .rail-mark svg). Inline SVG instead of a raster asset so it
// stays crisp at any size and needs no separate light/dark/retina exports.
const Logo = memo(({ className }: Props) => {
    const gradientId = useId();
    return (
        <svg className={className} viewBox={'0 0 24 24'}>
            <defs>
                <linearGradient id={gradientId} x1={'0'} y1={'0'} x2={'1'} y2={'1'}>
                    <stop offset={'0%'} stopColor={'#FF7A45'} />
                    <stop offset={'100%'} stopColor={'#FF3D2E'} />
                </linearGradient>
            </defs>
            <path d={'M6.5 3.8v16.4l14-8.2Z'} fill={`url(#${gradientId})`} />
        </svg>
    );
});

Logo.displayName = 'Logo';

export default Logo;
