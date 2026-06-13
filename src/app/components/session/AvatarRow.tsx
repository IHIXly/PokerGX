import type { SessionUser } from "@/app/types/poker-session";

export interface AvatarRowProps {
	users: SessionUser[];
	max?: number;
}

export function AvatarRow({ users, max = 5 }: AvatarRowProps) {
	const visible = users.slice(0, max);
	const rest = users.length - max;

	return (
		<div className="flex items-center">
			{visible.map((u, i) => (
				<div
					key={u.id}
					title={u.user.name ?? "?"}
					style={{
						zIndex: visible.length - i,
						marginLeft: i === 0 ? 0 : "-6px",
					}}
					className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-900 bg-slate-700 font-bold text-[10px] text-slate-300 ring-1 ring-slate-800"
				>
					{(u.user.name ?? "?").charAt(0).toUpperCase()}
				</div>
			))}
			{rest > 0 && (
				<div
					style={{ marginLeft: "-6px", zIndex: 0 }}
					className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-900 bg-slate-600 font-bold text-[9px] text-slate-400 ring-1 ring-slate-800"
				>
					+{rest}
				</div>
			)}
		</div>
	);
}
