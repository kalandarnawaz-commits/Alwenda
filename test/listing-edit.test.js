import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Regression coverage for "the Edit listing button does nothing real,
   and there's no way to add/remove photos on an already-published
   listing." Root cause: the Edit button set data-edit-listing-id but
   nothing read it, and submitListingForm() always called createListing,
   never an update. This adds updateListing()/deleteListingImage() to
   supabaseClient.js, a startEditListing() draft-seeding helper, a
   create-vs-update branch in submitListingForm(), and an existing-photos
   strip in the create/edit form. No new migration — RLS already grants
   owners update/delete on listings and listing_images.
--------------------------------------------------------------------- */

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} must exist`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    else if (source[i] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  assert.ok(paramsEnd !== -1, `could not find end of parameter list for ${name}`);
  let depth = 0;
  for (let i = paramsEnd; i < source.length; i += 1) {
    if (source[i] === "{") {
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${name}`);
}

test("updateListing scopes the update to the given id and reuses createListing's field shape", async () => {
  const client = await readRepoFile("src/services/auth/supabaseClient.js");
  const fn = extractFunction(client, "updateListing");
  assert.match(fn, /if \(!user\) throw new AuthNotConfiguredError\(\);/);
  assert.match(fn, /\.from\("listings"\)/);
  assert.match(fn, /\.update\(\{/);
  assert.match(fn, /\.eq\("id", id\)/);
  assert.match(fn, /category_id: categoryId \|\| null/);
  assert.match(fn, /price_amount: priceAmount \|\| null/);
  // Ownership is enforced by RLS ("Owners update listings"), not a
  // client-side owner_user_id filter — updateListing must never try to
  // set owner_user_id itself (that would let a caller reassign ownership).
  assert.doesNotMatch(fn, /owner_user_id:/);
});

test("deleteListingImage removes the storage object before deleting the row", async () => {
  const client = await readRepoFile("src/services/auth/supabaseClient.js");
  const fn = extractFunction(client, "deleteListingImage");
  assert.match(fn, /if \(!user\) throw new AuthNotConfiguredError\(\);/);
  const storageIndex = fn.indexOf('.storage.from("listing-photos").remove([storagePath])');
  const deleteIndex = fn.indexOf('.from("listing_images").delete().eq("id", id)');
  assert.ok(storageIndex !== -1, "must remove the storage object");
  assert.ok(deleteIndex !== -1, "must delete the listing_images row");
  assert.ok(storageIndex < deleteIndex, "storage cleanup must happen before the row delete");
});

test("main.js imports updateListing, fetchListingImages, and deleteListingImage from supabaseClient", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /\bupdateListing,/);
  assert.match(main, /\bfetchListingImages,/);
  assert.match(main, /\bdeleteListingImage,/);
});

test("startEditListing seeds listingDraft from the real myListings row, including editingListingId", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "startEditListing");
  assert.match(fn, /state\.myListings\.find\(\(listing\) => String\(listing\.id\) === String\(listingId\)\)/);
  assert.match(fn, /editingListingId: item\.id/);
  assert.match(fn, /existingPhotos: \[\]/);
  assert.match(fn, /await fetchListingImages\(item\.id\)/);
});

test("the generic [data-view] handler wires data-edit-listing-id to startEditListing", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "bindEvents");
  assert.match(fn, /button\.dataset\.view === "createListing" && button\.dataset\.editListingId/);
  assert.match(fn, /startEditListing\(button\.dataset\.editListingId\)/);
});

test("submitListingForm branches on editingListingId between updateListing and createListing", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "submitListingForm");
  assert.match(fn, /draft\.editingListingId\s*\n?\s*\? await updateListing\(\{ id: draft\.editingListingId, \.\.\.fields \}\)\s*\n?\s*: await createListing\(fields\)/);
  assert.match(fn, /applyUpdatedListing\(record, \[\.\.\.draft\.existingPhotos, \.\.\.uploadedImages\]\)/);
  assert.match(fn, /applyCreatedListing\(record\)/);
  // The reset at the end of every submit must clear edit-mode state, or a
  // later fresh "create" visit would silently re-enter update mode.
  assert.match(fn, /editingListingId: null,\s*\n\s*existingPhotos: \[\]/);
});

test("applyUpdatedListing merges into state.myListings and myListingsPool without a fabricated analytics event", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "applyUpdatedListing");
  assert.match(fn, /state\.myListings\.findIndex/);
  assert.match(fn, /myListingsPool\.findIndex/);
  // listing_updated isn't a declared analytics event — firing the
  // create-only listing_created event here would mislabel real data, so
  // this path intentionally tracks nothing rather than fabricate one.
  assert.doesNotMatch(fn, /trackEvent\(/);
});

test("renderCreateListingForm shows an edit-mode title/CTA and an existing-photos strip with a remove action", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "renderCreateListingForm");
  assert.match(fn, /const isEditing = Boolean\(draft\.editingListingId\)/);
  assert.match(fn, /t\("createListing\.editTitle"\)/);
  assert.match(fn, /t\("createListing\.editSubmitCta"\)/);
  assert.match(fn, /data-role="remove-existing-listing-photo" data-photo-id="\$\{photo\.id\}" data-storage-path="\$\{escapeHtml\(photo\.storage_path\)\}"/);
});

test("bindEvents wires remove-existing-listing-photo to deleteListingImage and updates the draft", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "bindEvents");
  assert.match(fn, /data-role="remove-existing-listing-photo"/);
  assert.match(fn, /await deleteListingImage\(\{ id: photoId, storagePath \}\)/);
  assert.match(fn, /state\.listingDraft\.existingPhotos = state\.listingDraft\.existingPhotos\.filter/);
});

test("renderMyListings (bottom-nav Profile) reuses renderUserProfileListingCard instead of the old plain text rows", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "renderMyListings");
  assert.match(fn, /renderUserProfileListingCard\(item, true\)/);
  assert.match(fn, /class="profile-listing-grid"/);
  assert.doesNotMatch(fn, /my-business-row/);
});

test("listingDraft's initial shape and reset-to-blank shape both carry editingListingId/existingPhotos", async () => {
  const main = await readRepoFile("src/main.js");
  const initialStart = main.indexOf("listingDraft: {");
  const initialBlock = main.slice(initialStart, main.indexOf("},", initialStart));
  assert.match(initialBlock, /editingListingId: null/);
  assert.match(initialBlock, /existingPhotos: \[\]/);
});
