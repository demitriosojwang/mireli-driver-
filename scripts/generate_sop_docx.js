// ─── Msafiri Driver Onboarding SOP — docx generator ─────────────────────────
// Cover: R1 (Pure Paragraph Left) + DS-1 Deep Sea. Profile A fonts, English.
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  PageBreak, TableLayoutType, LevelFormat,
} = require("docx");
const fs = require("fs");
const C = require("./sop_content.js");

// ── Palette DS-1 (Deep Sea) ──────────────────────────────────────────────────
const P = {
  bg: "0B1C2C", accent: "529286",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "529286", headerText: "FFFFFF", accentLine: "529286", innerLine: "BECFCC", surface: "E8ECEB" },
  headingColor: "0B1C2C",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Cover helpers (design-system.md, Latin-width variant) ───────────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."-_/·&", " ", "\t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}

// Latin chars ≈ pt × 11 twips wide (≈55% of CJK width)
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 11;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 4) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ── Recipe R1: Pure Paragraph Cover (Left-Aligned) ──────────────────────────
function buildCoverR1(config) {
  const PC = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length,
    fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: PC.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PC.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "),
        size: 18, color: PC.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true,
        color: PC.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: PC.cover.subtitleColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: PC.cover.metaColor,
        font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: PC.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: PC.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: PC.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: PC.bg }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── Body builders (Profile A, English) ──────────────────────────────────────
const FONT_BODY = { ascii: "Times New Roman", eastAsia: "SimSun" };
const FONT_HEAD = { ascii: "Times New Roman", eastAsia: "SimHei" };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.headingColor, font: FONT_HEAD })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: P.headingColor, font: FONT_HEAD })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    keepNext: opts.keepNext || false,
    children: [new TextRun({ text, size: 24, color: "000000", font: FONT_BODY })],
  });
}
function tableTitle(text) {
  return new Paragraph({
    keepNext: true, alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.headingColor, font: FONT_HEAD })],
  });
}
function cellPara(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 276 },
    children: [new TextRun({ text: String(text), size: opts.size || 20, bold: !!opts.bold, color: opts.color || "000000", font: FONT_BODY })],
  });
}
function dataTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => new TableCell({
          children: [cellPara(t, { bold: true, color: P.table.headerText, size: 20 })],
          shading: { type: ShadingType.CLEAR, fill: P.table.headerBg },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((t, i) => new TableCell({
          children: [cellPara(t)],
          shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: P.table.surface } : undefined,
          margins: { top: 70, bottom: 70, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      })),
    ],
  });
}

const TABLE_DEFS = {
  TABLE_T7DOC: () => [
    tableTitle("Table 1: The 7-Point KYD mandatory document set"),
    dataTable(
      ["#", "Document Required", "Issuing Kenyan Authority", "Validity", "Verification Purpose"],
      C.T7DOC, [4, 24, 26, 14, 32],
    ),
  ],
  TABLE_TLIFECYCLE: () => [
    tableTitle("Table 2: Onboarding lifecycle statuses and transition owners"),
    dataTable(["Status", "Meaning", "Owner"], C.T_LIFECYCLE, [18, 58, 24]),
  ],
  TABLE_APIS: () => [
    tableTitle("Table 3: Registry integrations and per-document assertions"),
    dataTable(["Document", "Registry check", "Assertions tested"], C.T_APIS, [22, 30, 48]),
  ],
  TABLE_SLA: () => [
    tableTitle("Table 4: Service-level targets"),
    dataTable(["Process step", "Target"], C.T_SLA, [45, 55]),
  ],
  TABLE_SMS: () => [
    tableTitle("Table 5: Driver notification templates"),
    dataTable(["Event", "Message template"], C.T_SMS, [28, 72]),
  ],
  TABLE_ROLES: () => [
    tableTitle("Table 6: Roles and responsibilities"),
    dataTable(["Role", "Responsibilities"], C.T_ROLES, [28, 72]),
  ],
  TABLE_DEMO: () => [
    tableTitle("Table 7: Prototype demo accounts"),
    dataTable(["Login identifier", "Persona", "What it demonstrates"], C.T_DEMO, [22, 20, 58]),
  ],
};

function chapter(texts, defs) {
  const out = [];
  for (const t of texts) {
    if (t.startsWith("TABLE_")) out.push(...TABLE_DEFS[t]());
    else out.push(body(t));
  }
  return out;
}

// ── Footers ──────────────────────────────────────────────────────────────────
function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: FONT_BODY })],
    })],
  });
}
function docHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.innerLine, space: 4 } },
      children: [new TextRun({ text: "Msafiri Driver Onboarding & Compliance SOP", size: 18, color: "808080", font: FONT_BODY })],
    })],
  });
}

// ── Assembly ─────────────────────────────────────────────────────────────────
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const coverConfig = {
  title: "Driver Onboarding & Compliance SOP",
  subtitle: "7-Point KYD Verification Gate, Automated Registry Checks, Boarding PIN Protocol and Lifecycle Management for the Msafiri Feeder Cab Platform",
  englishLabel: "MSAFIRI OPERATIONS PLAYBOOK",
  metaLines: [
    "Prepared by: Msafiri Product & Operations",
    "Version: 1.0 (working draft for team review)",
    "Date: 6 September 2026",
    "Scope: Feeder cab drivers, Mombasa - Likoni / Diani corridor",
  ],
  footerLeft: "MSAFIRI - MOMBASA, KENYA",
  footerRight: "INTERNAL - OPERATIONS",
  palette: P,
};

const bodyChildren = [
  h1("1. Executive Summary"),
  ...chapter(C.CH1),

  h1("2. Purpose, Scope and Regulatory Context"),
  h2("2.1 Purpose of this specification"),
  body(C.CH2[0]),
  h2("2.2 Scope and exclusions"),
  body(C.CH2[1]),
  h2("2.3 Regulatory context"),
  body(C.CH2[2]),

  h1("3. The 7-Point KYD Verification Gate"),
  ...chapter(C.CH3),

  h1("4. Onboarding Lifecycle and Status Model"),
  ...chapter(C.CH4),

  h1("5. Automated Document Verification"),
  h2("5.1 Registry integrations and assertions"),
  ...chapter([C.CH5[0], C.CH5[1]]),
  h2("5.2 Cross-document consistency checks"),
  body(C.CH5[2]),
  h2("5.3 Check outcomes: verified, failed, flagged"),
  body(C.CH5[3]),
  h2("5.4 Service-level targets"),
  ...chapter([C.CH5[4], C.CH5[5]]),

  h1("6. Boarding PIN Verification at Pickup"),
  h2("6.1 Protocol"),
  body(C.CH6[0]),
  h2("6.2 Why the PIN fits the Likoni and Diani problem"),
  body(C.CH6[1]),
  h2("6.3 Failure handling and lockout"),
  body(C.CH6[2]),

  h1("7. Expiry Monitoring, Renewal and Auto-Suspension"),
  h2("7.1 Expiry radar and the 14-7-1 reminder cadence"),
  ...chapter([C.CH7[0], C.CH7[1]]),
  h2("7.2 Automatic suspension on lapse"),
  body(C.CH7[2]),
  h2("7.3 Reactivation through re-verification"),
  body(C.CH7[3]),
  h2("7.4 Manual review and officer overrides"),
  body(C.CH7[4]),

  h1("8. Roles and Responsibilities"),
  ...chapter(C.CH8),

  h1("9. Security, Privacy and Audit"),
  ...chapter(C.CH9),

  h1("10. Prototype Guide and Production Roadmap"),
  h2("10.1 What the prototype implements"),
  ...chapter([C.CH10[0], C.CH10[1]]),
  h2("10.2 Production integration roadmap"),
  body(C.CH10[2]),
];

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT_BODY, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT_HEAD, size: 32, bold: true, color: P.headingColor },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: FONT_HEAD, size: 28, bold: true, color: P.headingColor },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: FONT_HEAD, size: 24, bold: true, color: P.headingColor },
        paragraph: { spacing: { before: 200, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  sections: [
    // Section 1: Cover — margin 0, no footer, no page numbers
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1(coverConfig),
    },
    // Section 2: Front matter (TOC) — Roman numerals
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: FONT_HEAD, color: P.headingColor })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field.\"",
            italics: true, size: 18, color: "888888", font: FONT_BODY,
          })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Section 3: Body — Arabic numerals from 1
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: pageFooter() },
      children: bodyChildren,
    },
  ],
});

const OUT = "/home/z/my-project/download/Msafiri_Driver_Onboarding_SOP.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("WROTE " + OUT + " (" + buf.length + " bytes)");
});
