import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  DataFile,
  Medication,
  CreateMedicationInput,
  UpdateMedicationInput,
  AdherenceEvent,
} from "./types";

// Use test directory if in test environment
const DATA_DIR = path.join(process.cwd(), process.env.DATA_DIR || "data");
const DATA_PATH = path.join(DATA_DIR, "db.json");

function ensureDataFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(DATA_PATH)) {
    const initial: DataFile = { medications: [], adherenceEvents: [] };
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2));
  }
}

export function readData(): DataFile {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw) as DataFile;
}

export function writeData(data: DataFile): void {
  ensureDataFile();
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function generateId(prefix: string): string {
  // Use crypto.randomBytes for cryptographically secure random IDs
  // 8 bytes = 16 hex characters, making collision probability extremely low
  const randomHex = randomBytes(8).toString("hex");
  const timestamp = Date.now().toString(36); // Base36 timestamp for sortability
  return `${prefix}_${timestamp}_${randomHex}`;
}

export function createMedication(
  input: CreateMedicationInput
): Medication {
  const now = new Date().toISOString();
  const med: Medication = {
    id: generateId("med"),
    name: input.name.trim(),
    dosage: input.dosage.trim(),
    frequencyPerDay: input.frequencyPerDay,
    startDate: input.startDate,
    quantityReceived: input.quantityReceived,
    daysSupply: input.daysSupply,
    createdAt: now,
    updatedAt: now,
  };
  const data = readData();
  data.medications.push(med);
  writeData(data);
  return med;
}

export function listMedications(): Medication[] {
  return readData().medications;
}

export function getMedication(id: string): Medication | undefined {
  return readData().medications.find((m) => m.id === id);
}

export function updateMedication(
  id: string,
  input: UpdateMedicationInput
): Medication | undefined {
  const data = readData();
  const idx = data.medications.findIndex((m) => m.id === id);
  if (idx === -1) return undefined;
  const prev = data.medications[idx];
  const next: Medication = {
    ...prev,
    ...input,
    name: input.name?.trim() ?? prev.name,
    dosage: input.dosage?.trim() ?? prev.dosage,
    updatedAt: new Date().toISOString(),
  };
  data.medications[idx] = next;
  writeData(data);
  return next;
}

export function deleteMedication(id: string): boolean {
  const data = readData();
  const before = data.medications.length;
  data.medications = data.medications.filter((m) => m.id !== id);
  data.adherenceEvents = data.adherenceEvents.filter(
    (e) => e.medicationId !== id
  );
  writeData(data);
  return data.medications.length < before;
}

export function addAdherenceEvent(
  event: Omit<AdherenceEvent, "id">
): AdherenceEvent {
  const data = readData();
  const created: AdherenceEvent = { ...event, id: generateId("adh") };
  data.adherenceEvents.push(created);
  writeData(data);
  return created;
}

export function listAdherenceEvents(medicationId?: string): AdherenceEvent[] {
  const data = readData();
  return medicationId
    ? data.adherenceEvents.filter((e) => e.medicationId === medicationId)
    : data.adherenceEvents;
}
