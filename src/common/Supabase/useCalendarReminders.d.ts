declare const useCalendarReminders: (user: { id: string } | null) => {
    reminders: CalendarEventRow[],
    loading: boolean,
    addReminder: (title: string, scheduledDate: string, source?: 'manual' | 'chat', posterRef?: string | null) => Promise<{ error: Error | null }>,
    removeReminder: (id: string) => Promise<void>,
};
export = useCalendarReminders;
