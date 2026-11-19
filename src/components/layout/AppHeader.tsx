import { Link, NavLink, useMatch } from "react-router";
import { GAMES_PATH, HOME_PATH, TREE_GAME_ID, gamePath } from "../../app/routeMap";
import UiIcon from "../ui/UiIcon";

const workshopPath = gamePath(TREE_GAME_ID);

export default function AppHeader() {
  const isWorkshop = useMatch({ path: workshopPath, end: true }) !== null;

  return (
    <header className="app-header">
      <nav className="app-header__nav" aria-label="Үндсэн цэс">
        <Link to={HOME_PATH} className="brand ui-btn" aria-label="Happy New Year нүүр хуудас">
          <span className="brand-mark"><UiIcon name="sparkle" size={20} /></span>
          <span className="brand-label">HAPPY <b>NEW YEAR</b></span>
        </Link>
        <div className="primary-navigation">
          <NavLink to={HOME_PATH} end className="navigation-link ui-btn">
            Тоолол
          </NavLink>
          <NavLink to={GAMES_PATH} end={isWorkshop} className="navigation-link ui-btn">
            Тоглоомууд
          </NavLink>
        </div>
        <Link
          to={workshopPath}
          className="navigation-link workshop-link ui-btn"
          aria-label="Баярын урлан"
          aria-current={isWorkshop ? "page" : undefined}
        >
          <UiIcon name="tree" />
          <span className="workshop-link__label">Баярын урлан</span>
        </Link>
      </nav>
    </header>
  );
}
