import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import type { Stats } from "../../api/types";
import { formatShortDay } from "../../lib/format";

const SERIES = [
  { key: "created", label: "Créés", color: "var(--series-1)" },
  { key: "closed", label: "Fermés", color: "var(--series-2)" },
] as const;

const AXIS_TICK = { fill: "var(--text-muted)", fontSize: 12 };

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{formatShortDay(String(label))}</p>
      {SERIES.map((series) => (
        <p key={series.key} className="chart-tooltip__row">
          <span className="line-key" style={{ background: series.color }} aria-hidden="true" />
          <strong>{payload.find((item) => item.dataKey === series.key)?.value ?? 0}</strong>
          <span>{series.label.toLowerCase()}</span>
        </p>
      ))}
    </div>
  );
}

/** Tickets créés et fermés par jour. */
export function ActivityChart({ timeline }: { timeline: Stats["timeline"] }) {
  return (
    <figure className="chart">
      <div className="chart__legend">
        {SERIES.map((series) => (
          <span key={series.key} className="chart__legend-item">
            <span className="line-key" style={{ background: series.color }} aria-hidden="true" />
            {series.label}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={timeline} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDay}
            tick={AXIS_TICK}
            stroke="var(--chart-axis)"
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            content={ChartTooltip}
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <details className="chart__data">
        <summary>Voir les données</summary>
        <table className="table table--compact">
          <thead>
            <tr>
              <th scope="col">Jour</th>
              {SERIES.map((series) => (
                <th key={series.key} scope="col">
                  {series.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.map((point) => (
              <tr key={point.date}>
                <td>{formatShortDay(point.date)}</td>
                <td>{point.created}</td>
                <td>{point.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
