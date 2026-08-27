// Copyright (C) 2017-2024 Smart code 203358507

import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useProfile, withCoreSuspender } from 'stremio/common';
import { MainNavBars, BottomSheet } from 'stremio/components';
import useSupabaseAuth from 'stremio/common/Supabase/useSupabaseAuth';
import useCalendarReminders from 'stremio/common/Supabase/useCalendarReminders';
import Selector from './Selector';
import Table from './Table';
import List from './List';
import Reminders from './Reminders';
import Details from './Details';
import VideoPreview from './VideoPreview';
import ReminderPreview from './ReminderPreview';
import Placeholder from './Placeholder';
import useCalendar from './useCalendar';
import useCalendarDate from './useCalendarDate';
import styles from './Calendar.less';
import classNames from 'classnames';

const Calendar = () => {
    const { year, month } = useParams();
    const urlParams = React.useMemo(() => ({
        year,
        month
    }), [year, month]);
    const calendar = useCalendar(urlParams);
    const profile = useProfile();
    const { user: supabaseUser } = useSupabaseAuth();
    const { reminders, removeReminder } = useCalendarReminders(supabaseUser);

    const { toDayMonth } = useCalendarDate(profile);

    const [selected, setSelected] = useState<CalendarDate | null>(null);
    const [previewDeepLink, setPreviewDeepLink] = useState<string | null>(null);
    const [selectedReminder, setSelectedReminder] = useState<CalendarEventRow | null>(null);

    const detailsTitle = useMemo(() => toDayMonth(selected), [selected, toDayMonth]);

    // Groups reminders scheduled within the month actually on screen (derived from the real
    // items core already returned, rather than trusting the URL's year/month, which can be
    // absent - default-month loads pass urlParams through as null to useCalendar) by day, so
    // Table/Cell can look each day's reminders up in O(1) without re-filtering per cell.
    const remindersByDay = useMemo(() => {
        const map = new Map<number, CalendarEventRow[]>();
        const displayedYear = calendar.items[0]?.date.year;
        const displayedMonth = calendar.items[0]?.date.month;
        if (typeof displayedYear !== 'number' || typeof displayedMonth !== 'number') {
            return map;
        }

        for (const reminder of reminders) {
            const [year, month, day] = reminder.scheduled_date.split('-').map(Number);
            if (year === displayedYear && month === displayedMonth) {
                const existing = map.get(day) ?? [];
                existing.push(reminder);
                map.set(day, existing);
            }
        }

        return map;
    }, [calendar.items, reminders]);

    const onDetailsClose = () => {
        setSelected(null);
    };
    const onVideoSelect = (deepLink: string) => {
        setPreviewDeepLink(deepLink);
    };
    const onPreviewClose = () => {
        setPreviewDeepLink(null);
    };
    const onReminderSelect = (reminder: CalendarEventRow) => {
        setSelectedReminder(reminder);
    };
    const onReminderPreviewClose = () => {
        setSelectedReminder(null);
    };
    const onReminderRemove = (id: string) => {
        removeReminder(id);
        setSelectedReminder(null);
    };

    return (
        <MainNavBars className={styles['calendar']} route={'calendar'}>
            {
                profile.auth !== null ?
                    <div className={classNames(styles['content'], 'animation-fade-in')}>
                        <div className={styles['main']}>
                            <Selector
                                selected={calendar.selected}
                                selectable={calendar.selectable}
                                profile={profile}
                            />
                            <Table
                                items={calendar.items}
                                selected={selected}
                                monthInfo={calendar.monthInfo}
                                remindersByDay={remindersByDay}
                                onChange={setSelected}
                                onReminderClick={onReminderSelect}
                            />
                        </div>
                        <div className={styles['side']}>
                            {
                                previewDeepLink !== null ?
                                    <VideoPreview deepLink={previewDeepLink} onCloseRequest={onPreviewClose} />
                                    :
                                    selectedReminder !== null ?
                                        <ReminderPreview reminder={selectedReminder} onCloseRequest={onReminderPreviewClose} onRemove={onReminderRemove} />
                                        :
                                        null
                            }
                            <List
                                items={calendar.items}
                                selected={selected}
                                monthInfo={calendar.monthInfo}
                                profile={profile}
                                onChange={setSelected}
                            />
                            <Reminders onSelect={onReminderSelect} />
                        </div>
                        <BottomSheet title={detailsTitle} show={!!selected} onClose={onDetailsClose}>
                            <Details
                                selected={selected}
                                items={calendar.items}
                                onVideoSelect={onVideoSelect}
                            />
                        </BottomSheet>
                    </div>
                    :
                    supabaseUser !== null ?
                        <div className={classNames(styles['content'], 'animation-fade-in')}>
                            <div className={styles['side']}>
                                {
                                    selectedReminder !== null ?
                                        <ReminderPreview reminder={selectedReminder} onCloseRequest={onReminderPreviewClose} onRemove={onReminderRemove} />
                                        :
                                        null
                                }
                                <Reminders onSelect={onReminderSelect} />
                            </div>
                        </div>
                        :
                        <Placeholder />
            }
        </MainNavBars>
    );
};

const CalendarFallback = () => (
    <MainNavBars className={styles['calendar']} />
);

export default withCoreSuspender(Calendar, CalendarFallback);
