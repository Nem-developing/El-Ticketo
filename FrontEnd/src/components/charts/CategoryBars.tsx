import { Link } from "react-router";

import type { Stats } from "../../api/types";

const MAX_ROWS = 6;

/** Répartition par catégorie ; chaque barre ouvre la liste des tickets de sa catégorie. */
export function CategoryBars({ categories }: { categories: Stats["by_category"] }) {
  const rows =
    categories.length > MAX_ROWS
      ? [
          ...categories.slice(0, MAX_ROWS - 1),
          {
            category: "Autres catégories",
            count: categories.slice(MAX_ROWS - 1).reduce((sum, row) => sum + row.count, 0),
            grouped: true,
          },
        ]
      : categories;
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="bars-container">
      <ul className="bars">
        {rows.map((row, index) => {
          const bar = (
            <>
              <span className="bars__label" title={row.category}>
                {row.category}
              </span>
              <span className="bars__track">
                <span className="bars__fill" style={{ width: `${(row.count / max) * 100}%` }} />
                <span className="bars__value">{row.count}</span>
              </span>
            </>
          );
          return (
            <li key={index}>
              {"grouped" in row ? (
                <div className="bars__row">{bar}</div>
              ) : (
                <Link
                  to={`/tickets?${new URLSearchParams({ view: "all", category: row.category })}`}
                  className="bars__row"
                >
                  {bar}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
