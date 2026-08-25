// Copyright (C) 2017-2026 Smart code 203358507

import {
    Home, Compass, Library, Calendar, CalendarDays, Puzzle, Settings, Info, Users, Plus,
    Trash2, ChevronDown, ChevronLeft, ChevronRight, X, Check, Search,
    SlidersHorizontal, Share2, Cast, Captions, Gauge, Network, Download, MoreHorizontal,
    MoreVertical, Eye, HelpCircle, AlertTriangle, Magnet, Megaphone, Bell, Minus, RotateCcw, RotateCw, ArrowUp,
    RefreshCcw, Link2, Link2Off, User, FolderDown, AudioLines, ListVideo, Clapperboard,
    CloudDownload, Ratio, Contrast, SkipForward, Gamepad2, Volume1, Glasses, Play, Pause,
    Maximize2, Minimize2, Globe, Star, Copy, Sparkles,
    type LucideIcon
} from 'lucide-react';

// Maps this app's existing icon names (see @stremio/stremio-icons) to a lucide-react
// equivalent. Only generic UI icons are mapped here - brand/trademark marks (facebook,
// reddit, imdb, discord, trakt, vlc, macos) and the app's own "symbol" mark are deliberately
// left out so Icon.tsx falls back to the original @stremio/stremio-icons set for those:
// lucide doesn't ship logos by design, and a brand mark needs to stay pixel-recognizable.
//
// A trailing "-outline" on the requested name (e.g. NavTabButton's selected/unselected
// pattern) is stripped by Icon.tsx before this lookup - lucide is a single-style stroke set
// with no separate filled/outline geometry per icon, and the selected/unselected visual
// distinction in this app is already carried by color+opacity in CSS, not icon geometry.
export const ICON_MAP: Record<string, LucideIcon> = {
    home: Home,
    discover: Compass,
    library: Library,
    calendar: Calendar,
    'calendar-thin': CalendarDays,
    addons: Puzzle,
    settings: Settings,
    about: Info,
    globe: Globe,
    actors: Users,
    add: Plus,
    'aspect-ratio': Ratio,
    'audio-tracks': AudioLines,
    bin: Trash2,
    'caret-down': ChevronDown,
    'caret-left': ChevronLeft,
    'caret-right': ChevronRight,
    cast: Cast,
    checkmark: Check,
    'chevron-back': ChevronLeft,
    'chevron-forward': ChevronRight,
    close: X,
    'cloud-library': CloudDownload,
    copy: Copy,
    download: Download,
    episodes: ListVideo,
    eye: Eye,
    filters: SlidersHorizontal,
    glasses: Glasses,
    hdr: Contrast,
    help: HelpCircle,
    ic_broken_link: Link2Off,
    ic_downloads: FolderDown,
    link: Link2,
    'magnet-link': Magnet,
    maximize: Maximize2,
    megaphone: Megaphone,
    minimize: Minimize2,
    'more-horizontal': MoreHorizontal,
    'more-vertical': MoreVertical,
    network: Network,
    next: SkipForward,
    'skip-back': RotateCcw,
    'skip-forward': RotateCw,
    notifications: Bell,
    'arrow-up': ArrowUp,
    pause: Pause,
    person: User,
    play: Play,
    remote: Gamepad2,
    remove: Minus,
    replay: RotateCcw,
    reset: RefreshCcw,
    search: Search,
    share: Share2,
    speed: Gauge,
    sparkles: Sparkles,
    star: Star,
    subtitles: Captions,
    trailer: Clapperboard,
    'volume-medium': Volume1,
    warning: AlertTriangle,
    x: X
};
