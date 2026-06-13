import type { StatusFilter, StatusStyle } from "@/app/types/poker-session";

export const DEFAULT_STATUS_STYLE: StatusStyle = {
	label: "Wartet",
	dot: "bg-yellow-400",
	text: "text-yellow-300",
};

export const STATUS_STYLES: Record<string, StatusStyle> = {
	waiting: { label: "Wartet", dot: "bg-yellow-400", text: "text-yellow-300" },
	laufend: DEFAULT_STATUS_STYLE,
	active: { label: "Aktiv", dot: "bg-emerald-400", text: "text-emerald-300" },
	gestartet: {
		label: "Aktiv",
		dot: "bg-emerald-400",
		text: "text-emerald-300",
	},
	finished: { label: "Beendet", dot: "bg-slate-500", text: "text-slate-400" },
	beendet: { label: "Beendet", dot: "bg-slate-500", text: "text-slate-400" },
};

export const VALID_FILTERS: StatusFilter[] = [
	"alle",
	"laufend",
	"gestartet",
	"beendet",
];
export const FILTER_STORAGE_KEY = "poker_session_filter";

export const STATUS_TABS: { key: StatusFilter; label: string }[] = [
	{ key: "alle", label: "Alle" },
	{ key: "laufend", label: "Wartet" },
	{ key: "gestartet", label: "Aktiv" },
	{ key: "beendet", label: "Beendet" },
];
