// 최종본 문서 화면(A4 인쇄용). HWPX 최종본과 같은 구성.
import {
  COMMON_HEADER,
  DEPT_HEADER,
  PERSONAL_HEADER,
  SECTION_TITLES,
  W_COMMON,
  W_DEPT,
  W_PERSONAL,
  type DocGroup,
  type DocModel,
} from "@/lib/docmodel";
import type { Change } from "@/lib/types";
import { spaceTilde as t } from "@/lib/dates";
import { BASE_HEIGHT, fitHeight, MIN_HEIGHT } from "@/lib/textfit";

/** 비고: 칸보다 길면 HWPX와 같은 비율로 글자를 줄인다 */
function NoteCell({ text, width }: { text: string; width: number }) {
  const v = t(text);
  const h = fitHeight(v, width);
  return <td style={h < BASE_HEIGHT ? { fontSize: `${((11.5 * h) / BASE_HEIGHT).toFixed(1)}px`, whiteSpace: h > MIN_HEIGHT ? "nowrap" : undefined } : undefined}>{v}</td>;
}

function Cols({ widths }: { widths: number[] }) {
  const sum = widths.reduce((a, b) => a + b, 0);
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${((w / sum) * 100).toFixed(2)}%` }} />
      ))}
    </colgroup>
  );
}

function Changes({ list }: { list: Change[] }) {
  if (!list.length) return null;
  return (
    <div className="doc-changes">
      ※ 변경사항
      {list.map((c, i) => (
        <div key={i}>{c.text}</div>
      ))}
    </div>
  );
}

function GroupTable({ groups, personal }: { groups: DocGroup[]; personal?: boolean }) {
  const header = personal ? PERSONAL_HEADER : DEPT_HEADER;
  return (
    <table className="doc">
      <Cols widths={personal ? W_PERSONAL : W_DEPT} />
      <thead>
        <tr>
          {header.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {!groups.length && (
          <tr>
            <td colSpan={header.length}>해당 없음</td>
          </tr>
        )}
        {groups.flatMap((g) =>
          g.rows.map((r, i) => (
            <tr key={r.item.id} className={r.changed ? "changed" : ""}>
              {i === 0 && (
                <td className="dept" rowSpan={g.rows.length}>
                  {g.deptName}
                </td>
              )}
              {personal && <td>{t(r.item.person)}</td>}
              <td>{t(r.item.date_text)}</td>
              <td className="content">
                {r.changed && "※ "}
                {t(r.item.content)}
              </td>
              <td>{t(r.item.place)}</td>
              {!personal && <td>{t(r.item.headcount)}</td>}
              <NoteCell text={r.item.note} width={(personal ? W_PERSONAL : W_DEPT).at(-1)!} />
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

export default function DocView({ model }: { model: DocModel }) {
  return (
    <div className="paper">
      <h1 className="doc-title">{model.title}</h1>
      <div className="doc-info">
        <div>대상 기간: {model.period}</div>
        <div>
          작성부서: {model.orgName} &nbsp;&nbsp; 작성일: {model.createdDate}
        </div>
      </div>

      <h2 className="doc-sec">{SECTION_TITLES.common}</h2>
      <table className="doc">
        <Cols widths={W_COMMON} />
        <thead>
          <tr>
            {COMMON_HEADER.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!model.common.length && (
            <tr>
              <td colSpan={COMMON_HEADER.length}>해당 없음</td>
            </tr>
          )}
          {model.common.map((r) => (
            <tr key={r.item.id} className={r.changed ? "changed" : ""}>
              <td>{t(r.item.date_text)}</td>
              <td className="content">
                {r.changed && "※ "}
                {t(r.item.content)}
              </td>
              <td>{t(r.item.place)}</td>
              <td>{t(r.item.headcount)}</td>
              <NoteCell text={r.item.note} width={W_COMMON.at(-1)!} />
            </tr>
          ))}
        </tbody>
      </table>
      <Changes list={model.changes.common} />

      <h2 className="doc-sec">{SECTION_TITLES.department}</h2>
      <GroupTable groups={model.department} />
      <Changes list={model.changes.department} />

      <h2 className="doc-sec">{SECTION_TITLES.personal}</h2>
      <GroupTable groups={model.personal} personal />
      <Changes list={model.changes.personal} />
    </div>
  );
}
