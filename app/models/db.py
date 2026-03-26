import uuid

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


INSTRUCTOR_TYPES: frozenset[str] = frozenset({"lehrteam"})


def new_uuid() -> str:
    return str(uuid.uuid4())


class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)

    days: Mapped[list["SkiDay"]] = relationship(back_populates="season", cascade="all, delete-orphan")
    bus_templates: Mapped[list["BusTemplate"]] = relationship(back_populates="season", cascade="all, delete-orphan")
    groups: Mapped[list["Group"]] = relationship(back_populates="season", cascade="all, delete-orphan")
    ride_preferences: Mapped[list["RidePreference"]] = relationship(
        back_populates="season", cascade="all, delete-orphan"
    )
    person_preferences: Mapped[list["PersonPreference"]] = relationship(
        back_populates="season", cascade="all, delete-orphan"
    )
    constraint_config: Mapped["ConstraintConfig | None"] = relationship(
        back_populates="season", cascade="all, delete-orphan", uselist=False
    )


class BusTemplate(Base):
    __tablename__ = "bus_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    season_id: Mapped[str] = mapped_column(ForeignKey("seasons.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    season: Mapped["Season"] = relationship(back_populates="bus_templates")


class SkiDay(Base):
    __tablename__ = "ski_days"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    season_id: Mapped[str] = mapped_column(ForeignKey("seasons.id"), nullable=False)
    date: Mapped[str] = mapped_column(Date, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

    season: Mapped["Season"] = relationship(back_populates="days")
    buses: Mapped[list["Bus"]] = relationship(back_populates="ski_day", cascade="all, delete-orphan")
    registrations: Mapped[list["Registration"]] = relationship(
        back_populates="ski_day", cascade="all, delete-orphan"
    )


class Bus(Base):
    __tablename__ = "buses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    ski_day_id: Mapped[str] = mapped_column(ForeignKey("ski_days.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    reserved_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    ski_day: Mapped["SkiDay"] = relationship(back_populates="buses")
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="bus", cascade="all, delete-orphan"
    )


class Person(Base):
    __tablename__ = "persons"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    first_name: Mapped[str] = mapped_column(String, nullable=False)
    last_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    person_type: Mapped[str] = mapped_column(String, nullable=False, default="freifahrer")
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), nullable=False)

    group: Mapped["Group"] = relationship(back_populates="members")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_instructor(self) -> bool:
        return self.person_type in INSTRUCTOR_TYPES


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    season_id: Mapped[str] = mapped_column(ForeignKey("seasons.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)

    season: Mapped["Season"] = relationship(back_populates="groups")
    members: Mapped[list["Person"]] = relationship(back_populates="group", cascade="all, delete-orphan")
    registrations: Mapped[list["Registration"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (UniqueConstraint("group_id", "ski_day_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), nullable=False)
    ski_day_id: Mapped[str] = mapped_column(ForeignKey("ski_days.id"), nullable=False)

    group: Mapped["Group"] = relationship(back_populates="registrations")
    ski_day: Mapped["SkiDay"] = relationship(back_populates="registrations")
    assignment: Mapped["Assignment | None"] = relationship(
        back_populates="registration", cascade="all, delete-orphan", uselist=False
    )


class RidePreference(Base):
    __tablename__ = "ride_preferences"
    __table_args__ = (UniqueConstraint("group_a_id", "group_b_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    season_id: Mapped[str] = mapped_column(ForeignKey("seasons.id"), nullable=False)
    group_a_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), nullable=False)
    group_b_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    season: Mapped["Season"] = relationship(back_populates="ride_preferences")
    group_a: Mapped["Group"] = relationship(foreign_keys=[group_a_id])
    group_b: Mapped["Group"] = relationship(foreign_keys=[group_b_id])


class PersonPreference(Base):
    __tablename__ = "person_preferences"
    __table_args__ = (UniqueConstraint("person_a_id", "person_b_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    season_id: Mapped[str] = mapped_column(ForeignKey("seasons.id"), nullable=False)
    person_a_id: Mapped[str] = mapped_column(ForeignKey("persons.id"), nullable=False)
    person_b_id: Mapped[str] = mapped_column(ForeignKey("persons.id"), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)

    season: Mapped["Season"] = relationship(back_populates="person_preferences")
    person_a: Mapped["Person"] = relationship(foreign_keys=[person_a_id])
    person_b: Mapped["Person"] = relationship(foreign_keys=[person_b_id])


class PersonAbsence(Base):
    __tablename__ = "person_absences"
    __table_args__ = (UniqueConstraint("person_id", "ski_day_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    person_id: Mapped[str] = mapped_column(ForeignKey("persons.id"), nullable=False)
    ski_day_id: Mapped[str] = mapped_column(ForeignKey("ski_days.id"), nullable=False)

    person: Mapped["Person"] = relationship()
    ski_day: Mapped["SkiDay"] = relationship()


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    registration_id: Mapped[str] = mapped_column(
        ForeignKey("registrations.id"), nullable=False, unique=True
    )
    bus_id: Mapped[str] = mapped_column(ForeignKey("buses.id"), nullable=False)

    registration: Mapped["Registration"] = relationship(back_populates="assignment")
    bus: Mapped["Bus"] = relationship(back_populates="assignments")


class ConstraintConfig(Base):
    __tablename__ = "constraint_configs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    season_id: Mapped[str] = mapped_column(ForeignKey("seasons.id"), nullable=False, unique=True)
    bus_name_prefix: Mapped[str] = mapped_column(String, nullable=False, default="Bus")
    default_bus_capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    default_reserved_seats: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    label_freifahrer: Mapped[str] = mapped_column(String, nullable=False, default="Freifahrer")
    icon_freifahrer: Mapped[str] = mapped_column(String, nullable=False, default="")
    label_skikurs: Mapped[str] = mapped_column(String, nullable=False, default="Skikurs")
    icon_skikurs: Mapped[str] = mapped_column(String, nullable=False, default="downhill_skiing")
    label_lehrteam: Mapped[str] = mapped_column(String, nullable=False, default="Lehrteam")
    icon_lehrteam: Mapped[str] = mapped_column(String, nullable=False, default="school")
    instructor_consistency: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    passenger_consistency: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    ride_together: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    instructor_distribution: Mapped[float] = mapped_column(Float, nullable=False, default=75.0)

    season: Mapped["Season"] = relationship(back_populates="constraint_config")
