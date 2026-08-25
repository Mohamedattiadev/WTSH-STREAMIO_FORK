// Copyright (C) 2017-2024 Smart code 203358507

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import Icon from 'stremio/components/Icon';
import { Button } from 'stremio/components';
import { useCore } from 'stremio/core';
import useProfile from 'stremio/common/useProfile';
import { withCoreSuspender } from 'stremio/common/CoreSuspender';
import useToast from 'stremio/common/Toast/useToast';
import { SETUP_COMMANDS, PLATFORM_LABEL, detectPlatform, type Platform } from 'stremio/common/streamingServerSetupCommand';
import styles from './StreamingServerWarning.less';

type Props = {
    className?: string;
};

const StreamingServerWarning = ({ className }: Props) => {
    const { t } = useTranslation();
    const core = useCore();
    const profile = useProfile();
    const toast = useToast();
    const [platform, setPlatform] = useState<Platform>(detectPlatform);
    const command = useMemo(() => SETUP_COMMANDS[platform], [platform]);

    const onTogglePlatform = useCallback(() => {
        setPlatform((prev) => prev === 'unix' ? 'windows' : 'unix');
    }, []);

    const onCopyCommand = useCallback(() => {
        navigator.clipboard.writeText(command);
        toast.show({
            type: 'success',
            title: 'Command copied — paste it in a terminal',
            timeout: 2500,
        });
    }, [command]);

    const createDismissalDate = (months: number, years = 0): Date => {
        const dismissalDate = new Date();

        if (months) {
            dismissalDate.setMonth(dismissalDate.getMonth() + months);
        }
        if (years) {
            dismissalDate.setFullYear(dismissalDate.getFullYear() + years);
        }

        return dismissalDate;
    };

    const updateSettings = useCallback((streamingServerWarningDismissed: Date) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'UpdateSettings',
                args: {
                    ...profile.settings,
                    streamingServerWarningDismissed
                }
            }
        });
    }, [profile.settings]);

    const onLater = useCallback(() => {
        updateSettings(createDismissalDate(1));
    }, [updateSettings]);

    const onDismiss = useCallback(() => {
        updateSettings(createDismissalDate(0, 50));
    }, [updateSettings]);

    return (
        <div className={classnames(className, styles['warning-container'])}>
            <div className={styles['top-row']}>
                <div className={styles['warning-icon-container']}>
                    <Icon className={styles['warning-icon']} name={'warning'} />
                </div>
                <div className={styles['warning-statement']}>
                    {t('SETTINGS_SERVER_UNAVAILABLE')}
                </div>
                <div className={styles['actions']}>
                    <Button
                        className={styles['action']}
                        title={t('WARNING_STREAMING_SERVER_LATER')}
                        onClick={onLater}
                        tabIndex={-1}
                    >
                        <div className={styles['label']}>
                            {t('WARNING_STREAMING_SERVER_LATER')}
                        </div>
                    </Button>
                    <Button
                        className={styles['action']}
                        title={t('DONT_SHOW_AGAIN')}
                        onClick={onDismiss}
                        tabIndex={-1}
                    >
                        <div className={styles['label']}>
                            {t('DONT_SHOW_AGAIN')}
                        </div>
                    </Button>
                </div>
            </div>
            <div className={styles['setup-row']}>
                <div className={styles['setup-hint']}>
                    This is what makes playback work — Stremio does not stream video from our servers. This runs a small server on your own device that fetches and streams the video privately, just for you.
                </div>
                <div className={styles['command-box']}>
                    <button
                        type={'button'}
                        className={styles['platform-badge']}
                        title={'Click to switch OS'}
                        onClick={onTogglePlatform}
                    >
                        {PLATFORM_LABEL[platform]}
                    </button>
                    <code className={styles['command-text']} title={command}>{command}</code>
                    <Button
                        className={styles['copy-button']}
                        title={'Copy command'}
                        onClick={onCopyCommand}
                        tabIndex={-1}
                    >
                        <Icon className={styles['icon']} name={'copy'} />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default withCoreSuspender(StreamingServerWarning);
