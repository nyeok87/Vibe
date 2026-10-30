// 칸 너비에 맞춘 글자 크기 계산(비고 칸 등). HWPX 생성과 웹 문서 화면이 같은 계산을 쓴다.
// 폭은 글자 크기 대비 비율로 어림한다: 한글·한자·전각 1.0, 그 밖(숫자·영문·기호·공백) 0.55.

export const BASE_HEIGHT = 900; // 표 글자 9pt (HWPUNIT)
export const MIN_HEIGHT = 600; // 6pt 밑으로는 줄이지 않고 줄바꿈
const CELL_PADDING = 340 * 2 + 120; // 셀 좌우 여백 + 여유

function units(line: string): number {
  let u = 0;
  for (const ch of line) {
    const cp = ch.codePointAt(0) ?? 0;
    const wide = (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xff00 && cp <= 0xff60);
    u += wide ? 1 : 0.55;
  }
  return u;
}

/** 글자가 칸(너비 HWPUNIT) 한 줄에 들어가도록 줄인 글자 크기(HWPUNIT). 들어가면 기본 크기 그대로 */
export function fitHeight(text: string, cellWidth: number, base = BASE_HEIGHT): number {
  const u = Math.max(0, ...text.split("\n").map(units));
  const avail = cellWidth - CELL_PADDING;
  if (!u || u * base <= avail) return base;
  return Math.max(MIN_HEIGHT, Math.floor(avail / u / 50) * 50);
}
