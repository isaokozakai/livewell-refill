export type AdherenceEvent = {
  id: string;
  medicationId: string;
  date: string; // ISO date (yyyy-mm-dd)
  doses: number; // number of doses marked in this event
  status: "taken" | "missed";
};

export type Medication = {
  id: string;
  name: string;
  dosage: string; // e.g., "10 mg"
  frequencyPerDay: number; // e.g., 2 per day
  startDate: string; // ISO date string
  quantityReceived: number; // e.g., 30 tablets
  daysSupply: number; // e.g., 15 days for 2/day and 30 tablets
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
};

export type MedicationWithComputed = Medication & {
  remainingDoses: number;
  daysLeft: number;
  nextRefillDate: string; // ISO date
  status: "on_track" | "running_low" | "overdue";
  adherence: {
    takenDoses: number;
    missedDoses: number;
    adherencePercentage: number; // 0-100
  };
};

export type DataFile = {
  medications: Medication[];
  adherenceEvents: AdherenceEvent[];
};

export type CreateMedicationInput = {
  name: string;
  dosage: string;
  frequencyPerDay: number;
  startDate: string;
  quantityReceived: number;
  daysSupply: number;
};

export type UpdateMedicationInput = Partial<CreateMedicationInput>;

// RxNorm approximate term API candidate shape
export type RxApproximateCandidate = {
  rxcui: string;
  name: string;
  score: string | number;
  rank?: string | number;
};
