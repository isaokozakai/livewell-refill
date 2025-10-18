import { NextRequest, NextResponse } from "next/server";
import {
  addAdherenceEvent,
  createMedication,
  deleteMedication,
  listAdherenceEvents,
  listMedications,
  updateMedication,
} from "@/lib/storage";
import { computeMedication } from "@/lib/calc";

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

  const computed = meds.map((m) =>
    computeMedication(m, eventsByMed.get(m.id) || [])
  );
  return NextResponse.json(computed);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const required = [
      "name",
      "dosage",
      "frequencyPerDay",
      "startDate",
      "quantityReceived",
      "daysSupply",
    ];
    for (const field of required) {
      if (!(field in body)) {
        return NextResponse.json(
          { error: `Missing field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate types and ranges
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "name must be a non-empty string" },
        { status: 400 }
      );
    }
    if (typeof body.dosage !== "string" || body.dosage.trim().length === 0) {
      return NextResponse.json(
        { error: "dosage must be a non-empty string" },
        { status: 400 }
      );
    }
    if (
      typeof body.frequencyPerDay !== "number" ||
      body.frequencyPerDay <= 0 ||
      !Number.isFinite(body.frequencyPerDay)
    ) {
      return NextResponse.json(
        { error: "frequencyPerDay must be a positive number" },
        { status: 400 }
      );
    }
    if (typeof body.startDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.startDate)) {
      return NextResponse.json(
        { error: "startDate must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }
    if (
      typeof body.quantityReceived !== "number" ||
      body.quantityReceived <= 0 ||
      !Number.isFinite(body.quantityReceived)
    ) {
      return NextResponse.json(
        { error: "quantityReceived must be a positive number" },
        { status: 400 }
      );
    }
    if (
      typeof body.daysSupply !== "number" ||
      body.daysSupply <= 0 ||
      !Number.isFinite(body.daysSupply)
    ) {
      return NextResponse.json(
        { error: "daysSupply must be a positive number" },
        { status: 400 }
      );
    }

    const med = createMedication(body);
    return NextResponse.json(med, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...update } = body || {};
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Basic validation for updated fields
    if (update.frequencyPerDay !== undefined && update.frequencyPerDay <= 0) {
      return NextResponse.json({ error: "frequencyPerDay must be positive" }, { status: 400 });
    }
    if (update.quantityReceived !== undefined && update.quantityReceived <= 0) {
      return NextResponse.json({ error: "quantityReceived must be positive" }, { status: 400 });
    }
    if (update.daysSupply !== undefined && update.daysSupply <= 0) {
      return NextResponse.json({ error: "daysSupply must be positive" }, { status: 400 });
    }

    const med = updateMedication(id, update);
    if (!med) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(med);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const ok = deleteMedication(id);
  if (!ok) {
    return NextResponse.json({ error: "Medication not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  // Add adherence event: { medicationId, date, doses, status }
  try {
    const body = await req.json();
    const { medicationId, date, doses, status } = body || {};

    if (!medicationId || !date || !doses || !status) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (doses <= 0) {
      return NextResponse.json({ error: "doses must be positive" }, { status: 400 });
    }
    if (status !== "taken" && status !== "missed") {
      return NextResponse.json(
        { error: "status must be 'taken' or 'missed'" },
        { status: 400 }
      );
    }

    const created = addAdherenceEvent({ medicationId, date, doses, status });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
