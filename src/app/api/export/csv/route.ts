import { NextResponse } from "next/server";
import { listAdherenceEvents, listMedications } from "@/lib/storage";
import { computeMedication } from "@/lib/calc";

// Escape CSV values to prevent formula injection
function escapeCSV(value: string | number): string {
  const str = String(value);
  // If value starts with =, +, -, @, prefix with single quote to prevent formula injection
  if (/^[=+\-@]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  // Standard CSV escaping for values with special characters
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const meds = listMedications();
  const allEvents = listAdherenceEvents();

  // Group events by medicationId to avoid N+1 queries
  const eventsByMed = new Map<string, typeof allEvents>();
  for (const event of allEvents) {
    if (!eventsByMed.has(event.medicationId)) {
      eventsByMed.set(event.medicationId, []);
    }
    eventsByMed.get(event.medicationId)!.push(event);
  }

  const rows = meds.map((m) =>
    computeMedication(m, eventsByMed.get(m.id) || [])
  );

  const header = [
    "id",
    "name",
    "dosage",
    "frequencyPerDay",
    "startDate",
    "quantityReceived",
    "daysSupply",
    "remainingDoses",
    "daysLeft",
    "nextRefillDate",
    "status",
    "adherencePercentage",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        escapeCSV(r.id),
        escapeCSV(r.name),
        escapeCSV(r.dosage),
        r.frequencyPerDay,
        r.startDate,
        r.quantityReceived,
        r.daysSupply,
        r.remainingDoses,
        r.daysLeft,
        r.nextRefillDate,
        r.status,
        r.adherence.adherencePercentage,
      ].join(",")
    ),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=refill-schedule.csv",
    },
  });
}
