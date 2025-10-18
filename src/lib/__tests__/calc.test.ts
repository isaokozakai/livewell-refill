import { computeAdherence, computeMedication, needsRefillSoon } from "../calc";
import type { Medication, AdherenceEvent, MedicationWithComputed } from "../types";

describe("Medication Calculations", () => {
  describe("computeAdherence", () => {
    it("should calculate 100% adherence when all doses taken", () => {
      const events: AdherenceEvent[] = [
        { id: "1", medicationId: "med_1", date: "2025-01-01", doses: 2, status: "taken" },
        { id: "2", medicationId: "med_1", date: "2025-01-02", doses: 2, status: "taken" },
      ];
      const result = computeAdherence(events);

      expect(result.takenDoses).toBe(4);
      expect(result.missedDoses).toBe(0);
      expect(result.adherencePercentage).toBe(100);
    });

    it("should calculate partial adherence correctly", () => {
      const events: AdherenceEvent[] = [
        { id: "1", medicationId: "med_1", date: "2025-01-01", doses: 2, status: "taken" },
        { id: "2", medicationId: "med_1", date: "2025-01-02", doses: 2, status: "missed" },
      ];
      const result = computeAdherence(events);

      expect(result.adherencePercentage).toBe(50); // 2 taken / 4 total = 50%
    });

    it("should return zero adherence when no events exist", () => {
      const result = computeAdherence([]);

      expect(result).toEqual({
        takenDoses: 0,
        missedDoses: 0,
        adherencePercentage: 0,
      });
    });
  });

  describe("computeMedication", () => {
    const baseMedication: Medication = {
      id: "med_123",
      name: "Aspirin",
      dosage: "81 mg",
      frequencyPerDay: 2,
      startDate: "2025-01-01",
      quantityReceived: 30,
      daysSupply: 15,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    it("should calculate remaining doses and days left", () => {
      const events: AdherenceEvent[] = [
        { id: "1", medicationId: "med_123", date: "2025-01-01", doses: 2, status: "taken" },
        { id: "2", medicationId: "med_123", date: "2025-01-02", doses: 2, status: "taken" },
      ];
      const result = computeMedication(baseMedication, events, "2025-01-03");

      expect(result.remainingDoses).toBe(26); // 30 - 4 = 26
      expect(result.daysLeft).toBe(13); // 26 / 2 = 13 days
      expect(result.status).toBe("on_track"); // > 7 days
    });

    it("should classify status as 'running_low' when <= 7 days left", () => {
      // Consume 16 doses (8 days worth)
      const events: AdherenceEvent[] = Array.from({ length: 8 }, (_, i) => ({
        id: `evt_${i}`,
        medicationId: "med_123",
        date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        doses: 2,
        status: "taken" as const,
      }));

      const result = computeMedication(baseMedication, events, "2025-01-09");

      expect(result.daysLeft).toBe(7);
      expect(result.status).toBe("running_low");
    });

    it("should classify status as 'overdue' when out of medication", () => {
      // Consume all 30 doses
      const events: AdherenceEvent[] = Array.from({ length: 15 }, (_, i) => ({
        id: `evt_${i}`,
        medicationId: "med_123",
        date: `2025-01-${String(i + 1).padStart(2, "0")}`,
        doses: 2,
        status: "taken" as const,
      }));

      const result = computeMedication(baseMedication, events, "2025-01-16");

      expect(result.remainingDoses).toBe(0);
      expect(result.status).toBe("overdue");
    });

    it("should ignore missed doses in remaining calculation", () => {
      const events: AdherenceEvent[] = [
        { id: "1", medicationId: "med_123", date: "2025-01-01", doses: 2, status: "taken" },
        { id: "2", medicationId: "med_123", date: "2025-01-02", doses: 2, status: "missed" },
      ];
      const result = computeMedication(baseMedication, events, "2025-01-03");

      // Only "taken" doses reduce remaining
      expect(result.remainingDoses).toBe(28); // 30 - 2 = 28
      // But adherence tracks both
      expect(result.adherence.takenDoses).toBe(2);
      expect(result.adherence.missedDoses).toBe(2);
    });
  });

  describe("needsRefillSoon", () => {
    const createMedWithStatus = (status: MedicationWithComputed["status"]): MedicationWithComputed => ({
      id: "med_1",
      name: "Test",
      dosage: "10mg",
      frequencyPerDay: 1,
      startDate: "2025-01-01",
      quantityReceived: 30,
      daysSupply: 30,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      remainingDoses: 10,
      daysLeft: 10,
      nextRefillDate: "2025-01-11",
      status,
      adherence: { takenDoses: 20, missedDoses: 0, adherencePercentage: 100 },
    });

    it("should return true for medications running low or overdue", () => {
      expect(needsRefillSoon(createMedWithStatus("running_low"))).toBe(true);
      expect(needsRefillSoon(createMedWithStatus("overdue"))).toBe(true);
    });

    it("should return false for medications on track", () => {
      expect(needsRefillSoon(createMedWithStatus("on_track"))).toBe(false);
    });
  });
});
