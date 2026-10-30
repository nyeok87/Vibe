// HWPX(OWPML) 문서 생성기.
// 패키지 구성·header/section XML 규약은 hwp-convert(MIT, shyang1012)의 "한글에서 열리는 HWPX" 출력 형식을 참고했다.
import JSZip from "jszip";
import { spaceTilde } from "../dates";
import { BASE_HEIGHT, fitHeight } from "../textfit";

export type TextStyle = "title" | "heading" | "body" | "info" | "note";

export interface Para {
  type: "para";
  text: string;
  style?: TextStyle;
  align?: "left" | "center" | "right";
}

export interface Cell {
  text: string;
  rowSpan?: number;
  colSpan?: number;
  bold?: boolean;
  fill?: boolean; // 회색 배경
  fit?: boolean; // 칸보다 글자가 길면 한 줄에 맞게 글자 크기를 줄인다
}

export interface Table {
  type: "table";
  widths: number[]; // HWPUNIT, 합계 = 본문 폭(42520)
  header: string[] | null; // 머리글 행(페이지가 넘어가면 반복)
  rows: Cell[][]; // 병합으로 가려지는 칸은 빼고 넣는다
}

export type Block = Para | Table;

export const BODY_WIDTH = 42520; // A4 세로, 좌우 여백 30mm

const NS =
  `xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" ` +
  `xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" ` +
  `xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" ` +
  `xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" ` +
  `xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" ` +
  `xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" ` +
  `xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" ` +
  `xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" ` +
  `xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" ` +
  `xmlns:dc="http://purl.org/dc/elements/1.1/" ` +
  `xmlns:opf="http://www.idpf.org/2007/opf/" ` +
  `xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" ` +
  `xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" ` +
  `xmlns:epub="http://www.idpf.org/2007/ops" ` +
  `xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"`;

function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- header.xml: 글꼴·글자모양·문단모양·테두리 ----
// 글꼴 id 0 = 함초롬바탕, 1 = 함초롬돋움
// 글자모양: 0 바탕10 / 1 돋움9(표) / 2 돋움9 굵게(표 머리글) / 3 돋움18 굵게(제목) / 4 돋움12 굵게(구역 제목) / 5 바탕10(머리 정보) / 6 돋움8.5(안내·변경사항)
// 문단모양(본문 줄간격 180%, 표 안 130%): 0 양쪽 / 1 가운데 / 2 왼쪽 / 3 오른쪽 / 4 표 안 가운데
const CHAR_STYLES: { height: number; font: 0 | 1; bold?: boolean; color?: string }[] = [
  { height: 1000, font: 0 },
  { height: 900, font: 1 },
  { height: 900, font: 1, bold: true },
  { height: 1800, font: 1, bold: true },
  { height: 1200, font: 1, bold: true },
  { height: 1000, font: 0 },
  { height: 850, font: 1, color: "#333333" },
];

// 칸에 맞춰 줄인 글자 크기는 문서마다 글자모양을 추가로 만든다(id 7부터)
let extraChars: (typeof CHAR_STYLES)[number][] = [];

function charIdFor(height: number, bold: boolean): number {
  if (height === BASE_HEIGHT) return bold ? 2 : 1;
  let i = extraChars.findIndex((c) => c.height === height && !!c.bold === bold);
  if (i < 0) i = extraChars.push({ height, font: 1, bold }) - 1;
  return CHAR_STYLES.length + i;
}

const LANGS = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];

function headerXml(): string {
  const fontfaces = LANGS.map(
    (lang) =>
      `<hh:fontface lang="${lang}" fontCnt="2">` +
      `<hh:font id="0" face="함초롬바탕" type="TTF" isEmbedded="0"/>` +
      `<hh:font id="1" face="함초롬돋움" type="TTF" isEmbedded="0"/>` +
      `</hh:fontface>`,
  ).join("");

  const border = (type: string) =>
    ["leftBorder", "rightBorder", "topBorder", "bottomBorder"]
      .map((t) => `<hh:${t} type="${type}" width="0.12 mm" color="#000000"/>`)
      .join("");
  const borderFill = (id: number, type: string, fill?: string) =>
    `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">` +
    `<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>` +
    border(type) +
    `<hh:diagonal type="NONE" width="0.1 mm" color="#000000"/>` +
    (fill
      ? `<hc:fillBrush><hc:winBrush faceColor="${fill}" hatchColor="#000000" alpha="0"/></hc:fillBrush>`
      : "") +
    `</hh:borderFill>`;

  const fontRef = (f: number) =>
    `<hh:fontRef hangul="${f}" latin="${f}" hanja="${f}" japanese="${f}" other="${f}" symbol="${f}" user="${f}"/>`;
  const all = (tag: string, v: number) =>
    `<hh:${tag} hangul="${v}" latin="${v}" hanja="${v}" japanese="${v}" other="${v}" symbol="${v}" user="${v}"/>`;
  const chars = [...CHAR_STYLES, ...extraChars];
  const charPrs = chars.map(
    (c, id) =>
      `<hh:charPr id="${id}" height="${c.height}" textColor="${c.color ?? "#000000"}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="1">` +
      fontRef(c.font) +
      all("ratio", 100) +
      all("spacing", 0) +
      all("relSz", 100) +
      all("offset", 0) +
      (c.bold ? `<hh:bold/>` : "") +
      `<hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/>` +
      `<hh:outline type="NONE"/><hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>` +
      `</hh:charPr>`,
  ).join("");

  const paraPr = (id: number, align: string, line: number) =>
    `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="0" suppressLineNumbers="0" checked="0">` +
    `<hh:align horizontal="${align}" vertical="BASELINE"/>` +
    `<hh:heading type="NONE" idRef="0" level="0"/>` +
    `<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>` +
    `<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>` +
    `<hh:margin><hh:intent value="0"/><hh:left value="0"/><hh:right value="0"/><hh:prev value="0"/><hh:next value="0"/></hh:margin>` +
    `<hh:lineSpacing type="PERCENT" value="${line}" unit="HWPUNIT"/>` +
    `</hh:paraPr>`;

  const numbering =
    `<hh:numberings itemCnt="1"><hh:numbering id="0" start="1">` +
    Array.from(
      { length: 7 },
      (_, i) =>
        `<hh:paraHead level="${i + 1}" start="1" numFormat="^${i + 1}." textOffsetType="PERCENT" textOffset="50" numberingChar="false" charPrIDRef="0">` +
        `<hh:autoNumberFormat type="DIGIT" userChar="" prefixChar="" suffixChar="."/></hh:paraHead>`,
    ).join("") +
    `</hh:numbering></hh:numberings>`;

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<hh:head ${NS} version="1.5" secCnt="1">` +
    `<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>` +
    `<hh:refList>` +
    `<hh:fontfaces itemCnt="7">${fontfaces}</hh:fontfaces>` +
    `<hh:borderFills itemCnt="3">${borderFill(1, "NONE")}${borderFill(2, "SOLID")}${borderFill(3, "SOLID", "#E6E6E6")}</hh:borderFills>` +
    `<hh:charProperties itemCnt="${chars.length}">${charPrs}</hh:charProperties>` +
    `<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="1" autoTabRight="1"><hh:items itemCnt="0"/></hh:tabPr></hh:tabProperties>` +
    numbering +
    `<hh:bullets itemCnt="1"><hh:bullet id="0" char="●" imageBullet="0" checkedChar="0"><hh:img bright="0" contrast="0" effect="REAL_PIC" binaryItemIDRef="0"/></hh:bullet></hh:bullets>` +
    `<hh:paraProperties itemCnt="5">${paraPr(0, "JUSTIFY", 180)}${paraPr(1, "CENTER", 180)}${paraPr(2, "LEFT", 180)}${paraPr(3, "RIGHT", 180)}${paraPr(4, "CENTER", 130)}</hh:paraProperties>` +
    `<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>` +
    `</hh:refList>` +
    `<hh:memoProperties itemCnt="1"><hh:memoPr id="1" width="15590" lineWidth="1" lineType="SOLID" lineColor="#000000" fillColor="#CCFF99" activeColor="#FFFF99" memoType="NOMAL"/></hh:memoProperties>` +
    `<hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>` +
    `<hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption>` +
    `</hh:head>`
  );
}

// ---- section0.xml ----
let idSeq = 0;
const nextId = () => ++idSeq;

function secPrXml(): string {
  return (
    `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="1" textVerticalWidthHead="0" masterPageCnt="0">` +
    `<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>` +
    `<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>` +
    `<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>` +
    `<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>` +
    `<hp:pagePr landscape="WIDELY" width="59528" height="84186" gutterType="LEFT_ONLY">` +
    `<hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/>` +
    `</hp:pagePr>` +
    `<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>` +
    `<hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/>` +
    `<hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/>` +
    `<hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>` +
    `<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>` +
    `<hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/>` +
    `<hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/>` +
    `<hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>` +
    ["BOTH", "EVEN", "ODD"]
      .map(
        (t) =>
          `<hp:pageBorderFill type="${t}" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>`,
      )
      .join("") +
    `</hp:secPr>` +
    `<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`
  );
}

const STYLE_CHAR: Record<TextStyle, number> = { title: 3, heading: 4, body: 0, info: 5, note: 6 };
const ALIGN_PARA = { left: 2, center: 1, right: 3 } as const;

function paraXml(text: string, charPr: number, paraPr: number): string {
  // 여러 줄은 문단으로 나눈다. 줄 배치(lineseg)는 한글이 열 때 다시 계산한다.
  return text
    .split("\n")
    .map(
      (line) =>
        `<hp:p id="${nextId()}" paraPrIDRef="${paraPr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        (line ? `<hp:run charPrIDRef="${charPr}"><hp:t>${esc(line)}</hp:t></hp:run>` : `<hp:run charPrIDRef="${charPr}"/>`) +
        `</hp:p>`,
    )
    .join("");
}

const ROW_H = 1600;

function tableXml(t: Table): string {
  const colCnt = t.widths.length;
  const allRows: Cell[][] = [];
  if (t.header) allRows.push(t.header.map((h) => ({ text: h, bold: true, align: "center", fill: true })));
  allRows.push(...t.rows);
  const rowCnt = allRows.length;

  // 병합으로 가려진 칸을 건너뛰며 열 주소를 매긴다
  const occupied: boolean[][] = Array.from({ length: rowCnt }, () => Array(colCnt).fill(false));
  const trs = allRows.map((row, r) => {
    let c = 0;
    const tcs = row.map((cell) => {
      while (c < colCnt && occupied[r][c]) c++;
      const cs = Math.max(1, Math.min(cell.colSpan ?? 1, colCnt - c));
      const rs = Math.max(1, Math.min(cell.rowSpan ?? 1, rowCnt - r));
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) occupied[r + i][c + j] = true;
      const width = t.widths.slice(c, c + cs).reduce((a, b) => a + b, 0);
      const isHeader = !!t.header && r === 0;
      const text = spaceTilde(cell.text);
      const xml =
        `<hp:tc name="" header="${isHeader ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${cell.fill ? 3 : 2}">` +
        `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
        paraXml(text, charIdFor(cell.fit ? fitHeight(text, width) : BASE_HEIGHT, !!cell.bold), 4) +
        `</hp:subList>` +
        `<hp:cellAddr colAddr="${c}" rowAddr="${r}"/>` +
        `<hp:cellSpan colSpan="${cs}" rowSpan="${rs}"/>` +
        `<hp:cellSz width="${width}" height="${ROW_H * rs}"/>` +
        `<hp:cellMargin left="340" right="340" top="141" bottom="141"/>` +
        `</hp:tc>`;
      c += cs;
      return xml;
    });
    return `<hp:tr>${tcs.join("")}</hp:tr>`;
  });

  const width = t.widths.reduce((a, b) => a + b, 0);
  const tbl =
    `<hp:tbl id="${nextId()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" ` +
    `lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="${t.header ? 1 : 0}" rowCnt="${rowCnt}" colCnt="${colCnt}" ` +
    `cellSpacing="0" borderFillIDRef="2" noAdjust="0">` +
    `<hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${ROW_H * rowCnt}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" ` +
    `vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:inMargin left="340" right="340" top="141" bottom="141"/>` +
    trs.join("") +
    `</hp:tbl>`;
  return `<hp:p id="${nextId()}" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${tbl}</hp:run><hp:run charPrIDRef="0"/></hp:p>`;
}

function sectionXml(blocks: Block[]): string {
  idSeq = 0;
  extraChars = [];
  const first =
    `<hp:p id="${nextId()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="0">${secPrXml()}` +
    // 쪽 번호: 하단 가운데
    `<hp:ctrl><hp:pageNum pos="BOTTOM_CENTER" formatType="DIGIT" sideChar="-"/></hp:ctrl>` +
    `</hp:run>` +
    `<hp:run charPrIDRef="0"><hp:t/></hp:run>` +
    `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="800" horzpos="0" horzsize="${BODY_WIDTH}" flags="393216"/></hp:linesegarray>` +
    `</hp:p>`;
  const body = blocks
    .map((b) => {
      if (b.type === "table") return tableXml(b);
      const style = b.style ?? "body";
      const align = b.align ?? (style === "title" ? "center" : "left");
      return paraXml(b.text, STYLE_CHAR[style], ALIGN_PARA[align]);
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<hs:sec ${NS}>${first}${body}</hs:sec>`;
}

function previewText(blocks: Block[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.type === "para") lines.push(b.text);
    else {
      if (b.header) lines.push(b.header.map((h) => `<${h}>`).join(""));
      for (const r of b.rows) lines.push(r.map((c) => `<${c.text}>`).join(""));
    }
  }
  return lines.join("\r\n").slice(0, 2000);
}

export async function buildHwpx(blocks: Block[], meta: { title: string; creator?: string }): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  zip.file(
    "version.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="0" micro="5" buildNumber="0" os="1" application="weekly-schedule"/>`,
  );
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/></rootfiles></container>`,
  );
  zip.file(
    "META-INF/manifest.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`,
  );
  const PKG = "http://www.hancom.co.kr/hwpml/2016/meta/pkg#";
  zip.file(
    "META-INF/container.rdf",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
      `<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="${PKG}" rdf:resource="Contents/header.xml"/></rdf:Description>` +
      `<rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="${PKG}HeaderFile"/></rdf:Description>` +
      `<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="${PKG}" rdf:resource="Contents/section0.xml"/></rdf:Description>` +
      `<rdf:Description rdf:about="Contents/section0.xml"><rdf:type rdf:resource="${PKG}SectionFile"/></rdf:Description>` +
      `<rdf:Description rdf:about=""><rdf:type rdf:resource="${PKG}Document"/></rdf:Description></rdf:RDF>`,
  );
  zip.file(
    "settings.xml",
    `<?xml version="1.0" encoding="UTF-8"?>\n<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"><ha:CaretPosition ha:listIDRef="0" ha:paraIDRef="0" ha:pos="0"/></ha:HWPApplicationSetting>`,
  );
  zip.file(
    "Contents/content.hpf",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<opf:package ${NS} version="" unique-identifier="" id="">` +
      `<opf:metadata><dc:title>${esc(meta.title)}</dc:title><dc:creator>${esc(meta.creator ?? "")}</dc:creator><dc:format>application/hwpml-package+xml</dc:format></opf:metadata>` +
      `<opf:manifest>` +
      `<opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>` +
      `<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>` +
      `<opf:item id="settings" href="settings.xml" media-type="application/xml"/>` +
      `</opf:manifest>` +
      `<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine>` +
      `</opf:package>`,
  );
  const section = sectionXml(blocks); // 글자모양(줄인 크기)을 먼저 모은 뒤 header를 만든다
  zip.file("Contents/header.xml", headerXml());
  zip.file("Contents/section0.xml", section);
  zip.file("Preview/PrvText.txt", previewText(blocks));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
