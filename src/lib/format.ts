import type { GalleryScale } from "@/lib/settings";

const SHORT_MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const FULL_MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

/** Returns a value identifying the local calendar day of a timestamp. */
export function getDayKey(timestamp: number): number {
    const date = new Date(timestamp);

    return date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate();
}

/**
 * Formats a grid section title: "Apr 22" within the current year,
 * "Apr 22, 2025" for earlier years.
 */
export function formatDayTitle(timestamp: number): string {
    const date = new Date(timestamp);
    const title = `${SHORT_MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;

    if (date.getFullYear() >= new Date().getFullYear()) {
        return title;
    }

    return `${title}, ${date.getFullYear()}`;
}

export function getGallerySection(timestamp: number, scale: GalleryScale) {
    const date = new Date(timestamp);

    if (scale === "small") {
        return { key: getDayKey(timestamp), title: formatDayTitle(timestamp) };
    }

    if (scale === "large") {
        date.setDate(1);

        return {
            key: getDayKey(date.getTime()),
            title:
                SHORT_MONTH_NAMES[date.getMonth()] +
                (date.getFullYear() < new Date().getFullYear()
                    ? ` ${date.getFullYear()}`
                    : ""),
        };
    }

    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const sunday = new Date(date);

    sunday.setDate(sunday.getDate() + 6);

    return {
        key: getDayKey(date.getTime()),
        title: `${formatDayTitle(date.getTime())} – ${formatDayTitle(sunday.getTime())}`,
    };
}

/** Formats a full date such as "April 22, 2025". */
export function formatFullDate(timestamp: number): string {
    const date = new Date(timestamp);

    return `${FULL_MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Formats a time of day such as "09:41". */
export function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");

    return `${hours}:${minutes}`;
}

/** Formats a video duration in milliseconds such as "1:05" or "1:02:09". */
export function formatDuration(milliseconds: number): string {
    const totalSeconds = Math.round(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds}`;
    }

    return `${minutes}:${seconds}`;
}
