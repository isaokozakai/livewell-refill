import { Medication, MedicationWithComputed, AdherenceEvent } from "./types";

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeAdherence(events: AdherenceEvent[]): {
  takenDoses: number;
  missedDoses: number;
  adherencePercentage: number;
} {
  const takenDoses = events
    .filter((e) => e.status === "taken")
    .reduce((sum, e) => sum + e.doses, 0);
  const missedDoses = events
    .filter((e) => e.status === "missed")
    .reduce((sum, e) => sum + e.doses, 0);
  const total = takenDoses + missedDoses;
  const adherencePercentage =
    total === 0 ? 0 : Math.round((takenDoses / total) * 100);
  return { takenDoses, missedDoses, adherencePercentage };
}

export function computeMedication(
  med: Medication,
  events: AdherenceEvent[],
  todayISO?: string
): MedicationWithComputed {
  const today = todayISO ?? toISODate(new Date());

  // Calculate actual consumed doses from adherence events
  const actualConsumed = events
    .filter((e) => e.status === "taken")
    .reduce((sum, e) => sum + e.doses, 0);

  // Use actual consumption for remaining doses calculation
  const remainingDoses = Math.max(0, med.quantityReceived - actualConsumed);
  const daysLeft =
    med.frequencyPerDay === 0
      ? med.daysSupply
      : Math.floor(remainingDoses / med.frequencyPerDay);
  const nextRefillDate = toISODate(
    new Date(
      new Date(today + "T00:00:00").getTime() + daysLeft * 24 * 60 * 60 * 1000
    )
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
