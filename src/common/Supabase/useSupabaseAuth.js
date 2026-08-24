// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const { getSupabaseClient, isSupabaseConfigured } = require('./supabaseClient');

// Real auth state for the Supabase-backed features (calendar reminders, chat history) - a
// separate account system from this app's own Stremio login, which stays exactly as-is and
// keeps handling addon/library sync. Nothing here touches that.
//
// Supabase's default email provider only delivers to org members unless the project has custom
// SMTP configured (see supabase.com/changelog/29370) - signUp() below surfaces whichever of the
// two real outcomes actually happened (session issued immediately vs. a confirmation email is
// pending) rather than assuming one.
const useSupabaseAuth = () => {
    const configured = isSupabaseConfigured();
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(configured);

    React.useEffect(() => {
        if (!configured) {
            return;
        }

        const supabase = getSupabaseClient();
        let mounted = true;

        supabase.auth.getSession().then(({ data }) => {
            if (mounted) {
                setUser(data.session?.user ?? null);
                setLoading(false);
            }
        });

        const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setUser(session?.user ?? null);
            }
        });

        return () => {
            mounted = false;
            subscription.subscription.unsubscribe();
        };
    }, [configured]);

    const signUp = React.useCallback(async (email, password) => {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
            return { error };
        }
        // A null session means Supabase queued a confirmation email instead of signing the
        // user in immediately - real outcome, not something to paper over.
        return { error: null, needsEmailConfirmation: data.session === null };
    }, []);

    const signIn = React.useCallback(async (email, password) => {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    }, []);

    const signOut = React.useCallback(async () => {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut();
    }, []);

    return { configured, user, loading, signUp, signIn, signOut };
};

module.exports = useSupabaseAuth;
