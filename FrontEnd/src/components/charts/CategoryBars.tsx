import type { Stats } from "../../api/types";

const MAX_ROWS = 6;

/** Répartition des tickets par catégorie : barres horizontales, valeur en bout de barre. */
export function CategoryBars({ categories }: { categories: Stats["by_category"] }) {
  const rows =
    categories.length > MAX_ROWS
      ? [
          ...categories.slice(0, MAX_ROWS - 1),
          {
            category: "Autres catégories",
            count: categories.slice(MAX_ROWS - 1).reduce((sum, row) => sum + row.count, 0),
          },
        ]
      : categories;
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="bars-container">
      <ul className="bars">
        {rows.map((row, index) => (
          <li key={index} className="bars__row">
            <span className="bars__label" title={row.category}>
              {row.category}
            </span>
            <span className="bars__track">
              <span className="bars__fill" style={{ width: `${(row.count / max) * 100}%` }} />
              <span className="bars__value">{row.count}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
