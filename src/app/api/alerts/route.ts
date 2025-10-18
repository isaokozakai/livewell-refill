import { NextResponse } from "next/server";
import { listAdherenceEvents, listMedications } from "@/lib/storage";
import { computeMedication, needsRefillSoon } from "@/lib/calc";

export async function GET() {
  const meds = listMedications();
  const computed = meds.map((m) =>
    computeMedication(m, listAdherenceEvents(m.id))
  );
  const needing = computed.filter(needsRefillSoon);
  return NextResponse.json(needing);
}
