export interface ChipIconProps {
	className?: string;
}

export function ChipIcon({ className = "h-4 w-4" }: ChipIconProps) {
	return (
		<svg
			viewBox="0 0 20 20"
			className={`inline-block shrink-0 ${className}`}
			aria-hidden="true"
		>
			<circle
				cx="10"
				cy="10"
				r="9"
				fill="#7f1d1d"
				stroke="#ef4444"
				strokeWidth="1.5"
			/>
			<circle
				cx="10"
				cy="10"
				r="5.5"
				fill="#450a0a"
				stroke="#ef4444"
				strokeWidth="1"
			/>
			<path
				d="M10 1v3M10 16v3M1 10h3M16 10h3M3.22 3.22l2.12 2.12M14.66 14.66l2.12 2.12M3.22 16.78l2.12-2.12M14.66 5.34l2.12-2.12"
				stroke="#fca5a5"
				strokeWidth="1.2"
				strokeLinecap="round"
			/>
		</svg>
	);
}
