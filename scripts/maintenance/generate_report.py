import json
import os
import sys
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle

source = Path(sys.argv[1])
output = Path(sys.argv[2])
data = json.loads(source.read_text(encoding="utf-8"))
output.parent.mkdir(parents=True, exist_ok=True)

font_candidates = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"]
font_path = next((path for path in font_candidates if Path(path).exists()), None)
font_name = "Helvetica"
if font_path:
    pdfmetrics.registerFont(TTFont("TamusniSans", font_path))
    font_name = "TamusniSans"

night = colors.HexColor("#111A2E")
blue = colors.HexColor("#2563EB")
silver = colors.HexColor("#BFC7D5")
cold = colors.HexColor("#F8FAFC")
muted = colors.HexColor("#5C6678")

styles = getSampleStyleSheet()
title = ParagraphStyle("TitleTM", parent=styles["Title"], fontName=font_name, fontSize=23, leading=28, textColor=cold, alignment=TA_CENTER, spaceAfter=10)
subtitle = ParagraphStyle("SubtitleTM", parent=styles["Normal"], fontName=font_name, fontSize=10, leading=15, textColor=silver, alignment=TA_CENTER)
h1 = ParagraphStyle("H1TM", parent=styles["Heading1"], fontName=font_name, fontSize=16, leading=20, textColor=night, spaceBefore=12, spaceAfter=8)
h2 = ParagraphStyle("H2TM", parent=styles["Heading2"], fontName=font_name, fontSize=11, leading=15, textColor=blue, spaceBefore=8, spaceAfter=5)
body = ParagraphStyle("BodyTM", parent=styles["BodyText"], fontName=font_name, fontSize=8.6, leading=13, textColor=night, spaceAfter=5)
small = ParagraphStyle("SmallTM", parent=body, fontSize=7.4, leading=10, textColor=muted)

def safe(value):
    return str(value if value is not None else "-").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(night)
    canvas.rect(0, height - 15 * mm, width, 15 * mm, fill=1, stroke=0)
    canvas.setFont(font_name, 8)
    canvas.setFillColor(cold)
    canvas.drawString(18 * mm, height - 9.5 * mm, "TAMUSNI - Maintenance hebdomadaire")
    canvas.setFillColor(muted)
    canvas.drawRightString(width - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()

doc = BaseDocTemplate(str(output), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=23*mm, bottomMargin=17*mm, title="TAMUSNI - Rapport de maintenance hebdomadaire", author="Système de maintenance automatisée TAMUSNI")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
doc.addPageTemplates(PageTemplate(id="TAMUSNI", frames=frame, onPage=page))
story = []

story.append(Table([[Paragraph("TAMUSNI", title)], [Paragraph("RAPPORT DE MAINTENANCE HEBDOMADAIRE", title)], [Paragraph(safe(data["date"]), subtitle)]], colWidths=[doc.width], style=TableStyle([("BACKGROUND", (0,0), (-1,-1), night), ("BOX", (0,0), (-1,-1), 0.7, silver), ("TOPPADDING", (0,0), (-1,-1), 10), ("BOTTOMPADDING", (0,0), (-1,-1), 10)])))
story.append(Spacer(1, 10*mm))
story.append(Paragraph("A. SYNTHÈSE", h1))
summary_rows = [["État", data["status"]], ["Durée", f"{round(data['durationMs']/60000, 1)} min"], ["Version initiale", data["versionInitial"][:12]], ["Version finale", data["versionFinal"][:12]], ["Production", "Accessible" if data["deployment"]["verified"] else "Dégradée"]]
story.append(Table([[Paragraph(safe(a), body), Paragraph(safe(b), body)] for a,b in summary_rows], colWidths=[45*mm, 125*mm], style=TableStyle([("BACKGROUND", (0,0), (0,-1), cold), ("GRID", (0,0), (-1,-1), .4, silver), ("VALIGN", (0,0), (-1,-1), "TOP"), ("PADDING", (0,0), (-1,-1), 6)])))

story.append(Paragraph("B. TESTS EFFECTUÉS", h1))
test_rows = [["Contrôle", "Résultat", "Durée"]] + [[check["name"], "OK" if check["ok"] else "ÉCHEC", f"{round(check.get('durationMs',0)/1000,1)} s"] for check in data["checks"]]
story.append(Table([[Paragraph(safe(cell), small) for cell in row] for row in test_rows], colWidths=[85*mm, 42*mm, 42*mm], repeatRows=1, style=TableStyle([("BACKGROUND", (0,0), (-1,0), night), ("TEXTCOLOR", (0,0), (-1,0), cold), ("GRID", (0,0), (-1,-1), .35, silver), ("PADDING", (0,0), (-1,-1), 5)])))
story.append(Paragraph(f"Sitemap : {data['sitemap']['checked']} URL contrôlées, {len(data['sitemap']['failures'])} échec(s).", body))

story.append(Paragraph("C. ANOMALIES", h1))
if data["anomalies"]:
    rows = [["ID", "Service", "Gravité", "Description", "Statut"]] + [[item["id"], item["service"], item["severity"], item["description"], item["status"]] for item in data["anomalies"]]
    story.append(Table([[Paragraph(safe(cell), small) for cell in row] for row in rows], colWidths=[25*mm, 40*mm, 18*mm, 67*mm, 20*mm], repeatRows=1, style=TableStyle([("BACKGROUND", (0,0), (-1,0), night), ("TEXTCOLOR", (0,0), (-1,0), cold), ("GRID", (0,0), (-1,-1), .35, silver), ("VALIGN", (0,0), (-1,-1), "TOP"), ("PADDING", (0,0), (-1,-1), 4)])))
else:
    story.append(Paragraph("Aucune anomalie détectée par les contrôles exécutés.", body))

story.append(Paragraph("D. CORRECTIONS", h1))
story.append(Paragraph("Aucune correction de code automatique n’a été appliquée pendant cette exécution." if not data["corrections"] else safe(data["corrections"]), body))

story.append(Paragraph("E. PERFORMANCE", h1))
perf_rows = [["Parcours", "TTFB", "LCP", "CLS", "Transfert", "Débordement"]] + [[item.get("name"), f"{item.get('ttfb','-')} ms", f"{item.get('lcp','-')} ms", item.get("cls","-"), f"{item.get('transferKb','-')} Ko", item.get("overflow","-")] for item in data["performance"]]
story.append(Table([[Paragraph(safe(cell), small) for cell in row] for row in perf_rows], colWidths=[38*mm, 25*mm, 25*mm, 22*mm, 30*mm, 30*mm], repeatRows=1, style=TableStyle([("BACKGROUND", (0,0), (-1,0), night), ("TEXTCOLOR", (0,0), (-1,0), cold), ("GRID", (0,0), (-1,-1), .35, silver), ("PADDING", (0,0), (-1,-1), 4)])))

story.append(Paragraph("F. SEO / GEO", h1))
story.append(Paragraph(f"Robots.txt, sitemap, routes localisées et pages institutionnelles contrôlés. Le sitemap contient {data['sitemap']['checked']} URL et {len(data['sitemap']['failures'])} échec(s).", body))

story.append(Paragraph("G. AUTOMATISATION", h1))
try:
    health = json.loads(data["worker"].get("body") or "{}")
except Exception:
    health = {}
try:
    newsletter_scheduler = json.loads(data.get("newsletterScheduler", {}).get("body") or "{}")
except Exception:
    newsletter_scheduler = {}
for label, value in [["Worker éditorial", "Disponible" if data["worker"]["status"] == 200 else "Indisponible"], ["Cycle", health.get("cycleType", "-")], ["Numéro", health.get("cycleNumber", "-")], ["Prochaine publication", f"{health.get('nextPublicationLocalDate', '-')} à {health.get('publicationTime', '-')}"] , ["Planificateur newsletter", "Actif" if newsletter_scheduler.get("state") == "active" else "Indisponible"], ["Fenêtre newsletter", "Dimanche 08:00-08:14"], ["Fuseau", health.get("timeZone", "Africa/Casablanca")]]:
    story.append(Paragraph(f"<b>{safe(label)} :</b> {safe(value)}", body))

story.append(Paragraph("H. DÉPLOIEMENT", h1))
story.append(Paragraph(f"Commit contrôlé : {safe(data['versionFinal'])}<br/>Environnement : production<br/>Site : {safe(data['deployment']['site'])}<br/>Vérification publique : {'réussie' if data['deployment']['verified'] else 'échouée'}<br/>Association commit/déploiement : {safe(data['deployment']['commitAssociation'])}", body))

story.append(Paragraph("I. RISQUES ET RÉSERVES", h1))
for item in data["limitations"]:
    story.append(Paragraph(f"• {safe(item)}", body))

story.append(Paragraph("J. CONCLUSION", h1))
story.append(Paragraph(f"<b>{safe(data['status'])}</b>", h2))
story.append(Paragraph("Ce rapport reflète uniquement les contrôles réellement exécutés. Il ne constitue pas une garantie absolue d’absence de défaut.", body))
doc.build(story)
print(output)
