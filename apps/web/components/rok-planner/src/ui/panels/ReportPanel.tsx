'use client';

import type { PlanReport } from '../../core/report';
import type { World } from '../../core/world';
import { ResIcon, Section, cap, plural } from '../components';

const CODES = [1, 2, 3, 4];

export function ReportPanel(props: { world: World; report: PlanReport }) {
  const { world, report } = props;
  const codes = CODES.filter((c) => world.resources[c]);
  const empty = report.total.cf === 0 && report.total.flags === 0;
  return (
    <Section title="Report" hint="What the buildings of the plan contain. Resource points are the ones that feed an alliance's storage; only land that counts is included.">
      {empty && <p className="rokp-hint">Place a CF and some flags and the numbers appear here.</p>}
      {!empty && (
        <>
          <div className="rokp-total">
            <div>
              <b>{report.total.cf}</b> CF · <b>{report.total.flags}</b> flags{report.total.inactive > 0 && <span className="rokp-bad"> ({report.total.inactive} not connected)</span>}
            </div>
            <div>
              <b>{report.total.newTiles.toLocaleString()}</b> new tiles
            </div>
          </div>
          <div className="rokp-nodes">
            {codes.map((c) => (
              <span key={c} className="rokp-nodechip" title={cap(world.resources[c])}>
                <ResIcon name={world.resources[c]} code={c} size={22} />
                <b>{report.total.nodes[c] ?? 0}</b>
              </span>
            ))}
            <span className="rokp-nodetotal">{plural(report.total.nodesTotal, 'point')} in total</span>
          </div>
          {report.total.captured > 0 && <p className="rokp-hint">Holy sites and passes reached: {report.total.captured}.</p>}
          {report.alliances.length > 1 && (
            <table className="rokp-table">
              <thead>
                <tr>
                  <th>Alliance</th>
                  <th title="Fortresses">CF</th>
                  <th title="Flags">Fl</th>
                  <th title="New tiles">Tiles</th>
                  {codes.map((c) => (
                    <th key={c} title={cap(world.resources[c])}>
                      <ResIcon name={world.resources[c]} code={c} size={16} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.alliances.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="rokp-sw" style={{ background: a.color }} /> {a.name}
                    </td>
                    <td>{a.cf}</td>
                    <td>{a.flags}</td>
                    <td>{a.newTiles}</td>
                    {codes.map((c) => (
                      <td key={c}>{a.nodes[c] ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {report.alliances.map((a) =>
            a.captured.length || a.nodesInBase ? (
              <p key={a.id} className="rokp-sub">
                <span className="rokp-sw" style={{ background: a.color }} /> {a.name}
                {a.captured.length > 0 && ` reaches ${a.captured.map((o) => o.name).join(', ')}.`}
                {a.nodesInBase > 0 && ` Its starting land already holds ${plural(a.nodesInBase, 'point')}.`}
              </p>
            ) : null,
          )}
        </>
      )}
    </Section>
  );
}
