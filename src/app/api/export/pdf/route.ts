import { NextResponse } from "next/server";
import { listAdherenceEvents, listMedications } from "@/lib/storage";
import { computeMedication } from "@/lib/calc";
import puppeteer from "puppeteer";

// Escape HTML to prevent XSS in PDF generation
function escapeHtml(unsafe: string | number): string {
  const str = String(unsafe);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET() {
  try {
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

    // Generate HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Prescription Refill Schedule</title>
        <style>
          @page { margin: 0.5in; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px;
            color: #333;
            line-height: 1.6;
          }
          h1 { 
            color: #2c3e50; 
            border-bottom: 3px solid #3498db; 
            padding-bottom: 10px; 
            margin-bottom: 30px;
            font-size: 28px;
          }
          .header-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 4px solid #3498db;
          }
          .medication { 
            margin-bottom: 25px; 
            padding: 20px; 
            border: 1px solid #e1e5e9; 
            border-radius: 8px; 
            background: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            /* Prevent splitting a medication card across pages */
            break-inside: avoid;
            page-break-inside: avoid;
            -webkit-column-break-inside: avoid;
            -moz-column-break-inside: avoid;
          }
          .medication h3 { 
            margin: 0 0 15px 0; 
            color: #2c3e50; 
            font-size: 18px;
            border-bottom: 1px solid #ecf0f1;
            padding-bottom: 8px;
          }
          .medication p { 
            margin: 8px 0; 
            font-size: 14px;
          }
          .medication-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
          }
          .status { 
            font-weight: bold; 
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            text-transform: uppercase;
          }
          .status.on_track { 
            background: #d4edda; 
            color: #155724; 
          }
          .status.running_low { 
            background: #fff3cd; 
            color: #856404; 
          }
          .status.overdue { 
            background: #f8d7da; 
            color: #721c24; 
          }
          .footer { 
            margin-top: 40px; 
            text-align: center; 
            color: #6c757d; 
            font-size: 12px; 
            border-top: 1px solid #e9ecef;
            padding-top: 20px;
          }
          .no-medications {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 40px;
          }
        </style>
      </head>
      <body>
        <h1>Prescription Refill Schedule</h1>
        
        <div class="header-info">
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString(
            "en-US",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }
          )}</p>
          <p><strong>Total Medications:</strong> ${rows.length}</p>
        </div>
        
        ${
          rows.length === 0
            ? `
          <div class="no-medications">
            <p>No medications found. Add some medications to generate a report.</p>
          </div>
        `
            : rows
                .map(
                  (r) => `
          <div class="medication">
            <h3>${escapeHtml(r.name)} — ${escapeHtml(r.dosage)}</h3>
            <div class="medication-grid">
              <div>
                <p><strong>Remaining doses:</strong> ${r.remainingDoses}</p>
                <p><strong>Days left:</strong> ${r.daysLeft}</p>
                <p><strong>Next refill:</strong> ${r.nextRefillDate}</p>
              </div>
              <div>
                <p><strong>Status:</strong> <span class="status ${
                  r.status
                }">${escapeHtml(r.status.replace("_", " "))}</span></p>
                <p><strong>Adherence:</strong> ${
                  r.adherence.adherencePercentage
                }%</p>
                <p><strong>Frequency:</strong> ${r.frequencyPerDay} per day</p>
              </div>
            </div>
          </div>
        `
                )
                .join("")
        }
        
        <div class="footer">
          <p>This report was generated by LiveWell Refill Tracker</p>
          <p>Keep track of your medications and never miss a refill</p>
        </div>
      </body>
      </html>
    `;

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
      });

      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=refill-schedule.pdf",
          "Content-Length": pdf.length.toString(),
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("PDF generation error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to generate PDF" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
