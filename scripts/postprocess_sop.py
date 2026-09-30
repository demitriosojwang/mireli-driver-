#!/usr/bin/env python3
"""Post-process the SOP docx for WPS/Office compatibility:
1. Remove empty <w:pgNumType/> from document.xml (confuses WPS).
2. Patch footer PAGE fields with explicit format switches:
   - footer referenced by the front-matter section (Roman) -> PAGE \\* ROMAN \\* MERGEFORMAT
   - footer referenced by the body section (Arabic)        -> PAGE \\* arabic \\* MERGEFORMAT
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path

DOC = Path("/home/z/my-project/download/Msafiri_Driver_Onboarding_SOP.docx")
TMP = Path("/home/z/my-project/scripts/_docx_tmp")

def main():
    if TMP.exists():
        shutil.rmtree(TMP)
    TMP.mkdir(parents=True)
    with zipfile.ZipFile(DOC) as z:
        z.extractall(TMP)

    doc_xml = (TMP / "word" / "document.xml").read_text(encoding="utf-8")

    # 1. strip empty pgNumType
    before = doc_xml.count("<w:pgNumType/>")
    doc_xml = doc_xml.replace("<w:pgNumType/>", "")
    print(f"removed {before} empty <w:pgNumType/>")

    # 2. map section order -> footer rels
    rels = (TMP / "word" / "_rels" / "document.xml.rels").read_text(encoding="utf-8")
    rel_map = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))

    # sectPr blocks in document order; capture footerReference ids + pgNumType fmt
    sect_blocks = re.findall(r"<w:sectPr[^>]*>.*?</w:sectPr>", doc_xml, flags=re.S)
    plan = []  # (footer_file, fmt)
    for blk in sect_blocks:
        m = re.search(r'<w:footerReference[^>]*w:type="default"[^>]*r:id="([^"]+)"', blk)
        fmt = "roman" if 'w:fmt="upperRoman"' in blk else ("arabic" if 'w:fmt="decimal"' in blk else None)
        if m and fmt:
            target = rel_map.get(m.group(1), "")
            plan.append((target, fmt))
    print("footer plan:", plan)

    for target, fmt in plan:
        fpath = TMP / "word" / target
        if not fpath.exists():
            print(f"skip missing {target}")
            continue
        xml = fpath.read_text(encoding="utf-8")
        switch = "ROMAN" if fmt == "roman" else "arabic"
        xml2, n = re.subn(
            r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
            rf"\1 PAGE \\* {switch} \\* MERGEFORMAT \2",
            xml,
        )
        fpath.write_text(xml2, encoding="utf-8")
        print(f"{target}: patched {n} PAGE field(s) -> {switch}")

    (TMP / "word" / "document.xml").write_text(doc_xml, encoding="utf-8")

    # rezip
    out = Path(str(DOC) + ".new")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(TMP.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(TMP).as_posix())
    shutil.move(str(out), str(DOC))
    shutil.rmtree(TMP)
    print("done:", DOC)

if __name__ == "__main__":
    sys.exit(main())
