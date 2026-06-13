export type StatusFilter = "alle" | "laufend" | "gestartet" | "beendet";

export interface SessionUser {
	id: string;
	chips: number;
	user: {
		id: string;
		name?: string | null;
		developer?: boolean;
	};
}

export interface PokerSession {
	id: string;
	name: string;
	status: string;
	private: boolean;
	createdBy: string;
	sessionCode?: number | null;
	createdAt: Date;
	updatedAt: Date;
	users: SessionUser[];
}

export interface StatusStyle {
	label: string;
	dot: string;
	text: string;
}
