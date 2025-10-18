/**
 * Integration tests for /api/medications endpoint
 * Tests core CRUD operations and validation
 */

import { NextRequest } from "next/server";
import { GET, POST, PUT, DELETE, PATCH } from "../medications/route";

describe("API: /api/medications", () => {
  describe("POST - Create Medication", () => {
    it("should create a medication with valid data", async () => {
      const validPayload = {
        name: "Aspirin",
        dosage: "81 mg",
        frequencyPerDay: 1,
        startDate: "2025-01-01",
        quantityReceived: 30,
        daysSupply: 30,
      };

      const request = new NextRequest("http://localhost:3000/api/medications", {
        method: "POST",
        body: JSON.stringify(validPayload),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty("id");
      expect(data.name).toBe("Aspirin");
      expect(data).toHaveProperty("createdAt");
    });

    it("should reject request with missing required fields", async () => {
      const invalidPayload = {
        dosage: "10 mg",
        // Missing name and other required fields
      };

      const request = new NextRequest("http://localhost:3000/api/medications", {
        method: "POST",
        body: JSON.stringify(invalidPayload),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("should validate number ranges", async () => {
      const invalidPayload = {
        name: "Test Med",
        dosage: "10 mg",
        frequencyPerDay: 0, // Invalid: must be > 0
        startDate: "2025-01-01",
        quantityReceived: 30,
        daysSupply: 30,
      };

      const request = new NextRequest("http://localhost:3000/api/medications", {
        method: "POST",
        body: JSON.stringify(invalidPayload),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("frequencyPerDay");
    });
  });

  describe("GET - List Medications", () => {
    it("should return array with computed fields", async () => {
      const response = await GET();
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);

      if (data.length > 0) {
        const med = data[0];
        // Base fields
        expect(med).toHaveProperty("id");
        expect(med).toHaveProperty("name");
        // Computed fields
        expect(med).toHaveProperty("remainingDoses");
        expect(med).toHaveProperty("daysLeft");
        expect(med).toHaveProperty("status");
        expect(med).toHaveProperty("adherence");
        // Status should be valid enum
        expect(["on_track", "running_low", "overdue"]).toContain(med.status);
      }
    });
  });

  describe("PUT - Update Medication", () => {
    it("should update medication successfully", async () => {
      // Create a medication first
      const createRequest = new NextRequest("http://localhost:3000/api/medications", {
        method: "POST",
        body: JSON.stringify({
          name: "Original Name",
          dosage: "10 mg",
          frequencyPerDay: 1,
          startDate: "2025-01-01",
          quantityReceived: 30,
          daysSupply: 30,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const createResponse = await POST(createRequest);
      const created = await createResponse.json();

      // Update it
      const updateRequest = new NextRequest("http://localhost:3000/api/medications", {
        method: "PUT",
        body: JSON.stringify({
          id: created.id,
          name: "Updated Name",
          dosage: "20 mg",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await PUT(updateRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Updated Name");
      expect(data.dosage).toBe("20 mg");
    });
  });

  describe("DELETE - Delete Medication", () => {
    it("should delete existing medication", async () => {
      // Create a medication first
      const createRequest = new NextRequest("http://localhost:3000/api/medications", {
        method: "POST",
        body: JSON.stringify({
          name: "To Delete",
          dosage: "10 mg",
          frequencyPerDay: 1,
          startDate: "2025-01-01",
          quantityReceived: 30,
          daysSupply: 30,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const createResponse = await POST(createRequest);
      const created = await createResponse.json();

      // Delete it
      const deleteRequest = new NextRequest(
        `http://localhost:3000/api/medications?id=${created.id}`,
        { method: "DELETE" }
      );

      const response = await DELETE(deleteRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should return 404 for non-existent medication", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/medications?id=med_nonexistent",
        { method: "DELETE" }
      );

      const response = await DELETE(request);
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH - Add Adherence Event", () => {
    it("should add adherence event with valid data", async () => {
      // Create a medication first
      const createRequest = new NextRequest("http://localhost:3000/api/medications", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Med",
          dosage: "10 mg",
          frequencyPerDay: 1,
          startDate: "2025-01-01",
          quantityReceived: 30,
          daysSupply: 30,
        }),
        headers: { "Content-Type": "application/json" },
      });
      const createResponse = await POST(createRequest);
      const created = await createResponse.json();

      // Add adherence event
      const patchRequest = new NextRequest("http://localhost:3000/api/medications", {
        method: "PATCH",
        body: JSON.stringify({
          medicationId: created.id,
          date: "2025-01-15",
          doses: 1,
          status: "taken",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await PATCH(patchRequest);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty("id");
      expect(data.status).toBe("taken");
    });

    it("should validate status enum", async () => {
      const request = new NextRequest("http://localhost:3000/api/medications", {
        method: "PATCH",
        body: JSON.stringify({
          medicationId: "med_123",
          date: "2025-01-15",
          doses: 1,
          status: "invalid", // Must be "taken" or "missed"
        }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await PATCH(request);
      expect(response.status).toBe(400);
    });
  });
});
