import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the fake in-app booking-confirmation flow is fully removed from the Hire/Need-Help domain", async () => {
  const main = await readRepoFile("src/main.js");
  assert.doesNotMatch(main, /function renderBookingSheet/);
  assert.doesNotMatch(main, /function submitBooking/);
  assert.doesNotMatch(main, /function resetBookingDraft/);
  assert.doesNotMatch(main, /bookingDraft/);
  assert.doesNotMatch(main, /bookingConfirmed/);
  assert.doesNotMatch(main, /activeSheet === "booking"/);
  assert.doesNotMatch(main, /status: "Confirmed"/, "no code path may fabricate a confirmed booking status");
});

test("the Hire public-profile Book button opens a real conversation instead of a fake confirmation sheet", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /data-person-action="request-booking"/);
  assert.doesNotMatch(main, /data-person-action="book"/, "the old fake-booking action name must not remain anywhere");

  const handlerStart = main.indexOf('querySelector(\'[data-person-action="request-booking"]\')');
  assert.ok(handlerStart > -1, "expected a querySelector click handler bound to the request-booking action");
  const handlerSection = main.slice(handlerStart);
  const handlerBody = handlerSection.slice(0, handlerSection.indexOf("});") + 3);
  assert.match(handlerBody, /startProfessionalConversation\(/, "clicking Book must route through the same honest, message-based flow as the pro cards");
});

test("common.bookPay no longer implies Alwenda handles in-app payment", async () => {
  const main = await readRepoFile("src/main.js");
  assert.doesNotMatch(main, /common\.bookPay/);
  assert.match(main, /common\.chatAndArrange/);

  for (const locale of ["en", "lt", "de"]) {
    const json = JSON.parse(await readRepoFile(`locales/${locale}.json`));
    assert.equal(json.common.bookPay, undefined, `locales/${locale}.json must not keep the old bookPay key`);
    assert.ok(json.common.chatAndArrange, `locales/${locale}.json must define common.chatAndArrange`);
    assert.doesNotMatch(json.common.chatAndArrange.toLowerCase(), /\bpay securely\b|\btrack\b/, `locales/${locale}.json chatAndArrange must not imply Alwenda processes payment`);
  }
});

test("the dead booking.* locale namespace (bookingSheetTitle, confirmBooking, etc.) is fully removed, not just unused", async () => {
  for (const locale of ["en", "lt", "de"]) {
    const json = JSON.parse(await readRepoFile(`locales/${locale}.json`));
    assert.equal(json.booking, undefined, `locales/${locale}.json must not keep the dead booking namespace`);
  }
});

test("the transaction-safety notice (already present) and the Need Help 3-step explainer no longer contradict each other", async () => {
  const main = await readRepoFile("src/main.js");
  const enLocale = JSON.parse(await readRepoFile("locales/en.json"));
  assert.match(enLocale.common.transactionSafetyBody, /does not collect transaction payments/);
  assert.match(main, /renderTransactionSafetyNotice\(\)/);
  // Need Help renders the safety notice on the same page as the 3-step explainer.
  const needHelpFn = main.slice(main.indexOf("function renderNeedHelp()"));
  const needHelpBody = needHelpFn.slice(0, needHelpFn.indexOf("\nfunction "));
  assert.match(needHelpBody, /renderTransactionSafetyNotice\(\)/);
  assert.match(needHelpBody, /common\.chatAndArrange/);
});

test("the out-of-scope Hotels/Food & Drink reservations flow (common.bookNow, renderReservations) is untouched", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /t\("common\.bookNow"\)/, "Hotels/Food & Drink reservations button must still exist — only the Hire fake-confirm flow was in scope");
  assert.match(main, /function renderReservations/);
  const enLocale = JSON.parse(await readRepoFile("locales/en.json"));
  assert.equal(enLocale.common.bookNow, "Book now");
});

test("Marketplace listing detail/card (Rentals, Property included) offer contact actions only — no booking or price-setting language", async () => {
  const main = await readRepoFile("src/main.js");
  const listingDetailFn = main.slice(main.indexOf("function renderListingDetail()"));
  const listingDetailBody = listingDetailFn.slice(0, listingDetailFn.indexOf("\nfunction "));
  assert.doesNotMatch(listingDetailBody, /confirmBooking|bookNow|data-role="confirm-booking"/i);
  assert.match(listingDetailBody, /common\.message|common\.call|common\.favourite|common\.share/);
});
