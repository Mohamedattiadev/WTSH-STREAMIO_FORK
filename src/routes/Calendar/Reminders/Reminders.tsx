// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback } from 'react';
import classNames from 'classnames';
import Icon from 'stremio/components/Icon';
import { Button, Image } from 'stremio/components';
import useSupabaseAuth from 'stremio/common/Supabase/useSupabaseAuth';
import useCalendarReminders from 'stremio/common/Supabase/useCalendarReminders';
import styles from './Reminders.less';

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
    const { reminders, removeReminder } = useCalendarReminders(user);

    const onRemoveClick = useCallback((event: React.MouseEvent, id: string) => {
        event.preventDefault();
        event.stopPropagation();
        removeReminder(id);
    }, [removeReminder]);

    if (user === null) {
        return null;
    }

    return (
        <div className={styles['reminders']}>
            <div className={styles['heading']}>Your Reminders</div>
            <div className={styles['body']}>
                {
                    reminders.length === 0 ?
                        <div className={styles['empty']}>No reminders yet - ask "Ask WTS" to schedule something, like "I'll watch [title] on Friday".</div>
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
