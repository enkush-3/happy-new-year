const shapes = {
  gift: (
    <>
      <path d="M12 7H7.5a2.5 2.5 0 1 1 2.3-3.5L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2.3-3.5L12 7Z" />
      <rect x="3" y="7" width="18" height="5" rx="1" />
      <path d="M5 12v8h14v-8M12 7v13" />
    </>
  ),
  snowflake: <path d="M12 2v20m-3-17 3 3 3-3M9 19l3-3 3 3M3.34 7l17.32 10M3 11l4.1-1.1L6 5.8m15 7.2-4.1 1.1 1.1 4.1M3.34 17 20.66 7M6 18.2l1.1-4.1L3 13m15-7.2-1.1 4.1L21 11" />,
  timer: (
    <>
      <circle cx="12" cy="14" r="7" />
      <path d="M9.5 2h5M12 2v5m6 2 2-2m-8 7 2.5-2.5" />
    </>
  ),
  sleigh: <path d="M2 9a2 2 0 0 1 4 0v3h11a4 4 0 0 0 4-4M6 12l2 4h9l3-5M9 16l-1 4m8-4 1 4M3 20h16a3 3 0 0 0 3-3" />,
  tree: <path d="m12 2 4 5h-2l5 5h-3l5 6H3l5-6H5l5-5H8l4-5ZM12 18v4" />,
  trophy: <path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-4 3h8m-7-3h6v3" />,
  sparkle: <path d="M12 2c0 5.5 4.5 10 10 10-5.5 0-10 4.5-10 10 0-5.5-4.5-10-10-10 5.5 0 10-4.5 10-10Z" />,
  "arrow-right": <path d="M4 12h15m-6-6 6 6-6 6" />,
};

export type UiIconName = keyof typeof shapes;

export default function UiIcon({ name, size = 24 }: { name: UiIconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[name]}
    </svg>
  );
}
