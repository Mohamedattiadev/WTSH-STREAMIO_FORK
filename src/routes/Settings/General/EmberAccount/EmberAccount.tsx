import React, { useCallback, useState } from 'react';
import { Section, Option } from '../../components';
import useSupabaseAuth from 'stremio/common/Supabase/useSupabaseAuth';
import useCalendarReminders from 'stremio/common/Supabase/useCalendarReminders';
import styles from './EmberAccount.less';

// A separate account system from this app's own Stremio login above (User/General.tsx), which
// keeps handling addon/library sync exactly as before. This one is only for the features the
// Ember Rail redesign added that Stremio's own backend has no concept of: calendar reminders
// and Ask WTSH chat history, persisted via Supabase so they survive across sessions/devices.
const EmberAccount = () => {
    const { configured, user, loading, signUp, signIn, signOut } = useSupabaseAuth();
    const { reminders, removeReminder } = useCalendarReminders(user);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
    const [status, setStatus] = useState<{ type: 'error' | 'info', message: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (email.trim().length === 0 || password.length === 0) {
            return;
        }

        setSubmitting(true);
        setStatus(null);
        const result = mode === 'sign-up' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
        setSubmitting(false);

        if (result.error) {
            setStatus({ type: 'error', message: result.error.message });
            return;
        }

        if (mode === 'sign-up' && result.needsEmailConfirmation) {
            setStatus({ type: 'info', message: 'Check your email to confirm your account before signing in.' });
            return;
        }

        setEmail('');
        setPassword('');
    }, [email, password, mode, signUp, signIn]);

    const onSignOut = useCallback(() => {
        signOut();
    }, [signOut]);

    if (!configured) {
        return null;
    }

    return (
        <Section>
            <Option className={styles['ember-account']} icon={'calendar'} label={'Watch Reminders & Chat Sync'}>
                {
                    loading ?
                        <div className={styles['status-label']}>Loading...</div>
                        :
                        user !== null ?
                            <div className={styles['signed-in-container']}>
                                <div className={styles['signed-in-row']}>
                                    <div className={styles['signed-in-email']} title={user.email}>{user.email}</div>
                                    <button type={'button'} className={styles['sign-out-button']} onClick={onSignOut}>Sign out</button>
                                </div>
                                {
                                    reminders.length > 0 ?
                                        <div className={styles['reminders-list']}>
                                            <div className={styles['reminders-heading']}>Watch reminders</div>
                                            {reminders.map((reminder) => (
                                                <div key={reminder.id} className={styles['reminder-row']}>
                                                    <div className={styles['reminder-title']} title={reminder.title}>{reminder.title}</div>
                                                    <div className={styles['reminder-date']}>{reminder.scheduled_date}</div>
                                                    <button
                                                        type={'button'}
                                                        className={styles['reminder-remove']}
                                                        title={'Remove'}
                                                        onClick={() => removeReminder(reminder.id)}
                                                    >
                                                        {'×'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        :
                                        null
                                }
                            </div>
                            :
                            <form className={styles['auth-form']} onSubmit={onSubmit}>
                                <input
                                    className={styles['input']}
                                    type={'email'}
                                    placeholder={'Email'}
                                    value={email}
                                    autoComplete={'email'}
                                    onChange={(event) => setEmail(event.target.value)}
                                />
                                <input
                                    className={styles['input']}
                                    type={'password'}
                                    placeholder={'Password'}
                                    value={password}
                                    autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                                    onChange={(event) => setPassword(event.target.value)}
                                />
                                {
                                    status !== null ?
                                        <div className={styles[status.type === 'error' ? 'error-label' : 'status-label']}>{status.message}</div>
                                        :
                                        null
                                }
                                <div className={styles['auth-actions']}>
                                    <button type={'submit'} className={styles['submit-button']} disabled={submitting}>
                                        {mode === 'sign-up' ? 'Sign up' : 'Sign in'}
                                    </button>
                                    <button
                                        type={'button'}
                                        className={styles['switch-mode-button']}
                                        onClick={() => { setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up'); setStatus(null); }}
                                    >
                                        {mode === 'sign-up' ? 'Have an account? Sign in' : 'New here? Sign up'}
                                    </button>
                                </div>
                            </form>
                }
            </Option>
        </Section>
    );
};

export default EmberAccount;
