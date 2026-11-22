import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

export interface GameShellProps extends ComponentPropsWithRef<"section"> {
  kicker: string;
  title: string;
  description?: string;
  hud?: ReactNode;
  children: ReactNode;
}

export function GameShell({ kicker, title, description, hud, children, className, ...sectionProps }: GameShellProps) {
  const titleId = useId();

  return (
    <section {...sectionProps} className={className ? `game-shell ${className}` : "game-shell"} aria-labelledby={titleId}>
      <header className="game-shell__header">
        <div className="game-shell__heading">
          <p className="game-shell__kicker">{kicker}</p>
          <h1 className="game-shell__title" id={titleId}>{title}</h1>
          {description && <p className="game-shell__description">{description}</p>}
        </div>
        {hud != null && <div className="game-shell__hud">{hud}</div>}
      </header>
      <div className="game-shell__surface">{children}</div>
    </section>
  );
}
