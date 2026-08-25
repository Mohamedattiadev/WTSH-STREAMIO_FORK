// Copyright (C) 2017-2026 Smart code 203358507

import React, { useCallback, useEffect, useRef, useState, MouseEvent, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import Icon from 'stremio/components/Icon';
import useSupabaseAuth from 'stremio/common/Supabase/useSupabaseAuth';
import useCalendarReminders from 'stremio/common/Supabase/useCalendarReminders';
import useToast from 'stremio/common/Toast/useToast';
import styles from './AddToCalendarButton.less';

const MENU_WIDTH = 224;
// Rough height of the rendered form (heading + date input + submit button + padding/gaps) -
// used only to decide whether the popover should flip above the button instead of below when
// it's opened near the bottom of the viewport (e.g. MetaDetails' action row).
const MENU_HEIGHT = 170;
const MENU_MARGIN = 8;

// Same local-date convention Chat's scheduling and Calendar's own manual "add reminder" form
// already use (see Reminders.tsx) - never the server's/UTC's notion of "today".
const getLocalDateString = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

type Props = {
    className?: string,
    title: string,
    poster?: string | null,
    size?: 'lg' | 'sm',
};

// Reused by MetaPreview's action row (MetaDetails hero + every compact preview panel) and by
// every catalog card in MetaItem - both real, already-working paths into the same
// useCalendarReminders.addReminder() the manual Calendar "+" button already calls, per this
// session's actual scope: a real backend write, not a fake "saved" toast with nothing behind it.
//
// Portals the date-picker popover into document.body (position: fixed, coordinates measured
// from the label on open) instead of anchoring it in place like Popup normally does - MetaItem
// cards clip overflow on both .poster-container (for the poster's rounded corners) and
// .poster-actions, which would silently clip an in-place popover down to a sliver.
const AddToCalendarButton = ({ className, title, poster, size = 'lg' }: Props) => {
    const { user } = useSupabaseAuth();
    const { addReminder } = useCalendarReminders(user);
    const toast = useToast();
    const labelRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [date, setDate] = useState(getLocalDateString);
    const [submitting, setSubmitting] = useState(false);

    const close = useCallback(() => setOpen(false), []);

    const onLabelClick = useCallback((event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (user === null) {
            toast.show({
                type: 'info',
                title: 'Sign in required',
                message: 'Sign in to "Watch Reminders & Chat Sync" in Settings to add calendar reminders.',
                timeout: 4000
            });
            return;
        }

        if (labelRef.current) {
            const rect = labelRef.current.getBoundingClientRect();
            const left = Math.min(rect.left, window.innerWidth - MENU_WIDTH - MENU_MARGIN);
            const top = rect.bottom + MENU_MARGIN + MENU_HEIGHT > window.innerHeight ?
                Math.max(MENU_MARGIN, rect.top - MENU_MARGIN - MENU_HEIGHT)
                :
                rect.bottom + MENU_MARGIN;
            setCoords({ top, left: Math.max(MENU_MARGIN, left) });
        }
        setDate(getLocalDateString());
        setOpen((wasOpen) => !wasOpen);
    }, [user, toast]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const onWindowMouseDown = (event: globalThis.MouseEvent) => {
            // @ts-expect-error: Property 'addToCalendarMenuClosePrevented' does not exist on type 'MouseEvent'.
            if (!event.addToCalendarMenuClosePrevented) {
                close();
            }
        };
        const onWindowKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Escape') {
                close();
            }
        };
        window.addEventListener('mousedown', onWindowMouseDown);
        window.addEventListener('keydown', onWindowKeyDown);
        return () => {
            window.removeEventListener('mousedown', onWindowMouseDown);
            window.removeEventListener('keydown', onWindowKeyDown);
        };
    }, [open, close]);

    const onMenuMouseDown = useCallback((event: MouseEvent) => {
        // @ts-expect-error: Property 'addToCalendarMenuClosePrevented' does not exist on type 'MouseEvent'.
        event.nativeEvent.addToCalendarMenuClosePrevented = true;
    }, []);

    // Stops the click from bubbling past the portaled form up through React's tree to
    // whatever the label is nested in (e.g. MetaItem's whole-card link) - the portal moves
    // the form's DOM position but React still bubbles synthetic events along the component
    // tree, not the DOM tree, so this is still required even though the form now lives
    // directly under document.body.
    const onMenuClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
    }, []);

    const onSubmit = useCallback(async (event: FormEvent) => {
        event.preventDefault();
        if (typeof title !== 'string' || title.length === 0 || date.length === 0 || submitting) {
            return;
        }

        setSubmitting(true);
        const result = await addReminder(title, date, 'manual', poster ?? null);
        setSubmitting(false);

        if (result.error) {
            toast.show({
                type: 'error',
                title: 'Error',
                message: result.error.message,
                timeout: 4000
            });
            return;
        }

        toast.show({
            type: 'success',
            title: 'Added to calendar',
            message: `"${title}" was scheduled.`,
            timeout: 3000
        });
        close();
    }, [title, date, poster, submitting, addReminder, toast, close]);

    return (
        <React.Fragment>
            <div
                ref={labelRef}
                title={'Add to Calendar'}
                className={classNames(className, styles['label'], styles[`size-${size}`], { [styles['active']]: open })}
                onClick={onLabelClick}
            >
                <Icon className={styles['icon']} name={'calendar-thin'} />
            </div>
            {
                open ?
                    createPortal(
                        <form
                            className={styles['form']}
                            style={{ top: coords.top, left: coords.left }}
                            onSubmit={onSubmit}
                            onMouseDown={onMenuMouseDown}
                            onClick={onMenuClick}
                        >
                            <div className={styles['heading']}>Add to Calendar</div>
                            <input
                                className={styles['date-input']}
                                type={'date'}
                                value={date}
                                min={getLocalDateString()}
                                autoFocus
                                onChange={(event) => setDate(event.target.value)}
                            />
                            <button type={'submit'} className={styles['submit-button']} disabled={submitting}>
                                {submitting ? 'Adding…' : 'Add'}
                            </button>
                        </form>,
                        document.body
                    )
                    :
                    null
            }
        </React.Fragment>
    );
};

export default AddToCalendarButton;
