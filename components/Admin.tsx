"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { ChoiceField } from "./ChoiceField";
import { Switch } from "./ui/switch";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import {
  ArrowUpRight,
  LayoutDashboard,
  FileText,
  Layers,
  Image as ImageIcon,
  BarChart3,
  Inbox,
  Settings,
  Users,
  History,
  Plus,
  Search,
  Check,
  X,
  Save,
  Eye,
  Pencil,
  Upload,
  Trash2,
  LogOut,
  LockKeyhole,
  Menu,
} from "lucide-react";
import {
  socialChannels,
  type Content,
  type Section,
  type SocialChannel,
} from "../lib/content";
type Row = {
  id: string;
  kind: string;
  draft: Content;
  published: Content | null;
  version: number;
  updated_at: string;
};
const tabs = [
  ["Overview", LayoutDashboard, "read"],
  ["Pages", FileText, "read"],
  ["Our Initiatives", Layers, "read"],
  ["Impact", BarChart3, "read"],
  ["Media Library", ImageIcon, "media"],
  ["Enquiries", Inbox, "enquiries"],
  ["Settings", Settings, "settings"],
  ["Staff Access", Users, "users"],
  ["Audit Log", History, "audit"],
] as const;
const staffRoles = {
  editor: "Content Editor",
  publisher: "Publisher / Reviewer",
  enquiry: "Enquiry Manager",
  super: "Super Administrator",
};
const api = async (path: string, method = "GET", body?: any): Promise<any> => {
  const r = await fetch("/api/" + path, {
    method,
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  const data: any = await r.json();
  if (!r.ok) throw Error(data.error || "Request failed.");
  return data;
};
function notifyPublication() {
  if (!("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel("cci-publication");
  channel.postMessage("changed");
  channel.close();
}
export default function Admin() {
  const [session, setSession] = useState<any>(undefined);
  const [tab, setTab] = useState("Overview");
  const [rows, setRows] = useState<Row[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [newEnquiries, setNewEnquiries] = useState<number | null>(null);
  const [expandedEnquiries, setExpandedEnquiries] = useState<Set<string>>(
    () => new Set(),
  );
  const [edit, setEdit] = useState<Content | null>(null);
  const cardPhotoInput = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(0);
  const [language, setLanguage] = useState<"en" | "my">("en");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [staffActive, setStaffActive] = useState(true);
  const [staffIssuePassword, setStaffIssuePassword] = useState(false);
  const [choosingPassword, setChoosingPassword] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<{ action: string; row: Row } | null>(
    null,
  );
  const can = (p: string) => session?.permissions?.includes(p);
  async function refresh() {
    const updated: Row[] = can("read") ? await api("content") : [];
    if (can("read")) setRows(updated);
    if (
      ["Media Library", "Enquiries", "Staff Access", "Audit Log"].includes(tab)
    )
      setItems(
        await api(
          {
            "Media Library": "media",
            Enquiries: "enquiries",
            "Staff Access": "staff",
            "Audit Log": "audit",
          }[tab]!,
        ),
      );
    return updated;
  }
  const refreshEnquiryCount = () =>
    api("enquiries/count")
      .then((data) => setNewEnquiries(data.count))
      .catch(() => {});
  useEffect(() => {
    api("session")
      .then((s) => {
        setSession(s);
        const requestedInbox =
          new URLSearchParams(window.location.search).get("tab") ===
          "enquiries";
        if (
          s?.role === "enquiry" ||
          (requestedInbox && s?.permissions?.includes("enquiries"))
        )
          setTab("Enquiries");
      })
      .catch((e) => {
        setSession(null);
        setError(e.message);
      });
  }, []);
  useEffect(() => {
    let cancelled = false;
    setEdit(null);
    setQuery("");
    setMenu(false);
    if (session?.role && session.role !== "none") {
      refresh()
        .then((updated) => {
          const site = updated.find((row) => row.id === "site");
          if (!cancelled && tab === "Settings" && site) open(site);
        })
        .catch((error) => {
          if (!cancelled) setError(error.message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [session, tab]);
  useEffect(() => {
    if (!can("enquiries")) return;
    const updateCount = () => {
      if (document.visibilityState === "visible") void refreshEnquiryCount();
    };
    updateCount();
    window.addEventListener("focus", updateCount);
    const interval = window.setInterval(updateCount, 30000);
    return () => {
      window.removeEventListener("focus", updateCount);
      window.clearInterval(interval);
    };
  }, [session]);
  useEffect(() => {
    if (tab !== "Enquiries" || !can("enquiries")) return;
    const refreshInbox = () => {
      api("enquiries")
        .then(setItems)
        .catch((e) => setError(e.message));
    };
    window.addEventListener("focus", refreshInbox);
    return () => window.removeEventListener("focus", refreshInbox);
  }, [session, tab]);
  async function run(fn: () => Promise<any>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      const updated = await refresh();
      const site = updated.find((row) => row.id === "site");
      if (tab === "Settings" && site) open(site);
      if (can("enquiries")) void refreshEnquiryCount();
      setMessage(success);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function unlockPortal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = form.get("newPassword");
    setError("");
    if (choosingPassword && newPassword !== form.get("confirmPassword")) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await api("staff/unlock", "POST", {
        email: form.get("email"),
        password: form.get("password"),
        ...(choosingPassword ? { newPassword } : {}),
      });
      if (result.setupRequired) {
        setChoosingPassword(true);
      } else {
        const authorized = await api("session");
        if (!authorized?.role)
          throw new Error("The portal could not open. Try signing in again.");
        setChoosingPassword(false);
        setSession(authorized);
        if (authorized.role === "enquiry") setTab("Enquiries");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function lockPortal() {
    setBusy(true);
    try {
      await api("staff/lock", "POST");
      setEdit(null);
      setRows([]);
      setItems([]);
      setIssuedPassword(null);
      setError("");
      setChoosingPassword(false);
      setNewEnquiries(null);
      setTab("Overview");
      setSession(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign out.");
    } finally {
      setBusy(false);
    }
  }
  function saveAccess(
    email: string,
    role: string | undefined,
    active: boolean | undefined,
    issuePassword = false,
  ) {
    if (
      issuePassword &&
      items.some(
        (row) => row.email === email.trim().toLowerCase() && row.has_password,
      ) &&
      !window.confirm(
        "Replace this staff member’s portal password and revoke their current portal session?",
      )
    )
      return;
    void run(
      async () => {
        const result = await api("staff", "POST", {
          email,
          role,
          active,
          issuePassword,
        });
        if (result.temporaryPassword) setIssuedPassword(result);
      },
      issuePassword ? "Temporary password issued." : "Staff access updated.",
    );
  }
  function updateInitiativeStatus(row: Row, status: string) {
    void run(
      async () => {
        await api("publish", "POST", {
          id: row.id,
          version: row.version,
          status,
        });
        if (row.published) notifyPublication();
      },
      row.published
        ? "Initiative status updated on the website."
        : "Initiative status saved to the draft.",
    );
  }
  const open = (row: Row) => {
    setEdit(structuredClone(row.draft));
    setVersion(row.version);
    setMessage("");
    setError("");
  };
  function create(kind: Content["kind"]) {
    setVersion(0);
    setEdit({
      id: "",
      kind,
      title: { en: "", my: "" },
      description: { en: "", my: "" },
      image: "",
      alt: "",
      url: "",
      status: "Coming Soon",
      featured: false,
      order: rows.filter((r) => r.kind === kind).length,
      sections: [],
      ...(kind === "impact" ? { value: "", source: "", period: "" } : {}),
    });
  }
  async function save() {
    if (!edit) return;
    await run(async () => {
      await api("content", "POST", { content: edit, version });
      const updated = await api("content");
      setRows(updated);
      const row = updated.find((r: Row) => r.id === edit.id);
      setVersion(row.version);
      setEdit(structuredClone(row.draft));
    }, "Draft saved. Your public website has not changed.");
  }
  function uploadCardImage() {
    if (edit?.kind !== "initiative") return;
    const input = cardPhotoInput.current;
    const file = input?.files?.[0];
    const alt = edit.cardAlt?.trim();
    if (!file || !alt) {
      setMessage("");
      setError("Choose a card image and enter its alternative text.");
      return;
    }
    const id = edit.id;
    const form = new FormData();
    form.set("file", file);
    form.set("alt", alt);
    void run(async () => {
      const { id: assetId } = await api("media", "POST", form);
      setEdit((current) =>
        current?.kind === "initiative" && current.id === id
          ? {
              ...current,
              cardImage: `/api/media-file/${assetId}`,
              cardAlt: alt,
            }
          : current,
      );
      if (input && input === cardPhotoInput.current) input.value = "";
    }, "Card image attached. Save the draft and publish to update the website.");
  }
  const textField = (label: string, key: "title" | "description") =>
    edit && (
      <label>
        {label} <small>{language === "en" ? "English" : "Myanmar"}</small>
        {key === "description" ? (
          <Textarea
            rows={4}
            value={edit[key][language]}
            onChange={(e) =>
              setEdit({
                ...edit,
                [key]: { ...edit[key], [language]: e.target.value },
              })
            }
          />
        ) : (
          <Input
            required
            value={edit[key][language]}
            onChange={(e) =>
              setEdit({
                ...edit,
                [key]: { ...edit[key], [language]: e.target.value },
              })
            }
          />
        )}
      </label>
    );
  const field = (label: string, key: keyof Content, type = "text") =>
    edit && (
      <label>
        {label}
        <Input
          type={type}
          value={String(edit[key] ?? "")}
          onChange={(e) =>
            setEdit({
              ...edit,
              [key]:
                type === "number" ? Number(e.target.value) : e.target.value,
            })
          }
        />
      </label>
    );
  if (session === undefined)
    return (
      <div className="admin-login">
        <span className="eyebrow">CCI ADMINISTRATION</span>
        <h1>Opening your workspace…</h1>
        {error && <p className="error">{error}</p>}
      </div>
    );
  if (!session || session.role === "none")
    return (
      <div className="admin-login">
        <a href="/en" className="brand">
          <img src="/brand/cci-logo.webp" alt="Click Cross Initiative" />
        </a>
        <div>
          <span className="eyebrow">CCI STAFF PORTAL</span>
          <h1>
            {choosingPassword
              ? "Set your portal password."
              : "Sign in to the staff portal."}
          </h1>
          <p>Use your CCI staff email and portal password.</p>
          <form className="staff-unlock" onSubmit={unlockPortal}>
            <label>
              Email address
              <Input
                name="email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
              />
            </label>
            <label>
              {choosingPassword
                ? "Temporary portal password"
                : "Portal password"}
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={256}
                required
              />
            </label>
            {choosingPassword && (
              <>
                <p>Use a unique password of at least 15 characters.</p>
                <label>
                  New password
                  <Input
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={15}
                    maxLength={256}
                    required
                  />
                </label>
                <label>
                  Confirm new password
                  <Input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={15}
                    maxLength={256}
                    required
                  />
                </label>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button navy" disabled={busy}>
              {choosingPassword ? "Set password and sign in" : "Sign in"}
              <LockKeyhole size={16} aria-hidden="true" />
            </button>
          </form>
          <small>For password help, contact a CCI Super Administrator.</small>
        </div>
        <a className="text-link" href="/en">
          Return to the website <ArrowUpRight size={16} />
        </a>
      </div>
    );
  const current = rows.find((r) => r.id === edit?.id);
  const dirty = !!(
    edit &&
    current &&
    JSON.stringify(edit) !== JSON.stringify(current.draft)
  );
  const kind =
    tab === "Pages"
      ? "page"
      : tab === "Our Initiatives"
        ? "initiative"
        : tab === "Impact"
          ? "impact"
          : "settings";
  const list = rows.filter(
    (r) =>
      r.kind === kind &&
      r.draft.title.en.toLowerCase().includes(query.toLowerCase()),
  );
  const enquiries =
    tab === "Enquiries"
      ? items.filter((item) => typeof item.message === "string")
      : [];
  const matchingEnquiries = enquiries.filter((item) =>
    `${item.name} ${item.email} ${item.subject}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="admin-shell">
      <aside className={menu ? "admin-sidebar open" : "admin-sidebar"}>
        <a className="brand" href="/en">
          <img src="/brand/cci-logo.webp" alt="Click Cross Initiative" />
        </a>
        <span className="sidebar-label">WEBSITE WORKSPACE</span>
        <nav>
          {tabs
            .filter((t) => can(t[2]))
            .map(([title, Icon]) => (
              <button
                className={title === tab ? "selected" : ""}
                key={title}
                onClick={() => setTab(title)}
              >
                <Icon size={18} />
                {title}
                {title === "Enquiries" && newEnquiries !== null && (
                  <span
                    className="enquiries-count"
                    aria-label={newEnquiries + " new enquiries"}
                  >
                    {newEnquiries}
                  </span>
                )}
                {title === "Our Initiatives" && (
                  <span>
                    {rows.filter((r) => r.kind === "initiative").length}
                  </span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-avatar">{session.displayName?.[0] || "C"}</div>
          <div>
            <strong>
              {session.role === "super" ? "Super Administrator" : session.role}
            </strong>
            <small>{session.email}</small>
          </div>
          <button
            type="button"
            className="portal-lock"
            onClick={lockPortal}
            disabled={busy}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Open admin navigation"
          >
            <Menu />
          </button>
          <span>
            CCI <span className="muted">/ Website /</span> {tab}
          </span>
          <a href="/en" target="_blank" rel="noreferrer">
            View website
            <ArrowUpRight size={16} />
          </a>
        </header>
        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <span className="eyebrow">YOUR CCI WORKSPACE</span>
              <h1>
                {tab === "Settings"
                  ? "Website settings"
                  : edit
                    ? version
                      ? "Edit " + edit.title.en
                      : "Create " + kind
                    : tab === "Overview"
                      ? "A little care. A better website."
                      : tab}
              </h1>
              <p>
                {tab === "Overview"
                  ? "Manage your content, keep it current, and share it with your community."
                  : tab === "Settings"
                    ? "Manage branding, contact details, social channels, and search visibility."
                    : edit
                      ? "Save changes as a draft, review, then publish when approved."
                      : "Keep your organization’s information clear, current and approved."}
              </p>
            </div>
            {!edit &&
              ["Our Initiatives", "Impact"].includes(tab) &&
              can("edit") && (
                <button
                  className="button navy"
                  onClick={() => create(kind as any)}
                >
                  <Plus size={17} />
                  Add {tab === "Impact" ? "metric" : "Initiative"}
                </button>
              )}
          </div>
          {message && (
            <div className="success feedback" role="status">
              <Check size={17} />
              {message}
              <button onClick={() => setMessage("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <div className="error feedback" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
          {edit ? (
            <div className="editor-layout">
              <div className="editor-panel">
                <div className="editor-toolbar">
                  {tab === "Settings" ? (
                    <nav
                      className="settings-shortcuts"
                      aria-label="Settings sections"
                    >
                      <a href="#settings-identity">Identity</a>
                      <a href="#settings-contact">Contact</a>
                      <a href="#settings-social">Social</a>
                      <a href="#settings-search">Search</a>
                    </nav>
                  ) : (
                    <button onClick={() => setEdit(null)}>
                      ← Back to {tab}
                    </button>
                  )}
                  <div className="language-tabs">
                    <button
                      className={language === "en" ? "selected" : ""}
                      onClick={() => setLanguage("en")}
                    >
                      English
                    </button>
                    <button
                      className={language === "my" ? "selected" : ""}
                      onClick={() => setLanguage("my")}
                    >
                      မြန်မာ
                    </button>
                  </div>
                </div>
                <h2
                  id={
                    edit.kind === "settings" ? "settings-identity" : undefined
                  }
                >
                  {edit.kind === "settings" ? "Site identity" : "Content"}
                </h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    save();
                  }}
                >
                  <fieldset disabled={!can("edit") || busy}>
                    {!version && field("Slug / unique ID", "id")}
                    {textField(
                      edit.kind === "settings" ? "Organization name" : "Title",
                      "title",
                    )}
                    {textField(
                      edit.kind === "settings"
                        ? "Footer tagline"
                        : "Description",
                      "description",
                    )}
                    {edit.kind === "settings" && (
                      <div className="field-grid">
                        {field("Logo URL", "image")}
                        {field("Logo alternative text", "alt")}
                      </div>
                    )}
                    {edit.id === "home" && (
                      <>
                        <label>
                          Primary CTA label
                          <Input
                            value={edit.ctaLabel?.[language] || ""}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                ctaLabel: {
                                  en: "",
                                  my: "",
                                  ...edit.ctaLabel,
                                  [language]: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                        <label>
                          Secondary CTA label
                          <Input
                            value={edit.secondaryCtaLabel?.[language] || ""}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                secondaryCtaLabel: {
                                  en: "",
                                  my: "",
                                  ...edit.secondaryCtaLabel,
                                  [language]: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                        {field("Secondary CTA link", "secondaryUrl")}
                      </>
                    )}
                    <details
                      className="seo-fields"
                      id={
                        edit.kind === "settings" ? "settings-search" : undefined
                      }
                      open={edit.kind === "settings" ? true : undefined}
                    >
                      <summary>
                        {edit.kind === "settings"
                          ? "Search visibility and metadata"
                          : "Search engine metadata"}
                      </summary>
                      {edit.kind === "settings" && (
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={!!edit.preview}
                            onChange={(e) =>
                              setEdit({ ...edit, preview: e.target.checked })
                            }
                          />
                          Ask search engines to skip this site
                        </label>
                      )}
                      <label>
                        SEO title
                        <Input
                          value={edit.seoTitle?.[language] || ""}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              seoTitle: {
                                en: "",
                                my: "",
                                ...edit.seoTitle,
                                [language]: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        SEO description
                        <Textarea
                          value={edit.seoDescription?.[language] || ""}
                          onChange={(e) =>
                            setEdit({
                              ...edit,
                              seoDescription: {
                                en: "",
                                my: "",
                                ...edit.seoDescription,
                                [language]: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                    </details>
                    {edit.kind === "initiative" && (
                      <div className="field-grid">
                        <label>
                          Initiative status
                          <ChoiceField
                            label="Initiative status"
                            options={["Active", "Coming Soon", "Completed"]}
                            value={edit.status}
                            disabled={busy || !can("edit")}
                            onValueChange={(status) =>
                              setEdit({ ...edit, status })
                            }
                          />
                        </label>
                        {field("Display order", "order", "number")}
                      </div>
                    )}
                    {["initiative", "page"].includes(edit.kind) && (
                      <>
                        {field("Image URL", "image")}
                        {field("Image alternative text", "alt")}
                        {field("Approved platform / external HTTPS URL", "url")}
                      </>
                    )}
                    {edit.kind === "initiative" && (
                      <>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={edit.featured}
                            onChange={(e) =>
                              setEdit({ ...edit, featured: e.target.checked })
                            }
                          />
                          Feature on homepage
                        </label>
                        <section className="card-image-editor">
                          <h3>Initiative card image</h3>
                          <p className="form-note">
                            Appears on Our Initiatives and on Home when
                            featured. PNG, JPEG or WebP.
                          </p>
                          {edit.cardImage && (
                            <img
                              src={edit.cardImage}
                              alt={edit.cardAlt || ""}
                              loading="lazy"
                            />
                          )}
                          {field("Card image URL", "cardImage")}
                          <label>
                            Card image alternative text
                            <Input
                              value={edit.cardAlt || ""}
                              maxLength={500}
                              onChange={(e) =>
                                setEdit({ ...edit, cardAlt: e.target.value })
                              }
                              disabled={busy}
                            />
                          </label>
                          {can("media") && can("edit") && (
                            <div className="card-image-upload">
                              <label>
                                Card image file
                                <Input
                                  ref={cardPhotoInput}
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  disabled={busy}
                                />
                              </label>
                              <button
                                type="button"
                                className="button navy"
                                onClick={uploadCardImage}
                                disabled={busy}
                              >
                                <Upload size={16} aria-hidden="true" /> Upload
                                and attach
                              </button>
                            </div>
                          )}
                        </section>
                      </>
                    )}
                    {edit.kind === "impact" && (
                      <>
                        {field(
                          "Value and unit (e.g. 120 participants)",
                          "value",
                        )}
                        {field("Measurement period", "period")}
                        {field(
                          "Internal evidence source / reference",
                          "source",
                        )}
                        <p className="form-note">
                          Only publish metrics with client-approved figures and
                          evidence.
                        </p>
                      </>
                    )}
                    {edit.kind === "settings" && (
                      <>
                        <section
                          className="settings-section"
                          id="settings-contact"
                        >
                          <div className="settings-section-head">
                            <h3>Contact and enquiries</h3>
                            <span
                              className={`badge ${current?.published?.privacyApproved ? "published" : ""}`}
                            >
                              {current?.published?.privacyApproved
                                ? "Intake enabled"
                                : "Intake paused"}
                            </span>
                          </div>
                          <p className="form-note">
                            Published details appear on Work With Us. Messages are
                            reviewed in the Enquiries inbox.
                          </p>
                          <div className="field-grid">
                            {field("Public contact email", "email", "email")}
                            {field("Phone", "phone", "tel")}
                          </div>
                          {field("Address", "address")}
                          {(
                            ["contactFormTitle", "contactConfirmation"] as const
                          ).map((key) => (
                            <label key={key}>
                              {key === "contactFormTitle"
                                ? "Contact form heading"
                                : "Confirmation message after submitting"}
                              <Input
                                value={edit[key]?.[language] || ""}
                                maxLength={
                                  key === "contactFormTitle" ? 100 : 300
                                }
                                onChange={(event) =>
                                  setEdit({
                                    ...edit,
                                    [key]: {
                                      en: "",
                                      my: "",
                                      ...edit[key],
                                      [language]: event.target.value,
                                    },
                                  })
                                }
                                placeholder={
                                  key === "contactFormTitle"
                                    ? "Start a conversation"
                                    : "Your message has been received."
                                }
                              />
                            </label>
                          ))}
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={!!edit.privacyApproved}
                              onChange={(e) =>
                                setEdit({
                                  ...edit,
                                  privacyApproved: e.target.checked,
                                })
                              }
                            />
                            Accept contact form enquiries
                          </label>
                          <div className="settings-shortcuts">
                            <a
                              href="/en/contact"
                              target="_blank"
                              rel="noopener"
                            >
                              View Work With Us
                            </a>
                            <a
                              href="/en/privacy"
                              target="_blank"
                              rel="noopener"
                            >
                              View Privacy Policy
                            </a>
                            {can("enquiries") && (
                              <a
                                href="/admin?tab=enquiries"
                                target="_blank"
                                rel="noopener"
                              >
                                Open Enquiries
                              </a>
                            )}
                          </div>
                        </section>
                        <section
                          className="settings-section"
                          id="settings-social"
                        >
                          <h3>Social media channels</h3>
                          {Object.entries(socialChannels).map(
                            ([key, label]) => (
                              <label key={key}>
                                {label} URL
                                <Input
                                  type="url"
                                  value={
                                    edit.socialLinks?.[key as SocialChannel] ||
                                    ""
                                  }
                                  onChange={(event) =>
                                    setEdit({
                                      ...edit,
                                      socialLinks: {
                                        ...edit.socialLinks,
                                        [key]: event.target.value.trim(),
                                      },
                                    })
                                  }
                                  placeholder="https://"
                                />
                              </label>
                            ),
                          )}
                          {edit.social &&
                            field("Other social channel URL", "social", "url")}
                        </section>
                      </>
                    )}
                    <div className="section-editor-heading">
                      <h2>
                        {edit.kind === "settings"
                          ? "Site-wide sections"
                          : "Page sections"}
                      </h2>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() =>
                          setEdit({
                            ...edit,
                            sections: [
                              ...edit.sections,
                              {
                                id: crypto.randomUUID(),
                                heading: { en: "New section", my: "" },
                                body: { en: "", my: "" },
                                image: "",
                                cta: { en: "", my: "" },
                                href: "",
                                visible: true,
                                order: edit.sections.length,
                              },
                            ],
                          })
                        }
                      >
                        <Plus size={15} />
                        Add section
                      </button>
                    </div>
                    {edit.id === "way-way-shaung" && (
                      <p className="form-note">
                        Use Partner logo for approved logo files from
                        organizations such as the U.S. Embassy Yangon, KBZPay or
                        TrueMoney. Use Testimonial for an approved quote and its
                        attribution.
                      </p>
                    )}
                    {edit.sections.map((s, i) => {
                      const patch = (v: Partial<Section>) =>
                        setEdit({
                          ...edit,
                          sections: edit.sections.map((x, j) =>
                            j === i ? { ...x, ...v } : x,
                          ),
                        });
                      return (
                        <div className="section-editor" key={s.id}>
                          <div>
                            <strong>Section {i + 1}</strong>
                            <button
                              type="button"
                              aria-label="Remove section"
                              onClick={() =>
                                setEdit({
                                  ...edit,
                                  sections: edit.sections.filter(
                                    (_, j) => j !== i,
                                  ),
                                })
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          {edit.id === "way-way-shaung" && (
                            <label>
                              Display as
                              <ChoiceField
                                label="Display as"
                                options={[
                                  {
                                    value: "standard",
                                    label: "Learning feature",
                                  },
                                  { value: "partner", label: "Partner logo" },
                                  {
                                    value: "testimonial",
                                    label: "Testimonial",
                                  },
                                ]}
                                value={s.display || "standard"}
                                disabled={busy || !can("edit")}
                                onValueChange={(display) =>
                                  patch({
                                    display: display as Section["display"],
                                  })
                                }
                              />
                            </label>
                          )}
                          <label>
                            {s.display === "partner"
                              ? "Partner name"
                              : s.display === "testimonial"
                                ? "Attribution"
                                : "Heading"}
                            <Input
                              value={s.heading[language]}
                              onChange={(e) =>
                                patch({
                                  heading: {
                                    ...s.heading,
                                    [language]: e.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            {s.display === "testimonial"
                              ? "Approved quote"
                              : "Text"}
                            <Textarea
                              rows={4}
                              value={s.body[language]}
                              onChange={(e) =>
                                patch({
                                  body: {
                                    ...s.body,
                                    [language]: e.target.value,
                                  },
                                })
                              }
                            />
                          </label>
                          <div className="field-grid">
                            <label>
                              Button text
                              <Input
                                value={s.cta[language]}
                                onChange={(e) =>
                                  patch({
                                    cta: {
                                      ...s.cta,
                                      [language]: e.target.value,
                                    },
                                  })
                                }
                              />
                            </label>
                            <label>
                              Button link
                              <Input
                                value={s.href}
                                onChange={(e) =>
                                  patch({ href: e.target.value })
                                }
                              />
                            </label>
                          </div>
                          <label>
                            Image URL
                            <Input
                              value={s.image}
                              onChange={(e) => patch({ image: e.target.value })}
                            />
                          </label>
                          <div className="field-grid">
                            <label>
                              Display order
                              <Input
                                type="number"
                                value={s.order}
                                onChange={(e) =>
                                  patch({ order: Number(e.target.value) })
                                }
                              />
                            </label>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={s.visible}
                                onChange={(e) =>
                                  patch({ visible: e.target.checked })
                                }
                              />
                              Show section
                            </label>
                          </div>
                        </div>
                      );
                    })}
                    <button type="submit" className="button navy">
                      <Save size={16} />
                      {busy ? "Saving…" : "Save draft"}
                    </button>
                  </fieldset>
                </form>
              </div>
              <aside className="publish-panel">
                <h3>Publication</h3>
                <span
                  className={`badge ${current?.published ? "published" : ""}`}
                >
                  {current?.published
                    ? "Published version exists"
                    : "Unpublished"}
                </span>
                <p>
                  Drafts are private. Saving a draft does not change your public
                  website.
                </p>
                <dl>
                  <dt>Last saved</dt>
                  <dd>
                    {current
                      ? new Date(current.updated_at).toLocaleString()
                      : "Not saved"}
                  </dd>
                  <dt>Version</dt>
                  <dd>{version || "New record"}</dd>
                </dl>
                {version > 0 && (
                  <a
                    className="button outline"
                    target="_blank"
                    href={`/${language}/${edit.kind === "initiative" ? "initiatives/" : ""}${edit.kind === "impact" ? "impact" : ["home", "site"].includes(edit.id) ? "" : edit.id}?preview=1`}
                    rel="noreferrer"
                  >
                    <Eye size={16} />
                    Preview saved draft
                  </a>
                )}
                {can("publish") && version > 0 && (
                  <>
                    <button
                      className="button navy"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({ action: "publish", row: current! })
                      }
                    >
                      {dirty ? "Save and publish" : "Publish saved draft"}
                      <ArrowUpRight size={16} />
                    </button>
                    {current?.published && edit.kind !== "settings" && (
                      <button
                        className="danger-link"
                        onClick={() =>
                          setConfirm({ action: "unpublish", row: current })
                        }
                      >
                        Unpublish content
                      </button>
                    )}
                  </>
                )}
                <p className="form-note">
                  Make sure copy, translations, image rights and any impact
                  claims have been approved.
                </p>
              </aside>
            </div>
          ) : tab === "Overview" ? (
            <>
              <div className="dashboard-stats">
                {[
                  [
                    "Published pages",
                    rows.filter((r) => r.kind === "page" && r.published).length,
                  ],
                  [
                    "Unpublished changes",
                    rows.filter(
                      (r) =>
                        JSON.stringify(r.draft) !== JSON.stringify(r.published),
                    ).length,
                  ],
                  [
                    "Our Initiatives",
                    rows.filter((r) => r.kind === "initiative").length,
                  ],
                  [
                    "Coming soon",
                    rows.filter(
                      (r) =>
                        r.kind === "initiative" &&
                        r.draft.status === "Coming Soon",
                    ).length,
                  ],
                ].map(([s, n], i) => (
                  <button
                    key={s}
                    onClick={() => setTab(i < 2 ? "Pages" : "Our Initiatives")}
                  >
                    <span>{s}</span>
                    <strong>{n}</strong>
                    <ArrowUpRight size={20} />
                  </button>
                ))}
              </div>
              <div className="dashboard-columns">
                <section className="admin-panel">
                  <div className="panel-title">
                    <h2>Make your next update</h2>
                    <span className="eyebrow">QUICK ACTIONS</span>
                  </div>
                  {[
                    [
                      "Edit homepage",
                      "Keep your first impression up to date.",
                      "Pages",
                    ],
                    [
                      "Manage Our Initiatives",
                      "Share your work and what’s coming next.",
                      "Our Initiatives",
                    ],
                    [
                      "Add approved imagery",
                      "Upload brand and community images.",
                      "Media Library",
                    ],
                  ]
                    .filter((x) => x[2] !== "Media Library" || can("media"))
                    .map(([title, desc, target]) => (
                      <button
                        className="quick-action"
                        key={title}
                        onClick={() => {
                          if (target === "Pages") {
                            setTab("Pages");
                            setTimeout(
                              () => open(rows.find((r) => r.id === "home")!),
                              0,
                            );
                          } else setTab(target);
                        }}
                      >
                        <div>
                          <h3>{title}</h3>
                          <p>{desc}</p>
                        </div>
                        <ArrowUpRight size={20} />
                      </button>
                    ))}
                </section>
                <section className="admin-panel approval-panel">
                  <span className="eyebrow">BEFORE LAUNCH</span>
                  <h2>
                    Good content
                    <br />
                    builds trust.
                  </h2>
                  <p>
                    Official mission, vision, translations, contact details,
                    privacy policy and verified impact evidence still need
                    client approval.
                  </p>
                  <a href="/en" target="_blank" className="text-link">
                    Review website
                    <ArrowUpRight size={16} />
                  </a>
                </section>
              </div>
              <section className="admin-panel">
                <div className="panel-title">
                  <h2>Recently updated</h2>
                  <button className="text-link" onClick={() => setTab("Pages")}>
                    Manage pages
                    <ArrowUpRight size={16} />
                  </button>
                </div>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label={"Recently updated content"}
                >
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th scope="col">Content</th>
                        <th scope="col">Type</th>
                        <th scope="col">Status</th>
                        <th scope="col">Last saved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...rows]
                        .sort((a, b) =>
                          b.updated_at.localeCompare(a.updated_at),
                        )
                        .slice(0, 6)
                        .map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="table-link"
                                onClick={() => {
                                  setTab(
                                    r.kind === "page"
                                      ? "Pages"
                                      : r.kind === "initiative"
                                        ? "Our Initiatives"
                                        : r.kind === "impact"
                                          ? "Impact"
                                          : "Settings",
                                  );
                                  setTimeout(() => open(r), 0);
                                }}
                              >
                                {r.draft.title.en}
                              </button>
                            </td>
                            <td>{r.kind}</td>
                            <td>
                              <span
                                className={`badge ${r.published ? "published" : ""}`}
                              >
                                {r.published ? "Published" : "Draft"}
                              </span>
                            </td>
                            <td>
                              {new Date(r.updated_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : tab === "Settings" ? (
            <div className="admin-panel" role="status">
              Loading website settings…
            </div>
          ) : ["Pages", "Our Initiatives", "Impact"].includes(tab) ? (
            <section className="admin-panel">
              <div className="table-search">
                <Search size={17} />
                <Input
                  placeholder={`Search ${tab.toLowerCase()}…`}
                  aria-label="Search content"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label={tab}
              >
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Publication</th>
                      {tab === "Our Initiatives" && <th scope="col">Status</th>}
                      <th scope="col">Myanmar translation</th>
                      <th scope="col">Last saved</th>
                      <th className="table-actions" scope="col">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => {
                      const status = (r.published || r.draft).status;
                      return (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.draft.title.en}</strong>
                            <small className="table-sub">/{r.id}</small>
                          </td>
                          <td>
                            <span
                              className={`badge ${r.published ? "published" : ""}`}
                            >
                              {r.published ? "Published" : "Draft"}
                            </span>
                            {JSON.stringify(r.draft) !==
                              JSON.stringify(r.published) && (
                              <small className="table-sub">
                                Unpublished changes
                              </small>
                            )}
                          </td>
                          {tab === "Our Initiatives" && (
                            <td>
                              <ChoiceField
                                compact
                                label={`Status for ${r.draft.title.en}`}
                                value={status}
                                disabled={busy || !can("publish")}
                                onValueChange={(value) =>
                                  updateInitiativeStatus(r, value)
                                }
                                options={[
                                  "Coming Soon",
                                  "Active",
                                  ...(!["Coming Soon", "Active"].includes(
                                    status,
                                  )
                                    ? [
                                        {
                                          value: status,
                                          label: status,
                                          disabled: true,
                                        },
                                      ]
                                    : []),
                                ]}
                              />
                              {r.published && r.draft.status !== status && (
                                <small className="table-sub">
                                  Draft: {r.draft.status}
                                </small>
                              )}
                            </td>
                          )}
                          <td>
                            {r.draft.title.my
                              ? "Available"
                              : "Awaiting content"}
                          </td>
                          <td>{new Date(r.updated_at).toLocaleDateString()}</td>
                          <td className="table-actions">
                            <button
                              type="button"
                              className="table-action-button"
                              onClick={() => open(r)}
                            >
                              {can("edit") ? (
                                <Pencil size={16} aria-hidden="true" />
                              ) : (
                                <Eye size={16} aria-hidden="true" />
                              )}
                              {can("edit") ? "Edit content" : "View content"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!list.length && (
                  <div className="empty-state">
                    <Layers />
                    <h3>
                      {query
                        ? "No matching content"
                        : "Ready for your first approved entry."}
                    </h3>
                    <p>
                      {tab === "Impact"
                        ? "Add a verified metric with its evidence and reporting period."
                        : "Create and publish content to share it on the website."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          ) : tab === "Media Library" ? (
            <>
              <form
                className="admin-panel upload-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  run(async () => {
                    await api("media", "POST", new FormData(form));
                    form.reset();
                  }, "Image uploaded. Copy its URL to assign it to content.");
                }}
              >
                <Upload size={28} />
                <div>
                  <h2>Add an approved image</h2>
                  <p>PNG, JPEG or WebP · Alternative text required</p>
                </div>
                <label className="file-label">
                  Image file
                  <Input
                    required
                    name="file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </label>
                <label>
                  Alternative text
                  <Input
                    required
                    name="alt"
                    maxLength={500}
                    placeholder="Describe the image"
                  />
                </label>
                <button className="button navy" disabled={busy}>
                  Upload image
                </button>
              </form>
              <div className="media-grid">
                {items.map((m) => (
                  <article className="admin-panel" key={m.id}>
                    <img src={"/api/media-file/" + m.id} alt={m.alt} />
                    <h3>{m.name}</h3>
                    <p>{m.alt}</p>
                    <small>{Math.round(m.size / 1024)} KB</small>
                    <label>
                      Image URL
                      <Input
                        readOnly
                        value={"/api/media-file/" + m.id}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <button
                      className="danger-link"
                      onClick={() =>
                        run(
                          () => api("media", "DELETE", { id: m.id }),
                          "Unused image deleted.",
                        )
                      }
                    >
                      <Trash2 size={14} />
                      Delete unused image
                    </button>
                  </article>
                ))}
              </div>
              {!items.length && (
                <div className="empty-state">
                  <ImageIcon />
                  <h3>Your media library starts here.</h3>
                  <p>
                    Supplied brand assets are bundled with the website. Upload
                    approved imagery to grow your library.
                  </p>
                </div>
              )}
            </>
          ) : tab === "Enquiries" ? (
            <section className="admin-panel">
              <div className="table-search">
                <Search size={17} />
                <Input
                  aria-label="Search enquiries"
                  placeholder="Search enquiries…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {enquiries.length > 0 ? (
                <div
                  className="table-wrap enquiries-scroll"
                  role="region"
                  tabIndex={0}
                  aria-label="Contact submissions"
                >
                  <table className="admin-data-table enquiries-table">
                    <thead>
                      <tr>
                        <th scope="col">Subject</th>
                        <th scope="col">Full name</th>
                        <th scope="col">Email address</th>
                        <th scope="col">Message</th>
                        <th scope="col">Status</th>
                        <th scope="col">Received</th>
                        <th className="table-actions" scope="col">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingEnquiries.map((e) => {
                        const expanded = expandedEnquiries.has(e.id);
                        const detailId = `enquiry-${e.id}`;
                        return (
                          <Fragment key={e.id}>
                            <tr>
                              <td>
                                <strong>{e.subject}</strong>
                              </td>
                              <td>{e.name}</td>
                              <td>
                                <a
                                  className="enquiry-email"
                                  href={`mailto:${e.email}`}
                                >
                                  {e.email}
                                </a>
                              </td>
                              <td>
                                <span className="enquiry-preview">
                                  {e.message}
                                </span>
                              </td>
                              <td>
                                <span className="badge">{e.status}</span>
                              </td>
                              <td>
                                {new Date(e.created_at).toLocaleDateString()}
                              </td>
                              <td className="table-actions">
                                <button
                                  type="button"
                                  className="table-action-button"
                                  aria-expanded={expanded}
                                  aria-controls={detailId}
                                  aria-label={`${expanded ? "Hide" : "View"} enquiry: ${e.subject}`}
                                  onClick={() =>
                                    setExpandedEnquiries((current) => {
                                      const next = new Set(current);
                                      if (!next.delete(e.id)) next.add(e.id);
                                      return next;
                                    })
                                  }
                                >
                                  <Eye size={16} aria-hidden="true" />
                                  {expanded ? "Hide" : "View"}
                                </button>
                              </td>
                            </tr>
                            <tr
                              id={detailId}
                              className="enquiry-detail"
                              hidden={!expanded}
                            >
                              <td colSpan={7}>
                                <div className="enquiry-detail-content">
                                  <p className="message-body">{e.message}</p>
                                  <form
                                    onSubmit={(ev) => {
                                      ev.preventDefault();
                                      const f = new FormData(ev.currentTarget);
                                      run(
                                        () =>
                                          api("enquiries", "POST", {
                                            id: e.id,
                                            ...Object.fromEntries(f),
                                          }),
                                        "Enquiry updated.",
                                      );
                                    }}
                                  >
                                    <label>
                                      Status
                                      <ChoiceField
                                        label="Status"
                                        name="status"
                                        defaultValue={e.status}
                                        disabled={busy}
                                        options={[
                                          "New",
                                          "In Review",
                                          "Responded",
                                          "Closed",
                                        ]}
                                      />
                                    </label>
                                    <label>
                                      Internal notes
                                      <Textarea
                                        name="notes"
                                        maxLength={5000}
                                        defaultValue={e.notes}
                                      />
                                    </label>
                                    <button
                                      className="button navy"
                                      disabled={busy}
                                    >
                                      Save enquiry
                                    </button>
                                  </form>
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                      {matchingEnquiries.length === 0 && (
                        <tr>
                          <td colSpan={7}>No enquiries match your search.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <Inbox />
                  <h3>Your inbox is clear.</h3>
                  <p>Contact form submissions appear here.</p>
                </div>
              )}
            </section>
          ) : tab === "Staff Access" ? (
            <section className="admin-panel">
              <h2>Staff accounts</h2>
              <p>
                Add a staff email and choose a role. New accounts receive a
                temporary password to replace on first sign-in.
              </p>
              <form
                className="staff-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  saveAccess(
                    String(f.get("email")),
                    String(f.get("role")),
                    staffActive,
                    staffIssuePassword,
                  );
                }}
              >
                <label>
                  Staff email
                  <Input name="email" type="email" maxLength={254} required />
                </label>
                <label>
                  Role
                  <ChoiceField
                    label="Role"
                    name="role"
                    defaultValue="editor"
                    disabled={busy}
                    options={Object.entries(staffRoles).map(
                      ([value, label]) => ({ value, label }),
                    )}
                  />
                </label>
                <div className="staff-toggle-field">
                  <span>Access</span>
                  <label className="staff-toggle-control">
                    <Switch
                      className="staff-switch"
                      aria-label="Account active"
                      checked={staffActive}
                      onCheckedChange={setStaffActive}
                      disabled={busy}
                    />
                    <span>{staffActive ? "Active" : "Inactive"}</span>
                  </label>
                </div>
                <button className="button navy" disabled={busy}>
                  Save access
                </button>
                <label className="staff-toggle-control staff-password-option">
                  <Switch
                    className="staff-switch"
                    aria-label="Reset the password for an existing account"
                    checked={staffIssuePassword}
                    onCheckedChange={setStaffIssuePassword}
                    disabled={busy}
                  />
                  <span>Reset the password for an existing account</span>
                </label>
              </form>
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label={"Staff access"}
              >
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Sign-in</th>
                      <th scope="col">Access</th>
                      <th className="table-actions" scope="col">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .filter((s) => typeof s.has_password === "number")
                      .map((s) => (
                        <tr key={s.email}>
                          <td>{s.email}</td>
                          <td>
                            {staffRoles[s.role as keyof typeof staffRoles] ??
                              s.role}
                          </td>
                          <td>
                            {s.has_password
                              ? "Email and password"
                              : "Password needed"}
                          </td>
                          <td>
                            <div className="staff-toggle-control">
                              <Switch
                                className="staff-switch"
                                aria-label={`Active access for ${s.email}`}
                                checked={Boolean(s.active)}
                                onCheckedChange={(active) =>
                                  saveAccess(s.email, undefined, active)
                                }
                                disabled={
                                  busy || s.managed || s.email === session.email
                                }
                              />
                              <span>{s.active ? "Active" : "Inactive"}</span>
                            </div>
                          </td>
                          <td className="table-actions">
                            <button
                              type="button"
                              className="table-action-button"
                              disabled={
                                busy || s.managed || s.email === session.email
                              }
                              onClick={() =>
                                saveAccess(s.email, undefined, undefined, true)
                              }
                            >
                              <LockKeyhole size={15} aria-hidden="true" />
                              {s.has_password
                                ? "Reset password"
                                : "Issue password"}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="form-note">
                Administrators provisioned during deployment are managed by the
                site operator.
              </p>
              <Dialog
                open={issuedPassword !== null}
                onOpenChange={(open) => {
                  if (!open) setIssuedPassword(null);
                }}
              >
                {issuedPassword && (
                  <DialogContent className="staff-password-dialog">
                    <DialogTitle>Temporary portal password</DialogTitle>
                    <DialogDescription>
                      Share this password privately with {issuedPassword.email}.
                      It is shown once and expires in 24 hours.
                    </DialogDescription>
                    <Input
                      aria-label="Temporary portal password"
                      value={issuedPassword.temporaryPassword}
                      readOnly
                      onFocus={(event) => event.currentTarget.select()}
                    />
                    <DialogClose asChild>
                      <button type="button" className="button navy">
                        Done
                      </button>
                    </DialogClose>
                  </DialogContent>
                )}
              </Dialog>
            </section>
          ) : (
            <section className="admin-panel">
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label={"Audit history"}
              >
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th className="table-actions" scope="col">
                        Action
                      </th>
                      <th scope="col">Record</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) => (
                      <tr key={a.id}>
                        <td>{a.action}</td>
                        <td>{a.target}</td>
                        <td>{a.actor}</td>
                        <td>{new Date(a.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!items.length && (
                  <div className="empty-state">
                    <History />
                    <h3>No administrative changes yet.</h3>
                    <p>
                      Saved drafts, publications and access changes are recorded
                      here.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-heading"
          >
            <h2 id="confirm-heading">
              {confirm.action === "publish"
                ? dirty
                  ? "Save and publish changes?"
                  : "Publish saved content?"
                : "Unpublish this content?"}
            </h2>
            <p>
              {confirm.action === "publish"
                ? dirty
                  ? "Your current edits will be saved and published together."
                  : "The saved draft will replace the version visible on the public website."
                : "This content will be removed from public pages. Your draft will be kept."}
            </p>
            <strong>
              {confirm.action === "publish" && dirty
                ? edit?.title.en
                : confirm.row.draft.title.en}
            </strong>
            <div>
              <button
                className="button outline"
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                autoFocus
                className="button navy"
                disabled={busy}
                onClick={() => {
                  const c = confirm;
                  run(
                    async () => {
                      await api("publish", "POST", {
                        id: c.row.id,
                        version,
                        unpublish: c.action === "unpublish",
                        ...(c.action === "publish" && dirty
                          ? { content: edit }
                          : {}),
                      });
                      notifyPublication();
                      setEdit(null);
                      setConfirm(null);
                    },
                    c.action === "publish"
                      ? "Content published. The public website is updated."
                      : "Content unpublished.",
                  );
                }}
              >
                Confirm {confirm.action}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
