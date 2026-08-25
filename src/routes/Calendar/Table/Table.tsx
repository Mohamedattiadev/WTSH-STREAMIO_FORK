// Copyright (C) 2017-2024 Smart code 203358507

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Table.less';
import Cell from './Cell/Cell';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

type Props = {
    items: CalendarItem[],
    selected: CalendarDate | null,
    monthInfo: CalendarMonthInfo,
    remindersByDay?: Map<number, CalendarEventRow[]>,
    onChange: (date: CalendarDate) => void,
    onReminderClick?: (reminder: CalendarEventRow) => void,
};

const Table = ({ items, selected, monthInfo, remindersByDay, onChange, onReminderClick }: Props) => {
    const { t } = useTranslation();

    const cellsOffset = useMemo(() => {
        return Array.from(Array(monthInfo.firstWeekday).keys());
    }, [monthInfo]);

    return (
        <div className={styles['table']}>
            <div className={styles['week']}>
                {
                    WEEK_DAYS.map((day) => (
                        <div className={styles['day']} key={day}>
                            <span className={styles['long']}>
                                {t(day)}
                            </span>
                            <span className={styles['short']}>
                                {t(day).slice(0, 3)}
                            </span>
                        </div>
                    ))
                }
            </div>
            <div className={styles['grid']}>
                {
                    cellsOffset.map((day) => (
                        <span key={day} />
                    ))
                }
                {
                    items.map((item) => (
                        <Cell
                            key={item.date.day}
                            {...item}
                            selected={selected}
                            monthInfo={monthInfo}
                            reminders={remindersByDay?.get(item.date.day)}
                            onClick={onChange}
                            onReminderClick={onReminderClick}
                        />
                    ))
                }
            </div>
        </div>
    );
};

export default Table;
