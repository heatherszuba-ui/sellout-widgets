/**
 * Sponsorship total — pure logic, no DOM, no network. Shared by
 * scripts/fetch-sponsorship.mjs and the widget; tested in
 * test/sponsorship.test.mjs.
 *
 * The total is:
 *   Signed value on every Sponsorship Lead Tracker row whose Status is Signed
 * + Amount on every micrOTQ Donations row whose Cycle is the current cycle
 * + Amount on every Breaking 3 Donations row whose Cycle is the current cycle
 */

export const CYCLE = "2027";

/** Number property value, or 0 when blank. */
export function numberOf(page, name) {
  const v = page?.properties?.[name]?.number;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Select property option name, or "" when blank. */
export function selectOf(page, name) {
  return page?.properties?.[name]?.select?.name ?? "";
}

/** Sum of Signed value across Signed leads. */
export function signedSponsorTotal(leads) {
  return (leads ?? [])
    .filter((p) => !p?.archived && !p?.in_trash && selectOf(p, "Status") === "Signed")
    .reduce((sum, p) => sum + numberOf(p, "Signed value"), 0);
}

/** Sum of Amount across donations in `cycle`. */
export function donationTotal(rows, cycle = CYCLE) {
  return (rows ?? [])
    .filter((p) => !p?.archived && !p?.in_trash && selectOf(p, "Cycle") === cycle)
    .reduce((sum, p) => sum + numberOf(p, "Amount"), 0);
}

/** The JSON the widget reads. Rounded to cents to avoid float noise. */
export function buildSummary({ leads, microtq, breaking3, cycle = CYCLE, now = new Date() }) {
  const cents = (n) => Math.round(n * 100) / 100;
  const sponsors = cents(signedSponsorTotal(leads));
  const microtqDonations = cents(donationTotal(microtq, cycle));
  const breaking3Donations = cents(donationTotal(breaking3, cycle));
  return {
    cycle,
    fetchedAt: now.toISOString(),
    total: cents(sponsors + microtqDonations + breaking3Donations),
    parts: { sponsors, microtqDonations, breaking3Donations },
  };
}

/** "$12,345" — whole dollars. */
export function formatMoney(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}
