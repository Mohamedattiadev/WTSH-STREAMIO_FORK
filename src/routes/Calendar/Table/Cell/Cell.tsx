// Copyright (C) 2017-2024 Smart code 203358507

import React, { useCallback, useMemo, MouseEvent } from 'react';
import Icon from 'stremio/components/Icon';
import classNames from 'classnames';
import { useNavigateWithOrigin } from 'stremio-router';
import { Button, HorizontalScroll, Image } from 'stremio/components';
import styles from './Cell.less';

type Props = {
    selected: CalendarDate | null,
    monthInfo: CalendarMonthInfo,
    date: CalendarDate,
    items: CalendarContentItem[],
    reminders?: CalendarEventRow[],
    onClick: (date: CalendarDate) => void,
    onReminderClick?: (reminder: CalendarEventRow) => void,
};

const Cell = ({ selected, monthInfo, date, items, reminders, onClick, onReminderClick }: Props) => {
    const { navigateWithOrigin } = useNavigateWithOrigin();
    const [active, today] = useMemo(() => [
        date.day === selected?.day,
        date.day === monthInfo.today,
    ], [selected, monthInfo, date]);

    const onCellClick = () => {
        onClick && onClick(date);
    };

    const onPosterClick = useCallback((event: MouseEvent<HTMLDivElement>, target: string) => {
        event.preventDefault();
        event.stopPropagation();
        navigateWithOrigin(target);
    }, [navigateWithOrigin]);

    const onReminderPosterClick = useCallback((event: MouseEvent<HTMLDivElement>, reminder: CalendarEventRow) => {
        event.preventDefault();
        event.stopPropagation();
        onReminderClick && onReminderClick(reminder);
    }, [onReminderClick]);

    const hasReminders = Array.isArray(reminders) && reminders.length > 0;

    return (
        <Button
            className={classNames(styles['cell'], { [styles['active']]: active, [styles['today']]: today })}
            onClick={onCellClick}
        >
            <div className={styles['heading']}>
                <div className={styles['day']}>
                    {date.day}
                </div>
            </div>
            <HorizontalScroll className={styles['items']}>
                {
                    items.map(({ id, name, poster, deepLinks }) => (
                        <Button key={id} className={styles['item']} href={deepLinks.metaDetailsStreams} tabIndex={-1} onClick={(event) => onPosterClick(event, deepLinks.metaDetailsStreams)}>
                            <Icon className={styles['icon']} name={'play'} />
                            <Image
                                className={styles['poster']}
                                src={poster}
                                alt={name}
                            />
                        </Button>
                    ))
                }
                {
                    hasReminders ?
                        reminders.map((reminder) => (
                            <Button key={reminder.id} className={classNames(styles['item'], styles['reminder-item'])} tabIndex={-1} onClick={(event) => onReminderPosterClick(event, reminder)}>
                                <Icon className={classNames(styles['icon'], styles['reminder-icon'])} name={'calendar-thin'} />
                                {
                                    typeof reminder.poster_ref === 'string' && reminder.poster_ref.length > 0 ?
                                        <Image
                                            className={styles['poster']}
                                            src={reminder.poster_ref}
                                            alt={reminder.title}
                                        />
                                        :
                                        <div className={styles['reminder-poster-placeholder']}>
                                            <Icon className={styles['icon']} name={'calendar-thin'} />
                                        </div>
                                }
                            </Button>
                        ))
                        :
                        null
                }
            </HorizontalScroll>
            {
                items.length > 0 || hasReminders ?
                    <Icon className={styles['more']} name={'more-horizontal'} />
                    :
                    null
            }
        </Button>
    );
};

export default Cell;
