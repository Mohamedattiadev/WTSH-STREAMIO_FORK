// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useMemo, useState, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useCore } from 'stremio/core';
import useProfile from 'stremio/common/useProfile';
import interfaceLanguages from 'stremio/common/interfaceLanguages.json';
import Popup from 'stremio/components/Popup';
import styles from './LanguageMenu.less';

// A short, curated set for the top-bar quick switcher - the full ~40-language list already
// lives one click away in Settings > Interface (useInterfaceOptions.ts), which this reuses the
// exact same real dispatch for. Every code here has a real translation shipped in
// stremio-translations (confirmed against node_modules/stremio-translations/*.json) - never a
// fabricated language.
const QUICK_LANGUAGE_CODES = ['en-US', 'ar-AR', 'tr-TR', 'fr-FR', 'nl-NL', 'es-ES'];

type LanguageOption = {
    code: string,
    name: string,
    shortLabel: string,
};

const QUICK_LANGUAGES: LanguageOption[] = QUICK_LANGUAGE_CODES
    .map((code) => {
        const language = (interfaceLanguages as { name: string, codes: string[] }[]).find(({ codes }) => codes[0] === code);
        return language ? { code, name: language.name, shortLabel: code.slice(0, 2).toUpperCase() } : null;
    })
    .filter((language): language is LanguageOption => language !== null);

const LanguageMenu = () => {
    const { t } = useTranslation();
    const core = useCore();
    const profile = useProfile();
    const [open, setOpen] = useState(false);

    const close = useCallback(() => setOpen(false), []);

    // profile.settings.interfaceLanguage has been observed in both the hyphenated (ar-AR) and
    // bare ISO 639-2 (ara) forms - match a quick-list entry by either its own code or its
    // sibling 3-letter code, the same dual lookup useInterfaceOptions.ts already relies on.
    const currentLanguage = useMemo(() => {
        const stored = profile.settings.interfaceLanguage;
        return QUICK_LANGUAGES.find(({ code }) => {
            const fullEntry = (interfaceLanguages as { name: string, codes: string[] }[]).find((entry) => entry.codes[0] === code);
            return code === stored || fullEntry?.codes?.[1] === stored;
        }) ?? QUICK_LANGUAGES[0];
    }, [profile.settings.interfaceLanguage]);

    const onLabelClick = useCallback((event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen((wasOpen) => !wasOpen);
    }, []);

    const onMenuClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
    }, []);

    const onSelectLanguage = useCallback((code: string) => {
        core.transport.dispatch({
            action: 'Ctx',
            args: {
                action: 'UpdateSettings',
                args: {
                    ...profile.settings,
                    interfaceLanguage: code
                }
            }
        });
        close();
    }, [core, profile.settings, close]);

    const renderLabel = useCallback(({ ref, className: labelClassName, children }: { ref: React.Ref<HTMLDivElement>, className: string, children: React.ReactNode }) => (
        <div
            ref={ref}
            title={t('LANGUAGE_MENU_TITLE')}
            className={`${styles['label']} ${labelClassName}`}
            onClick={onLabelClick}
        >
            <span className={styles['code']}>{currentLanguage.shortLabel}</span>
            {children}
        </div>
    ), [onLabelClick, currentLanguage, t]);

    const renderMenu = useCallback(() => (
        <div className={styles['menu']} onClick={onMenuClick}>
            {
                QUICK_LANGUAGES.map(({ code, name, shortLabel }) => (
                    <button
                        key={code}
                        type={'button'}
                        className={`${styles['option']} ${code === currentLanguage.code ? styles['selected'] : ''}`}
                        onClick={() => onSelectLanguage(code)}
                    >
                        <span className={styles['option-code']}>{shortLabel}</span>
                        <span className={styles['option-name']}>{name}</span>
                    </button>
                ))
            }
        </div>
    ), [currentLanguage, onSelectLanguage, onMenuClick]);

    return (
        <Popup
            open={open}
            direction={'bottom-right'}
            onCloseRequest={close}
            renderLabel={renderLabel}
            renderMenu={renderMenu}
        />
    );
};

export default LanguageMenu;
