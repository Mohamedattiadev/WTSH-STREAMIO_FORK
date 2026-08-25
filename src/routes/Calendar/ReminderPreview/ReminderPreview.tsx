// Copyright (C) 2017-2026 Smart code 203358507

import React, { useMemo } from 'react';
import { Button, Image } from 'stremio/components';
import Icon from 'stremio/components/Icon';
import styles from './ReminderPreview.less';

type Props = {
    reminder: CalendarEventRow,
    onCloseRequest: () => void,
    onRemove: (id: string) => void,
};

// A lightweight info panel for a manual/chat-created calendar reminder, shown when clicking its
// marker on a day square. Deliberately NOT VideoPreview's full MetaPreview re-fetch pattern -
// calendar_events (see supabase/schema.sql) only ever stored {title, poster_ref,
// scheduled_date, source}, never a real deep link back to the catalog item, so there's no id to
// re-fetch full MetaDetails from without fabricating one. This shows exactly the real fields
// that exist instead of pretending to be a full preview panel.
const ReminderPreview = ({ reminder, onCloseRequest, onRemove }: Props) => {
    const dateLabel = useMemo(() => {
        return new Date(`${reminder.scheduled_date}T00:00:00`).toLocaleString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }, [reminder.scheduled_date]);

    return (
        <div className={styles['reminder-preview']}>
            <Button className={styles['close-button']} title={'Close'} onClick={onCloseRequest}>
                <Icon className={styles['icon']} name={'close'} />
            </Button>
            {
                typeof reminder.poster_ref === 'string' && reminder.poster_ref.length > 0 ?
                    <Image className={styles['poster']} src={reminder.poster_ref} alt={reminder.title} />
                    :
                    <div className={styles['poster-placeholder']}>
                        <Icon className={styles['icon']} name={'calendar-thin'} />
                    </div>
            }
            <div className={styles['body']}>
                <div className={styles['title']}>{reminder.title}</div>
                <div className={styles['date']}>{dateLabel}</div>
                {
                    reminder.source === 'chat' ?
                        <div className={styles['source-badge']}>via chat</div>
                        :
                        null
                }
                <Button className={styles['remove-button']} onClick={() => onRemove(reminder.id)}>
                    <Icon className={styles['icon']} name={'bin'} />
                    <div className={styles['label']}>Remove reminder</div>
                </Button>
            </div>
        </div>
    );
};

export default ReminderPreview;
