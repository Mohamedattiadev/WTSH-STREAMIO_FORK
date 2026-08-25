import React, { useCallback, useState } from 'react';
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
            <Option className={styles['gemini-api-key']} icon={'sparkles'} label={'Ask WTSH (Gemini API Key)'}>
                <div className={styles['body']}>
                    <div className={styles['description']}>
                        Optional - use your own free Gemini key for Chat instead of relying on the app&apos;s shared key.{' '}
                        <a className={styles['link']} href={'https://aistudio.google.com/app/apikey'} target={'_blank'} rel={'noreferrer'}>
                            Get a key
                        </a>
                    </div>
                    <details className={styles['how-to']}>
                        <summary>How do I get a key?</summary>
                        <ol>
                            <li>
                                Open{' '}
                                <a className={styles['link']} href={'https://aistudio.google.com/app/apikey'} target={'_blank'} rel={'noreferrer'}>
                                    aistudio.google.com/app/apikey
                                </a>{' '}
                                and sign in with any Google account.
                            </li>
                            <li>Click <strong>Create API key</strong> (accept the default project if it asks you to pick one - any project works).</li>
                            <li>Copy the key it generates.</li>
                            <li>Paste it into the field below and click Save.</li>
                        </ol>
                    </details>
                    <form className={styles['form']} onSubmit={onSave}>
                        <input
                            className={styles['input']}
                            type={'password'}
                            placeholder={'Gemini API key'}
                            value={draft}
                            autoComplete={'off'}
                            spellCheck={false}
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <div className={styles['actions']}>
                            <button type={'submit'} className={styles['save-button']}>
                                {saved ? 'Saved' : 'Save'}
                            </button>
                            {
                                apiKey.length > 0 ?
                                    <button type={'button'} className={styles['clear-button']} onClick={onClear}>
                                        Remove
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
