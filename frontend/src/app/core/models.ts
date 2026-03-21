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

export interface Person {
  id: string;
  name: string;
  is_instructor: boolean;
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
  person_name: string;
  is_instructor: boolean;
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
