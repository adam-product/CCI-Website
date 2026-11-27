import assert from "node:assert/strict";
const base = process.env.CCI_TEST_URL || "http://127.0.0.1:5173";
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(base))
  throw Error("These mutation tests are restricted to local development.");
const auth = await fetch(base + "/api/staff/unlock", {
  method: "POST",
  headers: { Origin: base, "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.CCI_TEST_LOGIN_EMAIL,
    password: process.env.CCI_TEST_LOGIN_PASSWORD,
  }),
});
assert.equal(auth.status, 200, "Local staff sign-in failed");
const cookie = auth.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
assert(cookie, "Local sign-in cookie missing");
async function call(
  path,
  { method = "GET", body, anonymous = false, origin = base } = {},
) {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      Origin: origin,
      ...(!anonymous ? { Cookie: cookie } : {}),
      ...(!(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: text };
  }
  return { status: r.status, data };
}
const get = async (id) => (await call("content")).data.find((r) => r.id === id);
const save = async (content, version) => {
  const r = await call("content", {
    method: "POST",
    body: { content, version },
  });
  assert.equal(r.status, 200, JSON.stringify(r));
};
const publish = async (id, unpublish = false) => {
  const row = await get(id);
  const r = await call("publish", {
    method: "POST",
    body: { id, version: row.version, unpublish },
  });
  assert.equal(r.status, 200, JSON.stringify(r));
};
let checks = 0;
const ok = (name) => {
  checks++;
  console.log("PASS " + name);
};
for (const path of [
  "content",
  "enquiries",
  "enquiries/count",
  "media",
  "staff",
  "audit",
])
  assert.equal((await call(path, { anonymous: true })).status, 401);
ok("Anonymous requests cannot access CMS, staff, media, audit or enquiries");
assert.equal((await call("session")).data.role, "super");
ok("Local staff sign-in resolves to authorized administrator");
const original = await get("home");
const settings = await get("site");
let upload;
try {
  const draft = structuredClone(original.draft);
  draft.title.en = "Draft verification — not public";
  draft.sections.push({
    id: "private-check",
    heading: { en: "Secret hidden section", my: "" },
    body: { en: "Must not reach public API", my: "" },
    image: "",
    cta: { en: "", my: "" },
    href: "",
    visible: false,
    order: 100,
  });
  await save(draft, original.version);
  assert.equal(
    (await call("public")).data.find((c) => c.id === "home").title.en,
    original.published.title.en,
  );
  ok("Saving a draft persists without changing public content");
  assert.equal(
    (
      await call("content", {
        method: "POST",
        body: { content: draft, version: original.version },
      })
    ).status,
    409,
  );
  ok("Stale content versions are rejected");
  await publish("home");
  const live = (await call("public")).data.find((c) => c.id === "home");
  assert.equal(live.title.en, draft.title.en);
  assert(!live.sections.some((s) => s.id === "private-check"));
  ok("Publishing updates public content and redacts hidden sections");
  const direct = await get("home");
  const content = {
    ...direct.draft,
    title: { ...direct.draft.title, en: "CCI direct publication check" },
  };
  const directPublish = await call("publish", {
    method: "POST",
    body: { id: direct.id, version: direct.version, content },
  });
  assert.equal(directPublish.status, 200, JSON.stringify(directPublish));
  assert.equal((await get("home")).draft.title.en, content.title.en);
  const liveHtml = await fetch(base + "/en");
  assert((await liveHtml.text()).includes(content.title.en));
  assert.match(liveHtml.headers.get("Cache-Control") || "", /no-store/);
  assert.equal(
    (
      await call("publish", {
        method: "POST",
        body: { id: direct.id, version: direct.version, content },
      })
    ).status,
    409,
  );
  ok(
    "Save and publish updates the next public page request and rejects stale writes",
  );

  assert.equal(
    (
      await call("content", {
        method: "POST",
        origin: "https://untrusted.test",
        body: { content: draft, version: (await get("home")).version },
      })
    ).status,
    403,
  );
  ok("Cross-origin content mutations are blocked");
  const invalid = { ...draft, url: "javascript:alert(1)" };
  assert.equal(
    (
      await call("content", {
        method: "POST",
        body: { content: invalid, version: (await get("home")).version },
      })
    ).status,
    400,
  );
  ok("Unsafe links are rejected");
  const form = new FormData();
  form.set(
    "file",
    new File(['<svg onload="alert(1)"/>'], "attack.svg", {
      type: "image/svg+xml",
    }),
  );
  form.set("alt", "Invalid image");
  assert.equal(
    (await call("media", { method: "POST", body: form })).status,
    400,
  );
  ok("Executable SVG uploads are rejected");
  const valid = new FormData();
  valid.set(
    "file",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "test.png",
      { type: "image/png" },
    ),
  );
  valid.set("alt", "Local QA pixel");
  const media = await call("media", { method: "POST", body: valid });
  assert.equal(media.status, 201, JSON.stringify(media));
  upload = media.data.id;
  const withImage = {
    ...draft,
    image: "/api/media-file/" + upload,
    alt: "Local QA pixel",
  };
  await save(withImage, (await get("home")).version);
  assert.equal(
    (await call("media", { method: "DELETE", body: { id: upload } })).status,
    409,
  );
  ok("Valid images persist; content references prevent image deletion");
  const cardRecord = await get("way-way-shaung");
  const cardImage = "/api/media-file/" + upload;
  const cardAlt = "Local initiative card artwork";
  try {
    await save(
      { ...cardRecord.draft, featured: true, cardImage, cardAlt },
      cardRecord.version,
    );
    assert.equal((await fetch(base + cardImage)).status, 401);
    assert(
      !(await (await fetch(base + "/en/initiatives")).text()).includes(
        `src="${cardImage}"`,
      ),
    );
    await publish(cardRecord.id);
    assert.equal((await fetch(base + cardImage)).status, 200);
    for (const path of ["/en", "/en/initiatives"]) {
      const html = await (await fetch(base + path)).text();
      assert(
        html.includes(`src="${cardImage}"`),
        `${path} did not render the uploaded card image`,
      );
      assert(html.includes(`alt="${cardAlt}"`));
    }
    ok(
      "Published card images reach both galleries while draft images stay private",
    );
  } finally {
    await save(cardRecord.published, (await get(cardRecord.id)).version);
    await publish(cardRecord.id);
    if (
      JSON.stringify(cardRecord.published) !== JSON.stringify(cardRecord.draft)
    )
      await save(cardRecord.draft, (await get(cardRecord.id)).version);
  }
  const privacy = {
    ...settings.draft,
    privacyApproved: true,
    contactFormTitle: { en: "CCI enquiry heading check", my: "" },
    contactConfirmation: { en: "CCI enquiry confirmation check", my: "" },
  };
  await save(privacy, settings.version);
  await publish("site");
  assert.equal(
    (
      await call("contact", {
        method: "POST",
        anonymous: true,
        body: {
          name: "QA",
          email: "invalid",
          subject: "QA",
          message: "Test",
          consent: true,
        },
      })
    ).status,
    400,
  );
  ok("Contact submission validates email");
  const contactPage = await (await fetch(base + "/en/contact")).text();
  assert(contactPage.includes("CCI enquiry heading check"));
  const startingCount = (await call("enquiries/count")).data.count;
  const invalidType = await call("contact", {
    method: "POST",
    anonymous: true,
    body: { name: "Local QA", email: "qa@example.test", enquiryType: "unlisted", message: "Test only", consent: true },
  });
  assert.equal(invalidType.status, 400);
  const enquiry = await call("contact", {
    method: "POST",
    anonymous: true,
    body: {
      name: "Local QA",
      email: "qa@example.test",
      enquiryType: "partnership",
      organisation: " Example Civic Group ",
      location: " Thailand ",
      message: "Test-only enquiry; not a real visitor.",
      consent: true,
      website: "",
    },
  });
  assert.equal(enquiry.status, 201, JSON.stringify(enquiry));
  assert.equal(enquiry.data.message, "CCI enquiry confirmation check");
  assert.equal((await call("enquiries/count")).data.count, startingCount + 1);
  const recorded = (await call("enquiries")).data.find((e) => e.id === enquiry.data.id);
  assert.equal(recorded.subject, "Organizational Partnership");
  assert.equal(recorded.enquiry_type, "partnership");
  assert.equal(recorded.organisation, "Example Civic Group");
  assert.equal(recorded.location, "Thailand");
  ok("Validated contact enquiries persist in the protected inbox");
  assert.equal(
    (
      await call("enquiries", {
        method: "POST",
        body: {
          id: enquiry.data.id,
          status: "Closed",
          notes: "Local integration test completed.",
        },
      })
    ).status,
    200,
  );
  ok("Authorized staff can update enquiry status and internal notes");
  assert.equal((await call("enquiries/count")).data.count, startingCount);
  ok("The new enquiry count updates and published contact messages are used");
  assert(
    (await call("audit")).data.some(
      (a) => a.target === "home" && a.action === "Publish",
    ),
  );
  ok("Administrative actions are recorded in audit history");
} finally {
  await save(original.draft, (await get("home")).version);
  await publish("home");
  await save(settings.draft, (await get("site")).version);
  await publish("site");
  if (upload) await call("media", { method: "DELETE", body: { id: upload } });
}
for (const path of [
  "/en",
  "/en/about",
  "/en/initiatives",
  "/en/initiatives/way-way-shaung",
  "/en/initiatives/cyber-lotus",
  "/en/impact",
  "/en/contact",
  "/en/privacy",
  "/my",
  "/my/contact",
  "/admin",
  "/robots.txt",
  "/sitemap.xml",
]) {
  const r = await fetch(base + path);
  assert.equal(r.status, 200, path);
  assert(!(await r.text()).includes("Internal Server Error"), path);
}
ok("All public, localized, admin and SEO routes load");
const intakeSettings = await get("site");
try {
  await save(
    { ...intakeSettings.draft, privacyApproved: false },
    intakeSettings.version,
  );
  await publish("site");
  assert.equal(
    (await call("contact", { method: "POST", anonymous: true, body: {} }))
      .status,
    409,
  );
  ok("Pausing enquiry intake closes the visitor form");
} finally {
  await save(intakeSettings.published, (await get("site")).version);
  await publish("site");
  if (
    JSON.stringify(intakeSettings.draft) !==
    JSON.stringify(intakeSettings.published)
  )
    await save(intakeSettings.draft, (await get("site")).version);
}
const initiative = await get("way-way-shaung");
assert(initiative.published, "Expected a published initiative fixture");
const changeInitiativeStatus = (row, status) =>
  call("publish", {
    method: "POST",
    body: { id: row.id, version: row.version, status },
  });
try {
  await save(
    {
      ...initiative.draft,
      title: {
        ...initiative.draft.title,
        en: "CCI private initiative status test",
      },
    },
    initiative.version,
  );
  const row = await get(initiative.id);
  assert.equal((await changeInitiativeStatus(row, "Active")).status, 200);
  const active = await get(row.id);
  assert.equal(active.published.status, "Active");
  assert.deepEqual(active.published.title, initiative.published.title);
  assert.equal(active.draft.title.en, "CCI private initiative status test");
  const publicHtml = await (
    await fetch(base + "/en/initiatives/" + row.id)
  ).text();
  assert.match(publicHtml, /data-active="true">Active/);
  assert(!publicHtml.includes("CCI private initiative status test"));
  assert.equal((await changeInitiativeStatus(row, "Coming Soon")).status, 409);
  assert.equal(
    (await changeInitiativeStatus(active, "Coming Soon")).status,
    200,
  );
  assert.match(
    await (await fetch(base + "/en/initiatives/" + row.id)).text(),
    /data-active="false">Coming Soon/,
  );
  ok(
    "Inline status updates reach the public page and leave unrelated edits private",
  );
} finally {
  await save(initiative.published, (await get(initiative.id)).version);
  await publish(initiative.id);
  if (JSON.stringify(initiative.draft) !== JSON.stringify(initiative.published))
    await save(initiative.draft, (await get(initiative.id)).version);
}
const staffTest = {
  name: "Local QA",
  email: "contact-test@example.com",
  subject: "Contact test mode",
  message: "Synthetic data for staff inbox verification.",
  consent: true,
};
assert.equal(
  (
    await call("contact-test", {
      method: "POST",
      body: staffTest,
      anonymous: true,
    })
  ).status,
  401,
);
const testSubmission = await call("contact-test", {
  method: "POST",
  body: staffTest,
});
assert.equal(testSubmission.status, 201, JSON.stringify(testSubmission));
const inboxTest = (await call("enquiries")).data.find(
  (entry) => entry.id === testSubmission.data.id,
);
assert.equal(inboxTest.subject, "[TEST] Contact test mode");
assert.equal(inboxTest.enquiry_type, null);
assert.equal(inboxTest.organisation, null);
assert.equal(
  (
    await call("enquiries", {
      method: "POST",
      body: { id: inboxTest.id, status: "Closed", notes: "Test reviewed." },
    })
  ).status,
  200,
);
ok("Staff can submit and review a tagged test enquiry");
console.log(`${checks} integration checks passed. Original content restored.`);
