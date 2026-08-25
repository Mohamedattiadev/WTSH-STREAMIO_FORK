type CalendarEventRow = {
    id: string,
    title: string,
    poster_ref: string | null,
    scheduled_date: string,
    source: 'manual' | 'chat',
    created_at: string,
};
