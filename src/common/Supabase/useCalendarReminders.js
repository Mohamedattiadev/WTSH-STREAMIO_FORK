// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const { getSupabaseClient } = require('./supabaseClient');

// Real Supabase-backed personal watch reminders - distinct from stremio-core's own Calendar
// model (src/routes/Calendar/useCalendar.ts), which is a read-only release calendar derived
// from addon metadata and has no concept of a user-created entry. This is the "manual calendar
// entry" path the Chat route's scheduling extraction writes through (see useChatSession.js).
const useCalendarReminders = (user) => {
    const [reminders, setReminders] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    const reload = React.useCallback(() => {
        if (user === null) {
            setReminders([]);
            return;
        }

        setLoading(true);
        const supabase = getSupabaseClient();
        supabase
            .from('calendar_events')
            .select('id, title, poster_ref, scheduled_date, source, created_at')
            .order('scheduled_date', { ascending: true })
            .then(({ data, error }) => {
                setLoading(false);
                if (!error && Array.isArray(data)) {
                    setReminders(data);
                }
            });
    }, [user]);

    React.useEffect(() => {
        reload();
    }, [reload]);

    const addReminder = React.useCallback(async (title, scheduledDate, source = 'manual', posterRef = null) => {
        if (user === null) {
            return { error: new Error('Not signed in') };
        }

        const supabase = getSupabaseClient();
        const { error } = await supabase.from('calendar_events').insert({
            user_id: user.id,
            title,
            poster_ref: posterRef,
            scheduled_date: scheduledDate,
            source
        });

        if (!error) {
            reload();
        }
        return { error };
    }, [user, reload]);

    const removeReminder = React.useCallback(async (id) => {
        if (user === null) {
            return;
        }

        const supabase = getSupabaseClient();
        await supabase.from('calendar_events').delete().eq('id', id);
        reload();
    }, [user, reload]);

    return { reminders, loading, addReminder, removeReminder };
};

module.exports = useCalendarReminders;
