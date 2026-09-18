#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convert the qa/*.md reports into PDFs, saved in qa/pdf/.

Approach: markdown -> HTML (via the `markdown` package, with the `tables`
extension) -> a small HTML-subset walker that builds a reportlab Platypus
story (headings, paragraphs, bullet lists, tables, hr, bold/italic/code
inline spans, links). This avoids needing pandoc/wkhtmltopdf/weasyprint,
none of which are installed in this environment.
"""
import os
import re
import sys
from html.parser import HTMLParser

import markdown
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    ListFlowable, ListItem, PageBreak, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

SRC_DIR = os.path.join(os.path.dirname(__file__), "..")
OUT_DIR = os.path.dirname(__file__)

# The base-14 Helvetica font has no glyph for the Rupee sign (U+20B9), which
# these reports use throughout. Register Windows' Arial TTF instead — it has
# full Unicode coverage including the Rupee sign, en/em dashes, and bullets.
_FONT_DIR = "C:/Windows/Fonts"
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_ITALIC = "Helvetica-Oblique"
FONT_MONO = "Courier"
try:
    pdfmetrics.registerFont(TTFont("Arial", os.path.join(_FONT_DIR, "arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", os.path.join(_FONT_DIR, "arialbd.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Italic", os.path.join(_FONT_DIR, "ariali.ttf")))
    pdfmetrics.registerFont(TTFont("Consolas", os.path.join(_FONT_DIR, "consola.ttf")))
    FONT_REGULAR = "Arial"
    FONT_BOLD = "Arial-Bold"
    FONT_ITALIC = "Arial-Italic"
    FONT_MONO = "Consolas"
except Exception as e:  # pragma: no cover - falls back to Helvetica
    print(f"WARNING: could not register Arial TTF ({e}); Rupee signs may not render")

NAVY = colors.HexColor("#0f172a")
TEAL = colors.HexColor("#0e7490")
GREY = colors.HexColor("#475569")
LIGHT = colors.HexColor("#f1f5f9")
BORDER = colors.HexColor("#cbd5e1")
RED = colors.HexColor("#b91c1c")

styles = getSampleStyleSheet()
BASE = ParagraphStyle("Base", parent=styles["Normal"], fontName=FONT_REGULAR,
                       fontSize=9.5, leading=13.5, textColor=NAVY, spaceAfter=6)
H1 = ParagraphStyle("H1", parent=BASE, fontName=FONT_BOLD, fontSize=19,
                     leading=23, textColor=NAVY, spaceBefore=4, spaceAfter=10)
H2 = ParagraphStyle("H2", parent=BASE, fontName=FONT_BOLD, fontSize=14,
                     leading=18, textColor=TEAL, spaceBefore=16, spaceAfter=8)
H3 = ParagraphStyle("H3", parent=BASE, fontName=FONT_BOLD, fontSize=11.5,
                     leading=15, textColor=NAVY, spaceBefore=12, spaceAfter=6)
P = ParagraphStyle("P", parent=BASE, spaceAfter=8, alignment=TA_LEFT)
LI = ParagraphStyle("LI", parent=BASE, spaceAfter=3, leading=13)
CELL = ParagraphStyle("Cell", parent=BASE, fontSize=8, leading=11, spaceAfter=0)
CELL_HDR = ParagraphStyle("CellHdr", parent=CELL, fontName=FONT_BOLD,
                           textColor=colors.white)
META = ParagraphStyle("Meta", parent=BASE, fontSize=8.5, textColor=GREY,
                       spaceAfter=14)

INLINE_TAGS = {"strong", "b", "em", "i", "code", "a"}


def inline_to_reportlab(html_fragment: str) -> str:
    """Convert a small set of inline HTML tags to reportlab mini-markup."""
    s = html_fragment
    s = re.sub(r"<(?:strong|b)>(.*?)</(?:strong|b)>",
               rf'<font face="{FONT_BOLD}">\1</font>', s, flags=re.S)
    s = re.sub(r"<(?:em|i)>(.*?)</(?:em|i)>",
               rf'<font face="{FONT_ITALIC}">\1</font>', s, flags=re.S)
    s = re.sub(r'<code>(.*?)</code>', rf'<font face="{FONT_MONO}">\1</font>', s, flags=re.S)
    s = re.sub(r'<a href="([^"]*)">(.*?)</a>', r'<font color="#0e7490"><u>\2</u></font>', s, flags=re.S)
    return s


class MDHTMLWalker(HTMLParser):
    """Walks the HTML produced by python-markdown and builds a Platypus story."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.story = []
        self.stack = []          # tag stack
        self.buf = []            # inline text buffer
        self.table_rows = []     # current table: list of rows, each a list of cell strings
        self.table_row = []
        self.in_table = False
        self.in_thead = False
        self.list_stack = []     # stack of (ordered_bool, items[])
        self.cell_buf = []
        self.skip_depth = 0

    # ---- helpers -------------------------------------------------
    def flush_para(self, style=P):
        text = "".join(self.buf).strip()
        text = re.sub(r"\s+", " ", text)
        self.buf = []
        if text:
            self.story.append(Paragraph(inline_to_reportlab(text), style))

    def current_list(self):
        return self.list_stack[-1] if self.list_stack else None

    # ---- HTMLParser hooks -----------------------------------------
    def handle_starttag(self, tag, attrs):
        if tag in ("h1",):
            self.buf = []
        elif tag in ("h2",):
            self.buf = []
        elif tag in ("h3", "h4"):
            self.buf = []
        elif tag == "p":
            self.buf = []
        elif tag == "hr":
            self.story.append(HRFlowable(width="100%", thickness=0.6, color=BORDER,
                                          spaceBefore=8, spaceAfter=8))
        elif tag in ("ul", "ol"):
            self.list_stack.append([tag == "ol", []])
        elif tag == "li":
            self.buf = []
        elif tag == "table":
            self.in_table = True
            self.table_rows = []
        elif tag == "thead":
            self.in_thead = True
        elif tag == "tbody":
            self.in_thead = False
        elif tag == "tr":
            self.table_row = []
        elif tag in ("td", "th"):
            self.cell_buf = []
        elif tag in ("strong", "b"):
            self.buf.append("<b>")
        elif tag in ("em", "i"):
            self.buf.append("<i>")
        elif tag == "code":
            self.buf.append("<code>")
        elif tag == "a":
            href = dict(attrs).get("href", "")
            self.buf.append(f'<a href="{href}">')

    def handle_endtag(self, tag):
        if tag == "h1":
            self.flush_para(H1)
        elif tag == "h2":
            self.flush_para(H2)
        elif tag in ("h3", "h4"):
            self.flush_para(H3)
        elif tag == "p":
            if self.in_table:
                text = "".join(self.buf).strip()
                self.buf = []
                self.cell_buf.append(text)
            else:
                self.flush_para(P)
        elif tag in ("ul", "ol"):
            ordered, items = self.list_stack.pop()
            flow_items = [ListItem(Paragraph(inline_to_reportlab(t), LI),
                                    leftIndent=12) for t in items]
            lf = ListFlowable(flow_items, bulletType="bullet",
                               leftIndent=18, bulletFontSize=8.5, spaceAfter=6)
            if self.list_stack:
                # nested list text placeholder - flatten (rare in these docs)
                pass
            self.story.append(lf)
        elif tag == "li":
            text = "".join(self.buf).strip()
            text = re.sub(r"\s+", " ", text)
            self.buf = []
            if self.list_stack:
                self.list_stack[-1][1].append(text)
        elif tag == "table":
            self.in_table = False
            self._emit_table()
        elif tag == "tr":
            if self.table_row:
                self.table_rows.append(self.table_row)
            self.table_row = []
        elif tag in ("td", "th"):
            text = "".join(self.cell_buf).strip()
            text = re.sub(r"\s+", " ", text)
            is_header = self.in_thead
            style = CELL_HDR if is_header else CELL
            self.table_row.append(Paragraph(inline_to_reportlab(text), style))
            self.cell_buf = []
        elif tag in ("strong", "b"):
            self.buf.append("</b>")
        elif tag in ("em", "i"):
            self.buf.append("</i>")
        elif tag == "code":
            self.buf.append("</code>")
        elif tag == "a":
            self.buf.append("</a>")

    def handle_data(self, data):
        # Literal text: escape anything ReportLab's mini-markup would read as
        # a tag (e.g. "<Link>" in a note about a React component).
        data = data.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if self.in_table and not self.list_stack:
            self.cell_buf.append(data)
        else:
            self.buf.append(data)

    def _emit_table(self):
        if not self.table_rows:
            return
        n_cols = max(len(r) for r in self.table_rows)
        rows = []
        for r in self.table_rows:
            r = list(r) + [Paragraph("", CELL)] * (n_cols - len(r))
            rows.append(r)
        avail_width = 7.6 * inch
        col_width = avail_width / n_cols
        # give first column a bit more room if it looks like an ID/name col
        t = Table(rows, colWidths=[col_width] * n_cols, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        self.story.append(t)
        self.story.append(Spacer(1, 10))


def build_pdf(md_path: str, pdf_path: str, doc_title: str):
    with open(md_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    html = markdown.markdown(md_text, extensions=["tables", "sane_lists"])

    walker = MDHTMLWalker()
    walker.feed(html)

    doc = SimpleDocTemplate(
        pdf_path, pagesize=LETTER,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.7 * inch, bottomMargin=0.7 * inch,
        title=doc_title, author="Claude (QA/SDET)",
    )

    def on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(GREY)
        canvas.drawString(0.7 * inch, 0.45 * inch, "PRSA Skating Academy — QA Cycle, 18 Sep 2026")
        canvas.drawRightString(LETTER[0] - 0.7 * inch, 0.45 * inch, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(walker.story, onFirstPage=on_page, onLaterPages=on_page)


DOCS = [
    ("QA_TEST_PLAN.md", "QA_TEST_PLAN.pdf", "QA Test Plan"),
    ("QA_TEST_CASES.md", "QA_TEST_CASES.pdf", "QA Test Cases"),
    ("QA_EXECUTION_REPORT.md", "QA_EXECUTION_REPORT.pdf", "QA Execution Report"),
    ("QA_CHECKLIST.md", "QA_CHECKLIST.pdf", "QA Checklist"),
    ("PRODUCTION_READINESS_REPORT.md", "PRODUCTION_READINESS_REPORT.pdf", "Production Readiness Report"),
    ("PRODUCTION_BLOCKERS.md", "PRODUCTION_BLOCKERS.pdf", "Production Blockers"),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for src_name, out_name, title in DOCS:
        src = os.path.join(SRC_DIR, src_name)
        out = os.path.join(OUT_DIR, out_name)
        if not os.path.exists(src):
            print(f"SKIP (missing): {src_name}")
            continue
        build_pdf(src, out, title)
        size_kb = os.path.getsize(out) / 1024
        print(f"OK  {src_name} -> pdf/{out_name} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
