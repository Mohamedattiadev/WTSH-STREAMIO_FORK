// Copyright (C) 2017-2026 Smart code 203358507

import React, { forwardRef, memo, MouseEvent, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { Button } from 'stremio/components';
import { DEFAULT_STREAMING_SERVER_URL } from 'stremio/common/CONSTANTS';
import styles from './StreamingServerMenu.less';

type Props = {
    className: string,
    urls: { url: string, mtime: Date }[],
    selectedUrl: string,
    status: 'Ready' | 'Loading' | 'Err' | null,
    onUrlSelected: (url: string) => void,
};

const StreamingServerMenu = memo(forwardRef<HTMLDivElement, Props>(({ className, urls, selectedUrl, status, onUrlSelected }: Props, ref) => {
    const { t } = useTranslation();

    const onUrlClick = useCallback(({ currentTarget }: MouseEvent) => {
        const url = currentTarget.getAttribute('data-url')!;
        onUrlSelected && onUrlSelected(url);
    }, [onUrlSelected]);

    const onMouseDown = (event: MouseEvent) => {
        // @ts-expect-error: Property 'streamingServerMenuClosePrevented' does not exist on type 'MouseEvent'.
        event.nativeEvent.streamingServerMenuClosePrevented = true;
    };

    return (
        <div ref={ref} className={classNames(className, styles['streaming-server-menu'])} onMouseDown={onMouseDown}>
            <div className={styles['container']}>
                <div className={styles['header']}>
                    {t('STREAMING_SERVER_MENU_TITLE')}
                </div>
                <div className={styles['list']}>
                    {
                        urls.map(({ url }) => {
                            const selected = url === selectedUrl;
                            const label = url === DEFAULT_STREAMING_SERVER_URL ? t('STREAMING_SERVER_LOCAL') : url;
                            return (
                                <Button
                                    key={url}
                                    title={url}
                                    className={classNames(styles['option'], { 'selected': selected })}
                                    data-url={url}
                                    onClick={onUrlClick}
                                >
                                    <div className={styles['info']}>
                                        <div className={styles['label']}>{label}</div>
                                        {
                                            selected ?
                                                <div className={classNames(styles['status'], styles[(status ?? 'loading').toLowerCase()])}>
                                                    {
                                                        status === 'Ready' ? t('SETTINGS_SERVER_STATUS_ONLINE') :
                                                            status === 'Err' ? t('SETTINGS_SERVER_STATUS_ERROR') :
                                                                t('STREAM_LOADING')
                                                    }
                                                </div>
                                                :
                                                null
                                        }
                                    </div>
                                    {
                                        selected ?
                                            <div className={classNames(styles['icon'], styles[(status ?? 'loading').toLowerCase()])} />
                                            :
                                            null
                                    }
                                </Button>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
}));

export default StreamingServerMenu;
