from io import BytesIO

from fpdf import FPDF
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.db import Assignment, Bus, Group, PersonAbsence, Registration, Season, SkiDay


def generate_seating_pdf(db: Session, season_id: str) -> BytesIO:
    season = db.get(Season, season_id)
    season_name = season.name if season else "Unknown Season"

    days = db.scalars(
        select(SkiDay)
        .where(SkiDay.season_id == season_id)
        .order_by(SkiDay.date, SkiDay.name)
    ).all()

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)

    for day in days:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 18)
        pdf.cell(0, 12, season_name, new_x="LMARGIN", new_y="NEXT")

        day_label = day.name
        if day.date:
            day_label += f"  ({day.date})"
        pdf.set_font("Helvetica", "B", 14)
        pdf.cell(0, 10, day_label, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

        buses = db.scalars(
            select(Bus)
            .where(Bus.ski_day_id == day.id)
            .order_by(Bus.name)
            .options(
                selectinload(Bus.assignments)
                .selectinload(Assignment.registration)
                .selectinload(Registration.group)
                .selectinload(Group.members)
            )
        ).all()

        # Load absent person IDs for this day
        absent_ids = set(db.scalars(
            select(PersonAbsence.person_id)
            .where(PersonAbsence.ski_day_id == day.id)
        ).all())

        TYPE_LABELS = {"lehrteam": "Lehrteam", "skikurs": "Skikurs"}

        for bus in buses:
            # Collect all present members across all groups in this bus
            all_present = []
            for assignment in bus.assignments:
                group = assignment.registration.group
                for m in group.members:
                    if m.id not in absent_ids:
                        all_present.append(m)

            effective = bus.capacity - bus.reserved_seats

            pdf.set_font("Helvetica", "B", 12)
            pdf.set_fill_color(66, 133, 244)
            pdf.set_text_color(255, 255, 255)
            pdf.cell(
                0, 8,
                f"  {bus.name}    ({len(all_present)}/{effective} seats)",
                fill=True, new_x="LMARGIN", new_y="NEXT",
            )
            pdf.set_text_color(0, 0, 0)
            pdf.ln(2)

            # Sort: instructors first, then by last name
            members_sorted = sorted(
                all_present,
                key=lambda m: (not m.is_instructor, m.last_name.lower(), m.first_name.lower()),
            )

            # Print with a separator between instructors and others
            printed_separator = False
            for member in members_sorted:
                if not member.is_instructor and not printed_separator and any(m.is_instructor for m in members_sorted):
                    pdf.ln(1)
                    pdf.set_draw_color(200, 200, 200)
                    pdf.line(pdf.get_x() + 5, pdf.get_y(), pdf.get_x() + pdf.epw - 5, pdf.get_y())
                    pdf.ln(1)
                    printed_separator = True

                type_tag = f"  [{TYPE_LABELS[member.person_type]}]" if member.person_type in TYPE_LABELS else ""
                birth_tag = f"  (*{member.birth_year})" if member.birth_year else ""
                pdf.set_font("Helvetica", "B" if member.is_instructor else "", 9)
                pdf.cell(
                    0, 5,
                    f"    {member.last_name}, {member.first_name}{type_tag}{birth_tag}",
                    new_x="LMARGIN", new_y="NEXT",
                )

            pdf.ln(2)

            if not all_present and not bus.assignments:
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(150, 150, 150)
                pdf.cell(0, 6, "  No groups assigned", new_x="LMARGIN", new_y="NEXT")
                pdf.set_text_color(0, 0, 0)

            pdf.ln(4)

    buf = BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return buf
