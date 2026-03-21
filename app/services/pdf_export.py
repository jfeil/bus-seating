from io import BytesIO

from fpdf import FPDF
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.db import Assignment, Bus, Group, Registration, Season, SkiDay


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

        for bus in buses:
            occupancy = sum(
                len(a.registration.group.members) for a in bus.assignments
            )
            effective = bus.capacity - bus.reserved_seats

            pdf.set_font("Helvetica", "B", 12)
            pdf.set_fill_color(66, 133, 244)
            pdf.set_text_color(255, 255, 255)
            pdf.cell(
                0, 8,
                f"  {bus.name}    ({occupancy}/{effective} seats)",
                fill=True, new_x="LMARGIN", new_y="NEXT",
            )
            pdf.set_text_color(0, 0, 0)
            pdf.ln(2)

            assignments_sorted = sorted(
                bus.assignments,
                key=lambda a: (not any(m.is_instructor for m in a.registration.group.members), a.registration.group.name),
            )

            for assignment in assignments_sorted:
                group = assignment.registration.group
                is_instructor_group = any(m.is_instructor for m in group.members)

                pdf.set_font("Helvetica", "B", 10)
                prefix = "[Instructor] " if is_instructor_group else ""
                pdf.cell(
                    0, 6,
                    f"  {prefix}{group.name} ({len(group.members)} members)",
                    new_x="LMARGIN", new_y="NEXT",
                )

                pdf.set_font("Helvetica", "", 9)
                members_sorted = sorted(group.members, key=lambda m: m.name)
                for member in members_sorted:
                    suffix = "  *" if member.is_instructor else ""
                    pdf.cell(
                        0, 5,
                        f"      {member.name}{suffix}",
                        new_x="LMARGIN", new_y="NEXT",
                    )

                pdf.ln(2)

            if not bus.assignments:
                pdf.set_font("Helvetica", "I", 9)
                pdf.set_text_color(150, 150, 150)
                pdf.cell(0, 6, "  No groups assigned", new_x="LMARGIN", new_y="NEXT")
                pdf.set_text_color(0, 0, 0)

            pdf.ln(4)

    buf = BytesIO()
    pdf.output(buf)
    buf.seek(0)
    return buf
