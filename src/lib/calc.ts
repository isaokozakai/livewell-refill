import { Medication, MedicationWithComputed, AdherenceEvent } from "./types";

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeAdherence(events: AdherenceEvent[]): {
  takenDoses: number;
  missedDoses: number;
  adherencePercentage: number;
} {
  const takenDoses = events.reduce(
    (sum, e) => (e.status === "taken" ? sum + e.doses : sum),
    0
  );
  const missedDoses = events.reduce(
    (sum, e) => (e.status === "missed" ? sum + e.doses : sum),
    0
  );
  const total = takenDoses + missedDoses;
  const adherencePercentage =
    total === 0 ? 0 : Math.round((takenDoses / total) * 100);
  return { takenDoses, missedDoses, adherencePercentage };
}

export function computeMedication(
  med: Medication,
  events: AdherenceEvent[],
  referenceDateISO?: string
): MedicationWithComputed {
  const today = referenceDateISO ?? toISODate(new Date());

  // Calculate total doses taken from adherence events
  const totalTakenDoses = events.reduce(
    (sum, e) => (e.status === "taken" ? sum + e.doses : sum),
    0
  );

  // Use actual consumption for remaining doses calculation
  const remainingDoses = Math.max(0, med.quantityReceived - totalTakenDoses);
  const freq = Math.max(1, med.frequencyPerDay);
  const daysLeft = Math.floor(remainingDoses / freq);

  const todayDate = new Date(today + "T00:00:00");
  const nextRefillDate = toISODate(
    new Date(todayDate.getTime() + daysLeft * 24 * 60 * 60 * 1000)
  );

  let status: MedicationWithComputed["status"] = "on_track";
  if (daysLeft <= 0) status = "overdue";
  else if (daysLeft <= 7) status = "running_low";

  const adherence = computeAdherence(events);

  return {
    ...med,
    remainingDoses,
    daysLeft,
    nextRefillDate,
    status,
    adherence,
  };
}

export function needsRefillSoon(med: MedicationWithComputed): boolean {
  return med.status === "running_low" || med.status === "overdue";
}
