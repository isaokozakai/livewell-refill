"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import type {
  MedicationWithComputed,
  CreateMedicationInput,
} from "@/lib/types";

function statusLabel(s: MedicationWithComputed["status"]) {
  if (s === "on_track") return "On track";
  if (s === "running_low") return "Running low";
  return "Overdue";
}

function StatusBadge({ status }: { status: MedicationWithComputed["status"] }) {
  const statusClass =
    status === "on_track"
      ? styles.statusOnTrack
      : status === "running_low"
      ? styles.statusRunningLow
      : styles.statusOverdue;
  return (
    <span className={`${styles.statusBadge} ${statusClass}`}>
      {statusLabel(status)}
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const fillClass =
    clamped > 20 ? styles.progressFillGood : styles.progressFillLow;
  return (
    <div className={styles.progressBar}>
      <div
        className={`${styles.progressFill} ${fillClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default function Home() {
  const [meds, setMeds] = useState<MedicationWithComputed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ csv: boolean; pdf: boolean }>({
    csv: false,
    pdf: false,
  });

  const [form, setForm] = useState<CreateMedicationInput>({
    name: "",
    dosage: "",
    frequencyPerDay: 1,
    startDate: "",
    quantityReceived: 30,
    daysSupply: 30,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<
    { rxcui: string; name: string; score: number }[]
  >([]);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isSelectingFromDropdown = useRef(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/medications", { cache: "no-store" });
    if (!res.ok) {
      setError("Failed to load medications");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as MedicationWithComputed[];
    setMeds(data);
    try {
      localStorage.setItem("meds-cache", JSON.stringify(data));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    // Set non-deterministic default values on the client after mount to avoid SSR hydration mismatch
    setForm((f) => ({
      ...f,
      startDate: new Date().toISOString().slice(0, 10),
    }));
    try {
      const cached = localStorage.getItem("meds-cache");
      if (cached) setMeds(JSON.parse(cached));
    } catch {}
    load();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const go = async () => {
      // Skip search if we just selected from dropdown
      if (isSelectingFromDropdown.current) {
        isSelectingFromDropdown.current = false;
        return;
      }

      if (!form.name.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(form.name)}`,
          {
            signal: ctrl.signal,
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        setSearchResults(data);
      } catch (error) {
        // Ignore abort errors - they're expected when cancelling previous requests
        if (error instanceof Error && error.name === "AbortError") return;
        throw error;
      }
    };
    const t = setTimeout(go, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [form.name]);

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchResults([]);
      }
    }

    if (searchResults.length > 0) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [searchResults]);

  function validate(values: CreateMedicationInput) {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Required";
    if (!values.dosage.trim()) e.dosage = "Required";
    if (!values.startDate) e.startDate = "Required";
    if (values.frequencyPerDay <= 0) e.frequencyPerDay = "Must be > 0";
    if (values.quantityReceived <= 0) e.quantityReceived = "Must be > 0";
    if (values.daysSupply <= 0) e.daysSupply = "Must be > 0";
    return e;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    if (editingId) {
      // Update existing medication
      const res = await fetch("/api/medications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...form }),
      });
      if (!res.ok) {
        setError("Update failed");
        return;
      }
      setEditingId(null);
    } else {
      // Create new medication
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        setError("Create failed");
        return;
      }
    }

    setForm({ ...form, name: "", dosage: "" });
    await load();
  }

  function startEdit(med: MedicationWithComputed) {
    setEditingId(med.id);
    setForm({
      name: med.name,
      dosage: med.dosage,
      frequencyPerDay: med.frequencyPerDay,
      startDate: med.startDate,
      quantityReceived: med.quantityReceived,
      daysSupply: med.daysSupply,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({
      name: "",
      dosage: "",
      frequencyPerDay: 1,
      startDate: new Date().toISOString().slice(0, 10),
      quantityReceived: 30,
      daysSupply: 30,
    });
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/medications?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Failed to delete medication");
        return;
      }
      await load();
    } catch {
      setError("Network error: Failed to delete medication");
    }
  }

  async function markAdherence(id: string, status: "taken" | "missed") {
    try {
      const res = await fetch(`/api/medications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId: id,
          date: new Date().toISOString().slice(0, 10),
          doses: 1,
          status,
        }),
      });
      if (!res.ok) {
        setError("Failed to update adherence");
        return;
      }
      await load();
    } catch {
      setError("Network error: Failed to update adherence");
    }
  }

  async function exportCSV() {
    if (exporting.csv) return;
    setExporting((s) => ({ ...s, csv: true }));
    try {
      const res = await fetch(`/api/export/csv`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to export CSV");
        return;
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "refill-schedule.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error: Failed to export CSV");
    } finally {
      setExporting((s) => ({ ...s, csv: false }));
    }
  }

  async function exportPDF() {
    if (exporting.pdf) return;
    setExporting((s) => ({ ...s, pdf: true }));
    try {
      const res = await fetch(`/api/export/pdf`, { cache: "no-store" });
      if (!res.ok) {
        setError("Failed to export PDF");
        return;
      }
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "refill-schedule.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Network error: Failed to export PDF");
    } finally {
      setExporting((s) => ({ ...s, pdf: false }));
    }
  }

  const alerts = useMemo(
    () => meds.filter((m) => m.status !== "on_track"),
    [meds]
  );

  if (loading)
    return (
      <main className={styles.main}>
        <p>Loading...</p>
      </main>
    );
  if (error)
    return (
      <main className={styles.main}>
        <p>{error}</p>
      </main>
    );

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Prescription Refill Tracker</h1>

        {alerts.length > 0 && (
          <div className={styles.alert}>
            <p className={styles.alertTitle}>Refill alerts:</p>
            <ul className={styles.alertList}>
              {alerts.map((a, i) => (
                <li key={i} className={styles.alertItem}>
                  {a.name} is {statusLabel(a.status)} — next refill by{" "}
                  {a.nextRefillDate}
                </li>
              ))}
            </ul>
          </div>
        )}

        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>
            {editingId ? "Edit Medication" : "Add Medication"}
          </h2>
          <form onSubmit={submit} className={styles.formGrid}>
            <div className={styles.formField}>
              <label htmlFor="name" className={styles.formLabel}>
                Name
              </label>
              <div className={styles.inputWithIcon} ref={searchContainerRef}>
                <input
                  id="name"
                  autoComplete="off"
                  className={styles.formInput}
                  placeholder="Type to search medications..."
                  value={form.name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                {searchResults.length > 0 && (
                  <div className={styles.searchResults}>
                    {searchResults.map((r, i) => (
                      <div
                        key={i}
                        className={styles.searchResult}
                        onClick={() => {
                          isSelectingFromDropdown.current = true;
                          setForm((f) => ({ ...f, name: r.name }));
                          setSearchResults([]);
                        }}
                      >
                        {r.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {formErrors.name && (
                <small className={styles.formError}>{formErrors.name}</small>
              )}
            </div>
            <div className={styles.formField}>
              <label htmlFor="dosage" className={styles.formLabel}>
                Dosage
              </label>
              <input
                id="dosage"
                className={styles.formInput}
                value={form.dosage ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dosage: e.target.value }))
                }
              />
              {formErrors.dosage && (
                <small className={styles.formError}>{formErrors.dosage}</small>
              )}
            </div>
            <div className={styles.formField}>
              <label htmlFor="frequencyPerDay" className={styles.formLabel}>
                Frequency/day
              </label>
              <input
                id="frequencyPerDay"
                className={styles.formInput}
                type="number"
                min={1}
                value={form.frequencyPerDay ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    frequencyPerDay: Number(e.target.value),
                  }))
                }
              />
              {formErrors.frequencyPerDay && (
                <small className={styles.formError}>
                  {formErrors.frequencyPerDay}
                </small>
              )}
            </div>
            <div className={styles.formField}>
              <label htmlFor="startDate" className={styles.formLabel}>
                Start date
              </label>
              <input
                id="startDate"
                className={styles.formInput}
                type="date"
                value={form.startDate ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
              {formErrors.startDate && (
                <small className={styles.formError}>
                  {formErrors.startDate}
                </small>
              )}
            </div>
            <div className={styles.formField}>
              <label htmlFor="quantityReceived" className={styles.formLabel}>
                Quantity
              </label>
              <input
                id="quantityReceived"
                className={styles.formInput}
                type="number"
                min={1}
                value={form.quantityReceived}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    quantityReceived: Number(e.target.value),
                  }))
                }
              />
              {formErrors.quantityReceived && (
                <small className={styles.formError}>
                  {formErrors.quantityReceived}
                </small>
              )}
            </div>
            <div className={styles.formField}>
              <label htmlFor="daysSupply" className={styles.formLabel}>
                Days&#39; supply
              </label>
              <input
                id="daysSupply"
                className={styles.formInput}
                type="number"
                min={1}
                value={form.daysSupply ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, daysSupply: Number(e.target.value) }))
                }
              />
              {formErrors.daysSupply && (
                <small className={styles.formError}>
                  {formErrors.daysSupply}
                </small>
              )}
            </div>
            <button type="submit" className={styles.formButton}>
              {editingId ? "Update" : "Add"}
            </button>
            {editingId && (
              <button
                type="button"
                className={styles.formButton}
                onClick={cancelEdit}
              >
                Cancel
              </button>
            )}
          </form>
        </section>

        <section className={styles.medicationsSection}>
          <h2 className={styles.sectionTitle}>Medications</h2>
          <div className={styles.medicationsHeader}>
            <button
              type="button"
              className={styles.exportButton}
              onClick={exportCSV}
              disabled={exporting.csv}
            >
              {exporting.csv ? "Exporting CSV..." : "Export CSV"}
            </button>
            <button
              type="button"
              className={styles.exportButton}
              onClick={exportPDF}
              disabled={exporting.pdf}
            >
              {exporting.pdf ? "Exporting PDF..." : "Export PDF"}
            </button>
          </div>
          {meds.length === 0 && <p>No medications yet.</p>}
          <div className={styles.medicationsGrid}>
            {meds.map((m, i) => {
              const percentRemaining =
                (m.remainingDoses / m.quantityReceived) * 100;

              return (
                <div key={i} className={styles.medicationCard}>
                  <div className={styles.medicationHeader}>
                    <div>
                      <span className={styles.medicationTitle}>{m.name}</span>
                      <span className={styles.medicationDosage}>
                        {" "}
                        — {m.dosage}
                      </span>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className={styles.progressContainer}>
                    <ProgressBar percent={percentRemaining} />
                  </div>
                  <div className={styles.medicationStats}>
                    <div>
                      Remaining doses:{" "}
                      <span className={styles.statValue}>
                        {m.remainingDoses}
                      </span>
                    </div>
                    <div>
                      Days left:{" "}
                      <span className={styles.statValue}>{m.daysLeft}</span>
                    </div>
                    <div>
                      Next refill:{" "}
                      <span className={styles.statValue}>
                        {m.nextRefillDate}
                      </span>
                    </div>
                    <div>
                      Adherence:{" "}
                      <span className={styles.statValue}>
                        {m.adherence.adherencePercentage}%
                      </span>
                    </div>
                  </div>
                  <div className={styles.medicationActions}>
                    <button
                      className={styles.actionButton}
                      onClick={() => markAdherence(m.id, "taken")}
                    >
                      Mark taken
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={() => markAdherence(m.id, "missed")}
                    >
                      Mark missed
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={() => startEdit(m)}
                    >
                      Edit
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      onClick={() => remove(m.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
