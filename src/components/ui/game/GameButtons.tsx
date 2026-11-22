import type { ComponentPropsWithRef } from "react";

export type GameButtonProps = ComponentPropsWithRef<"button">;

type ButtonVariant = "primary" | "secondary" | "destructive";

function GameButton({ variant, className, type = "button", ...props }: GameButtonProps & { variant: ButtonVariant }) {
  const base = `game-button game-button--${variant}`;
  return <button type={type} className={className ? `${base} ${className}` : base} {...props} />;
}

export function PrimaryButton(props: GameButtonProps) {
  return <GameButton {...props} variant="primary" />;
}

export function SecondaryButton(props: GameButtonProps) {
  return <GameButton {...props} variant="secondary" />;
}

export function DestructiveButton(props: GameButtonProps) {
  return <GameButton {...props} variant="destructive" />;
}
