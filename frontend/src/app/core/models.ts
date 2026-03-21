export interface Season {
  id: string;
  name: string;
}

export interface SkiDay {
  id: string;
  season_id: string;
  name: string;
  date: string | null;
}

export interface Bus {
  id: string;
  ski_day_id: string;
  name: string;
  capacity: number;
  reserved_seats: number;
}

export type PersonType = 'freifahrer' | 'skikurs' | 'lehrteam';

export interface PersonTypeInfo {
  label: string;
  icon: string | null;
  isInstructorLike: boolean;
}

export const PERSON_TYPE_CONFIG: Record<PersonType, PersonTypeInfo> = {
  freifahrer: { label: 'Freifahrer', icon: null, isInstructorLike: false },
  skikurs: { label: 'Skikurs', icon: 'downhill_skiing', isInstructorLike: false },
  lehrteam: { label: 'Lehrteam', icon: 'school', isInstructorLike: true },
};

export const PERSON_TYPE_OPTIONS: PersonType[] = Object.keys(PERSON_TYPE_CONFIG) as PersonType[];

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  person_type: PersonType;
  birth_year: number | null;
  group_id: string;
}

export interface Group {
  id: string;
  season_id: string;
  name: string;
  members: Person[];
}

export interface Registration {
  id: string;
  group_id: string;
  ski_day_id: string;
}

export interface RidePreference {
  id: string;
  season_id: string;
  group_a_id: string;
  group_b_id: string;
}

export interface PersonPreference {
  id: string;
  season_id: string;
  person_a_id: string;
  person_b_id: string;
  person_a_name: string;
  person_b_name: string;
  group_a_name: string;
  group_b_name: string;
}

export interface PersonAbsence {
  id: string;
  person_id: string;
  ski_day_id: string;
  person_name: string;
  day_name: string;
}

export interface ConstraintConfig {
  instructor_consistency: number;
  passenger_consistency: number;
  ride_together: number;
  instructor_distribution: number;
}

export interface Assignment {
  id: string;
  registration_id: string;
  bus_id: string;
}

export interface SolveResult {
  assignments: Record<string, Record<string, string>>;
  score: number;
  unmet_preferences: string[][];
}

export interface SeatingPlanPerson {
  person_id: string;
  person_first_name: string;
  person_last_name: string;
  person_type: PersonType;
  birth_year: number | null;
}

export interface SeatingPlanGroup {
  group_id: string;
  group_name: string;
  assignment_id: string;
  members: SeatingPlanPerson[];
  is_instructor_group: boolean;
}

export interface SeatingPlanEntry {
  bus_name: string;
  bus_id: string;
  capacity: number;
  reserved_seats: number;
  groups: SeatingPlanGroup[];
}
