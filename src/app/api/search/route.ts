import { NextRequest, NextResponse } from "next/server";
import { RxApproximateCandidate } from "@/lib/types";

// Simple proxy to RxNorm approximate term API
// Docs: https://rxnav.nlm.nih.gov/REST/approximateTerm.html
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 });
  const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(
    q
  )}&maxEntries=10`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok)
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  const data = await resp.json();
  // Normalize a compact list of suggestions
  const candidates = (data?.approximateGroup?.candidate || []).map(
    (c: RxApproximateCandidate) => ({
      rxcui: c.rxcui,
      name: c.name,
      score: Number(c.score),
    })
  );
  return NextResponse.json(candidates);
}
