import { Outlet } from "react-router";
import AppHeader from "./AppHeader";

export default function AppShell() {
  return (
    <div className="app-shell">
      <div className="ambient-snow" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <i
            key={index}
            style={{
              left: `${(index * 41 + 6) % 100}%`,
              animationDelay: `${-((index * 13) % 24)}s`,
              animationDuration: `${16 + (index * 5) % 18}s`,
              opacity: 0.24 + (index % 4) * 0.12,
              width: `${2 + index % 3}px`,
              height: `${2 + index % 3}px`,
            }}
          />
        ))}
      </div>
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer"><span aria-hidden="true">❄</span> Багахан гэрэл, их хайртай шинэ жил. <span aria-hidden="true">❄</span></footer>
    </div>
  );
}
