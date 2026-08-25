import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Section, Option } from '../../components';
import useGeminiApiKey from 'stremio/common/useGeminiApiKey';
import styles from './GeminiApiKey.less';

// Ask WTSH's chat runs through api/chat.js, which normally reads a single shared GEMINI_API_KEY
// from the server's own environment - fine on the real deployment, but that env var is never set
// running this dev server locally, so Chat silently falls back to the rule-based (non-LLM)
// answers. This lets a user paste their own free Gemini key instead; it's stored in this browser
// only and sent with each /api/chat request, where the server prefers it over its own env var
// (see api/chat.js) - never sent anywhere else.
const GeminiApiKey = () => {
    const { t } = useTranslation();
    const { apiKey, setApiKey } = useGeminiApiKey();
    const [draft, setDraft] = useState(apiKey);
    const [saved, setSaved] = useState(false);

    const onSave = useCallback((event: React.FormEvent) => {
        event.preventDefault();
        setApiKey(draft);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, [draft, setApiKey]);

    const onClear = useCallback(() => {
        setApiKey('');
        setDraft('');
    }, [setApiKey]);

    return (
        <Section>
            <Option className={styles['gemini-api-key']} icon={'sparkles'} label={t('GEMINI_LABEL')}>
                <div className={styles['body']}>
                    <div className={styles['description']}>
                        {t('GEMINI_DESCRIPTION')}{' '}
                        <a className={styles['link']} href={'https://aistudio.google.com/app/apikey'} target={'_blank'} rel={'noreferrer'}>
                            {t('GEMINI_GET_KEY')}
                        </a>
                    </div>
                    <details className={styles['how-to']}>
                        <summary>{t('GEMINI_HOWTO_TOGGLE')}</summary>
                        <ol>
                            <li>{t('GEMINI_STEP_1')}</li>
                            <li>{t('GEMINI_STEP_2')}</li>
                            <li>{t('GEMINI_STEP_3')}</li>
                            <li>{t('GEMINI_STEP_4')}</li>
                        </ol>
                    </details>
                    <form className={styles['form']} onSubmit={onSave}>
                        <input
                            className={styles['input']}
                            type={'password'}
                            placeholder={t('GEMINI_PLACEHOLDER')}
                            value={draft}
                            autoComplete={'off'}
                            spellCheck={false}
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <div className={styles['actions']}>
                            <button type={'submit'} className={styles['save-button']}>
                                {saved ? t('GEMINI_SAVED') : t('GEMINI_SAVE')}
                            </button>
                            {
                                apiKey.length > 0 ?
                                    <button type={'button'} className={styles['clear-button']} onClick={onClear}>
                                        {t('GEMINI_REMOVE')}
                                    </button>
                                    :
                                    null
                            }
                        </div>
                    </form>
                </div>
            </Option>
        </Section>
    );
};

export default GeminiApiKey;
