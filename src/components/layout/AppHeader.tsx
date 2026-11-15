import { NavLink } from "react-router";
import { GAMES_PATH, HOME_PATH } from "../../app/routeMap";

export default function AppHeader() {
  return (
    <header className="app-header">
      <NavLink to={HOME_PATH} className="brand" aria-label="Happy New Year нүүр хуудас">
        <span className="brand-mark" aria-hidden="true">✦</span>
        <span className="brand-label--wide">HAPPY <b>NEW YEAR</b></span>
        <span className="brand-label--compact" aria-hidden="true">HNY</span>
      </NavLink>
      <nav className="primary-navigation" aria-label="Үндсэн цэс">
        <NavLink to={HOME_PATH} end className={({ isActive }) => `navigation-link${isActive ? " is-active" : ""}`}>
          Тоолол
        </NavLink>
        <NavLink to={GAMES_PATH} className={({ isActive }) => `navigation-link${isActive ? " is-active" : ""}`}>
          Тоглоомууд
        </NavLink>
      </nav>
      <span className="header-note"><span className="header-note__dot" /> Баярын урлан</span>
    </header>
  );
}
