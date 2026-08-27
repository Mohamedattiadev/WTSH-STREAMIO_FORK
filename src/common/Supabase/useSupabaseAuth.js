// Copyright (C) 2017-2026 Smart code 203358507

const React = require('react');
const useProfile = require('stremio/common/useProfile');
const { getSupabaseClient, isSupabaseConfigured } = require('./supabaseClient');

// Module-level (not per-hook-instance) so the many components that independently call
// useSupabaseAuth() (EmberAccount, Reminders, AddToCalendarButton, Chat, ...) never each fire
// their own /api/link-account request the moment they all mount together - only the first one
// to notice claims a Stremio authKey, the rest just wait on the same Supabase auth state.
let autoLinkAttemptedForKey = null;

// Real auth state for the Supabase-backed features (calendar reminders, chat history) - a
// separate account system from this app's own Stremio login, which stays exactly as-is and
// keeps handling addon/library sync. Nothing here touches that.
//
// Supabase's default email provider only delivers to org members unless the project has custom
// SMTP configured (see supabase.com/changelog/29370) - signUp() below surfaces whichever of the
// two real outcomes actually happened (session issued immediately vs. a confirmation email is
// pending) rather than assuming one. Manual sign-in/sign-up stay as a fallback for when
// auto-link below isn't configured or fails - never removed just because auto-link exists.
const useSupabaseAuth = () => {
    const configured = isSupabaseConfigured();
    const profile = useProfile();
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

    // Silently links this Supabase account to whichever Stremio account is already signed in,
    // so a user who has signed into Stremio once never needs a second, separate email/password
    // for calendar reminders and chat sync - api/link-account.js verifies the Stremio session is
    // real (against Stremio's own account API) before ever minting a Supabase session for it, so
    // this can't be used to claim someone else's Supabase account just by knowing their email.
    React.useEffect(() => {
        if (!configured || loading || user !== null) {
            return;
        }

        const authKey = profile.auth?.key;
        if (typeof authKey !== 'string' || authKey.length === 0 || autoLinkAttemptedForKey === authKey) {
            return;
        }
        autoLinkAttemptedForKey = authKey;

        // Deliberately no cleanup/cancellation here - the module-level guard above already
        // makes this a true one-shot regardless of how many useSupabaseAuth() instances exist,
        // which matters because React.StrictMode's dev-mode mount->cleanup->remount would
        // otherwise abort this exact attempt via a `cancelled` flag right after it starts, while
        // the guard blocks the remount from ever retrying - confirmed live, that combination
        // let the /api/link-account request through but silently dropped the verifyOtp call
        // that actually establishes the session, forever.
        //
        // Reuses the same `loading` flag EmberAccount already shows a "Loading..." state for,
        // rather than flashing its manual sign-in form for the second or so this takes - no
        // other useSupabaseAuth() caller reads `loading` today, so this is safe to widen.
        setLoading(true);
        (async () => {
            try {
                const response = await fetch('/api/link-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ authKey })
                });
                const data = await response.json();
                if (!response.ok || typeof data.tokenHash !== 'string') {
                    return;
                }

                const supabase = getSupabaseClient();
                await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: data.type });
                // onAuthStateChange (subscribed in the effect above) picks up the new session and
                // updates `user` for every useSupabaseAuth() caller - nothing else to do here.
            } catch (_error) {
                // Silent - this is a background convenience link, not a user-initiated action.
                // The manual sign-in form (still rendered whenever user === null) is the fallback.
            } finally {
                setLoading(false);
            }
        })();
    }, [configured, loading, user, profile.auth?.key]);

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
