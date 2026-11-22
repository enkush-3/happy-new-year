import type { ComponentPropsWithRef } from "react";

export type HudBadgeProps = ComponentPropsWithRef<"span">;

export function HudBadge({ className, ...props }: HudBadgeProps) {
  return <span className={className ? `game-hud-badge ${className}` : "game-hud-badge"} {...props} />;
}
