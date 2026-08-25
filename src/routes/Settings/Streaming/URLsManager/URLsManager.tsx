// Copyright (C) 2017-2024 Smart code 203358507

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './URLsManager.less';
import { Button } from 'stremio/components';
import Item from './Item';
import AddItem from './AddItem';
import Icon from 'stremio/components/Icon';
import useToast from 'stremio/common/Toast/useToast';
import { SETUP_COMMANDS, PLATFORM_LABEL, detectPlatform, type Platform } from 'stremio/common/streamingServerSetupCommand';
import useStreamingServerUrls from './useStreamingServerUrls';

const URLsManager = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const [addMode, setAddMode] = useState(false);
    const [platform, setPlatform] = useState<Platform>(detectPlatform);
    const command = useMemo(() => SETUP_COMMANDS[platform], [platform]);
    const { streamingServerUrls, addServerUrl, reloadServer } = useStreamingServerUrls();

    const onTogglePlatform = useCallback(() => {
        setPlatform((prev) => prev === 'unix' ? 'windows' : 'unix');
    }, []);

    const onCopyCommand = useCallback(() => {
        navigator.clipboard.writeText(command);
        toast.show({
            type: 'success',
            title: t('COMMAND_COPIED'),
            timeout: 2500,
        });
    }, [command, t, toast]);

    const onAdd = () => {
        setAddMode(true);
    };

    const onCancel = () => {
        setAddMode(false);
    };

    const handleAddUrl = useCallback((url: string) => {
        addServerUrl(url);
        setAddMode(false);
    }, []);

    return (
        <div className={styles['wrapper']}>
            <div className={styles['header']}>
                <div className={styles['label']}>{t('URL')}</div>
                <div className={styles['label']}>{t('STATUS')}</div>
            </div>
            <div className={styles['content']}>
                {
                    streamingServerUrls.map((item: StreamingServerUrl) => (
                        <Item key={item.url} {...item} />
                    ))
                }
                {
                    addMode ?
                        <AddItem onCancel={onCancel} handleAddUrl={handleAddUrl} />
                        : null
                }
            </div>
            <div className={styles['footer']}>
                <Button title={t('SETTINGS_SERVER_ADD_URL')} className={styles['add-url']} onClick={onAdd}>
                    <Icon name={'add'} className={styles['icon']} />
                    {t('SETTINGS_SERVER_ADD_URL')}
                </Button>
                <Button className={styles['reload']} title={t('RELOAD')} onClick={reloadServer}>
                    <Icon name={'reset'} className={styles['icon']} />
                    <div className={styles['label']}>{t('RELOAD')}</div>
                </Button>
            </div>
            <div className={styles['setup-row']}>
                <div className={styles['setup-hint']}>
                    {t('STREAMING_SERVER_SETUP_HINT')}
                </div>
                <div className={styles['command-box']}>
                    <button
                        type={'button'}
                        className={styles['platform-badge']}
                        title={t('SWITCH_OS')}
                        onClick={onTogglePlatform}
                    >
                        {PLATFORM_LABEL[platform]}
                    </button>
                    <code className={styles['command-text']} title={command}>{command}</code>
                    <Button
                        className={styles['copy-button']}
                        title={t('COPY_COMMAND')}
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

export default URLsManager;
