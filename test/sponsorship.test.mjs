import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signedSponsorTotal, donationTotal, buildSummary, formatMoney,
} from "../src/sponsorship-model.js";

const lead = (status, value) => ({
  properties: { Status: { select: status ? { name: status } : null }, "Signed value": { number: value } },
});
const gift = (cycle, amount) => ({
  properties: { Cycle: { select: cycle ? { name: cycle } : null }, Amount: { number: amount } },
});

test("only Signed leads count, blank values count as zero", () => {
  const leads = [lead("Signed", 5000), lead("Signed", null), lead("Proposal sent", 20000), lead(null, 99)];
  assert.equal(signedSponsorTotal(leads), 5000);
});

test("only current-cycle donations count", () => {
  const rows = [gift("2027", 50), gift("2027", 25.5), gift("2026", 1000), gift(null, 7)];
  assert.equal(donationTotal(rows), 75.5);
});

test("archived rows are ignored", () => {
  assert.equal(signedSponsorTotal([{ ...lead("Signed", 10), archived: true }]), 0);
  assert.equal(donationTotal([{ ...gift("2027", 10), in_trash: true }]), 0);
});

test("summary adds the three parts", () => {
  const s = buildSummary({
    leads: [lead("Signed", 1000)],
    microtq: [gift("2027", 0.1)],
    breaking3: [gift("2027", 0.2)],
    now: new Date("2026-11-07T00:00:00Z"),
  });
  assert.deepEqual(s.parts, { sponsors: 1000, microtqDonations: 0.1, breaking3Donations: 0.2 });
  assert.equal(s.total, 1000.3);
  assert.equal(s.cycle, "2027");
});

test("empty inputs give zero, not NaN", () => {
  assert.equal(buildSummary({ leads: [], microtq: undefined, breaking3: null }).total, 0);
});

test("money formats as whole dollars", () => {
  assert.equal(formatMoney(75000), "$75,000");
  assert.equal(formatMoney(1234.56), "$1,235");
  assert.equal(formatMoney(null), "—");
});
