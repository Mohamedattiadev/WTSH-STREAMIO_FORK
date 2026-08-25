// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import Icon from 'stremio/components/Icon';
import { Button, Image } from 'stremio/components';
import useSupabaseAuth from 'stremio/common/Supabase/useSupabaseAuth';
import useCalendarReminders from 'stremio/common/Supabase/useCalendarReminders';
import styles from './Reminders.less';

// Formats today's local date as YYYY-MM-DD for the date input's min bound - matches the same
// local-date convention Chat's scheduling already uses (see answerGenerator.js's
// getLocalDateString), not the server's/UTC's own notion of "today".
const getLocalDateString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Displays the reminders Chat's scheduling extraction (or a future manual "remind me" action)
// writes to Supabase's calendar_events table (see useCalendarReminders.js) - that table had a
// working writer since Chat shipped, but nothing ever read it back, so a reminder Chat created
// never actually showed up anywhere. This is that missing read side.
//
// Gated on the Supabase account only, deliberately independent of the Stremio-native `profile.auth`
// gate the rest of this route uses - the two are separate sign-in systems (see
// useSupabaseAuth.js), and a user who only set up "Watch Reminders & Chat Sync" should still see
// what they scheduled even without a Stremio account.
const Reminders = () => {
    const { user } = useSupabaseAuth();
    const { reminders, addReminder, removeReminder } = useCalendarReminders(user);
    const [formOpen, setFormOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(getLocalDateString);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onRemoveClick = useCallback((event: React.MouseEvent, id: string) => {
        event.preventDefault();
        event.stopPropagation();
        removeReminder(id);
    }, [removeReminder]);

    const onToggleForm = useCallback(() => {
        setFormOpen((open) => !open);
        setError(null);
    }, []);

    const onSubmit = useCallback(async (event: React.FormEvent) => {
        event.preventDefault();
        if (title.trim().length === 0 || date.length === 0) {
            return;
        }

        setSubmitting(true);
        setError(null);
        const result = await addReminder(title.trim(), date);
        setSubmitting(false);

        if (result.error) {
            setError(result.error.message);
            return;
        }

        setTitle('');
        setDate(getLocalDateString());
        setFormOpen(false);
    }, [title, date, addReminder]);

    return (
        <div className={styles['reminders']}>
            <div className={styles['heading-row']}>
                <div className={styles['heading']}>Your Reminders</div>
                {
                    user !== null ?
                        <Button className={styles['add-button']} title={'Add reminder'} onClick={onToggleForm}>
                            <Icon className={styles['icon']} name={formOpen ? 'close' : 'add'} />
                        </Button>
                        :
                        null
                }
            </div>
            {
                formOpen ?
                    <form className={styles['add-form']} onSubmit={onSubmit}>
                        <input
                            className={styles['add-input']}
                            type={'text'}
                            placeholder={'Title'}
                            value={title}
                            autoFocus
                            onChange={(event) => setTitle(event.target.value)}
                        />
                        <input
                            className={styles['add-input']}
                            type={'date'}
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                        />
                        {
                            error !== null ?
                                <div className={styles['error-label']}>{error}</div>
                                :
                                null
                        }
                        <button type={'submit'} className={styles['add-submit-button']} disabled={submitting}>
                            Add
                        </button>
                    </form>
                    :
                    null
            }
            <div className={styles['body']}>
                {
                    user === null ?
                        <div className={styles['empty']}>Sign in to "Watch Reminders & Chat Sync" in Settings to get reminders here.</div>
                        :
                    reminders.length === 0 ?
                        <div className={styles['empty']}>No reminders yet - ask "Ask WTSH" to schedule something, like "I'll watch [title] on Friday".</div>
                        :
                        reminders.map(({ id, title, poster_ref: poster, scheduled_date: scheduledDate, source }) => {
                            const dateLabel = new Date(`${scheduledDate}T00:00:00`).toLocaleString(undefined, {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short'
                            });
                            return (
                                <div className={styles['reminder']} key={id}>
                                    {
                                        typeof poster === 'string' && poster.length > 0 ?
                                            <Image className={styles['thumb']} src={poster} alt={title} />
                                            :
                                            <div className={styles['thumb-placeholder']}>
                                                <Icon className={styles['icon']} name={'calendar-thin'} />
                                            </div>
                                    }
                                    <div className={styles['body-text']}>
                                        <div className={styles['name']}>{title}</div>
                                        <div className={styles['info']}>
                                            {dateLabel}
                                            {source === 'chat' ? <span className={styles['source-badge']}>via chat</span> : null}
                                        </div>
                                    </div>
                                    <Button className={styles['remove-button']} title={'Remove'} onClick={(event) => onRemoveClick(event, id)}>
                                        <Icon className={classNames(styles['icon'], styles['remove-icon'])} name={'bin'} />
                                    </Button>
                                </div>
                            );
                        })
                }
            </div>
        </div>
    );
};

export default Reminders;
