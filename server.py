"""
ChatDesk Backend Server — v2
-----------------------------
Changes from v1:
  - Agents: 100% from Supabase (no Chatwoot agent linking)
  - Conversations: status/assigned_to/tags stored in Supabase conversations table
  - Contacts: CSV import endpoint added; click-to-conversation via stored conversation_id
  - Private notes stay in Chatwoot (message_type=2); yellow styling is frontend-only
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os
import csv
import io
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder="dist")
CORS(app)

# ── CONFIG ───────────────────────────────────────────────────────────────────
CHATWOOT_URL   = os.getenv("CHATWOOT_URL", "https://app.chatwoot.com")
CHATWOOT_TOKEN = os.getenv("CHATWOOT_TOKEN", "")
ACCOUNT_ID     = os.getenv("CHATWOOT_ACCOUNT_ID", "1")
SUPABASE_URL   = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY   = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")
ADMIN_EMAIL    = os.getenv("ADMIN_EMAIL", "admin@chatdesk.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# ── HELPERS ──────────────────────────────────────────────────────────────────
def cw_headers():
    return {"api_access_token": CHATWOOT_TOKEN, "Content-Type": "application/json"}

def cw_headers_upload():
    return {"api_access_token": CHATWOOT_TOKEN}

def cw_url(path):
    return f"{CHATWOOT_URL}/api/v1/accounts/{ACCOUNT_ID}/{path}"

def sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

def sb_url(table):
    return f"{SUPABASE_URL}/rest/v1/{table}"

def error(msg, code=400):
    return jsonify({"error": msg}), code

def ok(data=None, code=200):
    return jsonify(data or {"success": True}), code

# ── FRONTEND ─────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("dist", "index.html")

@app.route("/<path:path>")
def catch_all(path):
    dist_dir = os.path.join(app.root_path, "dist")
    file_path = os.path.join(dist_dir, path)
    if os.path.exists(file_path):
        return send_from_directory(dist_dir, path)
    return send_from_directory(dist_dir, "index.html")

# ── AUTH ──────────────────────────────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # Check env-based admin first (fallback if Supabase not set)
    if email == ADMIN_EMAIL.lower() and password == ADMIN_PASSWORD:
        return jsonify({"role": "admin", "name": "Admin", "email": email, "token": "admin-session"})

    if not SUPABASE_URL:
        return error("Supabase not configured", 401)

    r = requests.get(sb_url("agents"), headers=sb_headers(),
                     params={"email": f"eq.{email}", "select": "*"})
    agents = r.json()
    if not agents or not isinstance(agents, list):
        return error("Agent not found", 401)
    agent = agents[0]
    if agent.get("password") != password:
        return error("Invalid credentials", 401)

    return jsonify({
        "role": agent.get("role", "agent"),
        "name": agent.get("name"),
        "email": email,
        "agent_id": agent.get("id"),   # Supabase agent id
        "token": f"agent-{agent['id']}"
    })

# ── CONVERSATIONS ─────────────────────────────────────────────────────────────
@app.route("/api/conversations", methods=["GET"])
def get_conversations():
    page     = request.args.get("page", 1)
    status   = request.args.get("status", "open")
    assignee = request.args.get("assignee_type", "all")
    agent_id = request.args.get("agent_id", "")
    label    = request.args.get("label", "")

    params = {"page": page, "status": status, "assignee_type": assignee}
    if agent_id:
        params["assignee_id"] = agent_id
    if label:
        params["labels[]"] = label

    r = requests.get(cw_url("conversations"), headers=cw_headers(), params=params)
    if r.status_code != 200:
        return error(f"Chatwoot error: {r.text}", r.status_code)

    cw_data = r.json()
    convs = cw_data.get("data", {}).get("payload", [])

    # Enrich with Supabase metadata (assigned_to, tags, status override)
    if SUPABASE_URL and convs:
        conv_ids = [str(c["id"]) for c in convs]
        sr = requests.get(sb_url("conversations"), headers=sb_headers(),
                          params={"conversation_id": f"in.({','.join(conv_ids)})", "select": "*"})
        sb_rows = {row["conversation_id"]: row for row in (sr.json() if sr.status_code == 200 else [])}

        # Also fetch agent names
        agents_r = requests.get(sb_url("agents"), headers=sb_headers(),
                                params={"select": "id,name"})
        agents_map = {a["id"]: a["name"] for a in (agents_r.json() if agents_r.status_code == 200 else [])}

        for c in convs:
            sb = sb_rows.get(c["id"], {})
            if sb:
                c["_sb_status"]      = sb.get("status", c.get("status"))
                c["_sb_tags"]        = sb.get("tags", [])
                c["_sb_assigned_to"] = sb.get("assigned_to")
                c["_sb_agent_name"]  = agents_map.get(sb.get("assigned_to"), "")

    return jsonify(cw_data)

@app.route("/api/conversations/<int:conv_id>", methods=["GET"])
def get_conversation(conv_id):
    r = requests.get(cw_url(f"conversations/{conv_id}"), headers=cw_headers())
    cw = r.json()

    # Merge Supabase metadata
    if SUPABASE_URL:
        sr = requests.get(sb_url("conversations"), headers=sb_headers(),
                          params={"conversation_id": f"eq.{conv_id}", "select": "*"})
        rows = sr.json() if sr.status_code == 200 else []
        if rows:
            sb = rows[0]
            cw["_sb"] = sb
            # Fetch assigned agent name
            if sb.get("assigned_to"):
                ar = requests.get(sb_url("agents"), headers=sb_headers(),
                                  params={"id": f"eq.{sb['assigned_to']}", "select": "id,name,email"})
                arows = ar.json() if ar.status_code == 200 else []
                if arows:
                    cw["_sb"]["assigned_agent"] = arows[0]

    return jsonify(cw), r.status_code

# ── UPDATE CONVERSATION METADATA (our own fields) ─────────────────────────────
@app.route("/api/conversations/<int:conv_id>/meta", methods=["POST"])
def update_conv_meta(conv_id):
    """Update Supabase-managed fields: status, assigned_to, tags, notes"""
    if not SUPABASE_URL:
        return error("Supabase not configured")

    data = request.json
    now  = datetime.utcnow().isoformat()
    payload = {"updated_at": now}
    if "status" in data:       payload["status"]       = data["status"]
    if "assigned_to" in data:  payload["assigned_to"]  = data["assigned_to"]
    if "tags" in data:         payload["tags"]         = data["tags"]
    if "notes" in data:        payload["notes"]        = data["notes"]
    if "contact_name" in data: payload["contact_name"] = data["contact_name"]
    if "contact_number" in data: payload["contact_number"] = data["contact_number"]

    # Upsert
    ru = requests.patch(sb_url("conversations"),
                        headers={**sb_headers(), "Prefer": "return=representation"},
                        params={"conversation_id": f"eq.{conv_id}"},
                        json=payload)
    if ru.status_code == 200 and ru.json():
        return jsonify(ru.json()[0] if isinstance(ru.json(), list) else ru.json())

    # Insert if not found
    payload["conversation_id"] = conv_id
    payload["created_at"]      = now
    ri = requests.post(sb_url("conversations"),
                       headers={**sb_headers(), "Prefer": "return=representation"},
                       json=payload)
    if ri.status_code in [200, 201]:
        result = ri.json()
        return jsonify(result[0] if isinstance(result, list) else result)
    return ok()

# ── MESSAGES ──────────────────────────────────────────────────────────────────
@app.route("/api/conversations/<int:conv_id>/messages", methods=["GET"])
def get_messages(conv_id):
    r = requests.get(cw_url(f"conversations/{conv_id}/messages"), headers=cw_headers())
    return jsonify(r.json()), r.status_code

@app.route("/api/conversations/<int:conv_id>/messages", methods=["POST"])
def send_message(conv_id):
    data = request.json
    payload = {
        "content": data.get("content", ""),
        "message_type": "outgoing",
        "private": data.get("private", False)
    }
    r = requests.post(cw_url(f"conversations/{conv_id}/messages"),
                      headers=cw_headers(), json=payload)
    return jsonify(r.json()), r.status_code

@app.route("/api/conversations/<int:conv_id>/attachments", methods=["POST"])
def send_attachment(conv_id):
    if "file" not in request.files:
        return error("No file provided")
    file = request.files["file"]
    is_private = request.form.get("private", "false").lower() == "true"
    caption    = request.form.get("caption", "")

    content_type = file.content_type or "application/octet-stream"
    filename     = file.filename or "file"

    if filename.endswith((".ogg", ".oga")):
        content_type = "audio/ogg"
    elif filename.endswith(".mp3"):
        content_type = "audio/mpeg"
    elif filename.endswith(".wav"):
        content_type = "audio/wav"
    elif filename.endswith(".m4a"):
        content_type = "audio/mp4"
    elif filename.endswith(".webm") and "audio" in request.form.get("type", ""):
        content_type = "audio/webm"

    r = requests.post(
        cw_url(f"conversations/{conv_id}/messages"),
        headers=cw_headers_upload(),
        data={"message_type": "outgoing", "private": str(is_private).lower(), "content": caption},
        files={"attachments[]": (filename, file.stream, content_type)}
    )
    return jsonify(r.json()), r.status_code

# ── STATUS (Chatwoot + Supabase sync) ─────────────────────────────────────────
@app.route("/api/conversations/<int:conv_id>/resolve", methods=["POST"])
def resolve_conversation(conv_id):
    r = requests.patch(cw_url(f"conversations/{conv_id}/toggle_status"),
                       headers=cw_headers(), json={"status": "resolved"})
    if r.status_code == 200:
        _sb_set_status(conv_id, "resolved")
        return jsonify(r.json()), 200
    r2 = requests.patch(cw_url(f"conversations/{conv_id}"),
                        headers=cw_headers(), json={"status": "resolved"})
    _sb_set_status(conv_id, "resolved")
    return jsonify(r2.json()), r2.status_code

@app.route("/api/conversations/<int:conv_id>/reopen", methods=["POST"])
def reopen_conversation(conv_id):
    r = requests.patch(cw_url(f"conversations/{conv_id}/toggle_status"),
                       headers=cw_headers(), json={"status": "open"})
    if r.status_code == 200:
        _sb_set_status(conv_id, "open")
        return jsonify(r.json()), 200
    r2 = requests.patch(cw_url(f"conversations/{conv_id}"),
                        headers=cw_headers(), json={"status": "open"})
    _sb_set_status(conv_id, "open")
    return jsonify(r2.json()), r2.status_code

def _sb_set_status(conv_id, status):
    if not SUPABASE_URL:
        return
    now = datetime.utcnow().isoformat()
    ru = requests.patch(sb_url("conversations"),
                        headers={**sb_headers(), "Prefer": "return=representation"},
                        params={"conversation_id": f"eq.{conv_id}"},
                        json={"status": status, "updated_at": now})
    if not (ru.status_code == 200 and ru.json()):
        requests.post(sb_url("conversations"),
                      headers={**sb_headers(), "Prefer": "return=representation"},
                      json={"conversation_id": conv_id, "status": status,
                            "created_at": now, "updated_at": now})

# ── ASSIGN (Supabase-only, no Chatwoot agent assignment) ──────────────────────
@app.route("/api/conversations/<int:conv_id>/assign", methods=["POST"])
def assign_conversation(conv_id):
    """Assign conversation to a Supabase agent (stored in our conversations table)"""
    data = request.json
    agent_id = data.get("agent_id")  # Supabase agents.id

    if not SUPABASE_URL:
        return error("Supabase not configured")

    now = datetime.utcnow().isoformat()
    ru = requests.patch(sb_url("conversations"),
                        headers={**sb_headers(), "Prefer": "return=representation"},
                        params={"conversation_id": f"eq.{conv_id}"},
                        json={"assigned_to": agent_id, "updated_at": now})
    if ru.status_code == 200 and ru.json():
        return jsonify({"success": True})
    # Insert row if doesn't exist yet
    requests.post(sb_url("conversations"),
                  headers={**sb_headers(), "Prefer": "return=representation"},
                  json={"conversation_id": conv_id, "assigned_to": agent_id,
                        "created_at": now, "updated_at": now})
    return jsonify({"success": True})

# ── LABELS (Supabase) ────────────────────────────────────────────────────────
@app.route("/api/labels", methods=["GET"])
def get_labels():
    if SUPABASE_URL:
        r = requests.get(sb_url("labels"), headers=sb_headers(),
                         params={"select": "*", "order": "name.asc"})
        if r.status_code == 200:
            return jsonify({"payload": r.json()})
    return jsonify({"payload": []})

@app.route("/api/labels", methods=["POST"])
def create_label():
    if not SUPABASE_URL:
        return error("Supabase not configured")
    data  = request.json
    name  = data.get("name", "").strip().lower().replace(" ", "_")
    color = data.get("color", "#9b72ff")
    if not name:
        return error("name is required")
    r = requests.post(sb_url("labels"),
                      headers={**sb_headers(), "Prefer": "return=representation"},
                      json={"name": name, "color": color, "created_at": datetime.utcnow().isoformat()})
    if r.status_code in [200, 201]:
        result = r.json()
        return jsonify(result[0] if isinstance(result, list) else result), 201
    return error(f"Supabase error: {r.text}")

@app.route("/api/labels/<int:label_id>", methods=["DELETE"])
def delete_label(label_id):
    if not SUPABASE_URL:
        return error("Supabase not configured")
    requests.delete(sb_url("labels"), headers=sb_headers(), params={"id": f"eq.{label_id}"})
    return ok()

@app.route("/api/conversations/<int:conv_id>/labels", methods=["GET"])
def get_conversation_labels(conv_id):
    if SUPABASE_URL:
        r = requests.get(sb_url("conversation_labels"), headers=sb_headers(),
                         params={"conversation_id": f"eq.{conv_id}", "select": "*"})
        if r.status_code == 200:
            labels = [row.get("label_name") for row in r.json() if row.get("label_name")]
            return jsonify({"payload": labels})
    return jsonify({"payload": []})

@app.route("/api/conversations/<int:conv_id>/labels", methods=["POST"])
def set_conversation_labels(conv_id):
    data   = request.json
    labels = data.get("labels", [])
    if not SUPABASE_URL:
        return error("Supabase not configured")
    requests.delete(sb_url("conversation_labels"), headers=sb_headers(),
                    params={"conversation_id": f"eq.{conv_id}"})
    if labels:
        rows = [{"conversation_id": conv_id, "label_name": l,
                 "created_at": datetime.utcnow().isoformat()} for l in labels]
        r = requests.post(sb_url("conversation_labels"),
                          headers={**sb_headers(), "Prefer": "return=representation"},
                          json=rows)
        if r.status_code not in [200, 201]:
            return error(f"Supabase error: {r.text}")
    return jsonify({"payload": labels})

# ── CONTACTS ──────────────────────────────────────────────────────────────────
@app.route("/api/contacts", methods=["GET"])
def get_contacts():
    """Get contacts — Supabase contacts + every contact attached to a Chatwoot
    conversation, deduplicated. Each contact gets a `conversation_id` field
    when there is at least one open/pending conversation for them.
    """
    page = int(request.args.get("page", 1))
    q    = request.args.get("q", "").strip().lower()

    # ── Step 1: pull contacts that have an active Chatwoot conversation ──
    # We iterate the first 5 pages of conversations across all statuses so we
    # cover open + pending + recently resolved without a heavy query.
    conv_contacts = {}     # contact_id -> {name, phone, email, conv_id, status}
    phone_to_conv = {}     # normalized phone -> conv_id  (used for matching)
    try:
        for status in ("open", "pending"):
            for p in range(1, 4):
                cr = requests.get(cw_url("conversations"),
                                  headers=cw_headers(),
                                  params={"page": p, "status": status,
                                          "assignee_type": "all"},
                                  timeout=10)
                if cr.status_code != 200:
                    break
                payload = cr.json().get("data", {}).get("payload", [])
                if not payload:
                    break
                for conv in payload:
                    sender = (conv.get("meta") or {}).get("sender") or {}
                    cid = sender.get("id")
                    if not cid:
                        continue
                    phone = sender.get("phone_number") or ""
                    norm = "".join(ch for ch in phone if ch.isdigit())
                    # Keep the most recent conv_id per contact
                    existing = conv_contacts.get(cid)
                    if not existing or (conv.get("last_activity_at", 0) >
                                         existing.get("_ts", 0)):
                        conv_contacts[cid] = {
                            "id":              cid,
                            "name":            sender.get("name") or "Unknown",
                            "phone_number":    phone,
                            "email":           sender.get("email") or "",
                            "conversation_id": conv.get("id"),
                            "_status":         conv.get("status"),
                            "_ts":             conv.get("last_activity_at", 0),
                            "_source":         "chatwoot",
                        }
                    if norm:
                        phone_to_conv[norm] = conv.get("id")
                if len(payload) < 25:
                    break
    except Exception as e:
        # Non-fatal — we still return Supabase contacts below
        print(f"[contacts] Chatwoot fetch failed: {e}")

    # ── Step 2: Supabase contacts ──
    sb_contacts = []
    if SUPABASE_URL:
        limit  = 100
        offset = (page - 1) * limit
        params = {"select": "*", "order": "name.asc",
                  "limit": limit, "offset": offset}
        try:
            r = requests.get(sb_url("contacts"), headers=sb_headers(),
                             params=params, timeout=10)
            if r.status_code == 200:
                sb_contacts = r.json() or []
        except Exception as e:
            print(f"[contacts] Supabase fetch failed: {e}")

    # ── Step 3: merge ──
    # Supabase rows may already have a conversation_id column. If they don't,
    # we attach one by phone-number match against the Chatwoot conversations.
    seen_phones = set()
    merged = []

    # First, push all conv-backed contacts (they always have conversation_id).
    for c in conv_contacts.values():
        merged.append({
            "id":              c["id"],
            "name":            c["name"],
            "phone_number":    c["phone_number"],
            "email":           c["email"],
            "conversation_id": c["conversation_id"],
        })
        norm = "".join(ch for ch in (c["phone_number"] or "") if ch.isdigit())
        if norm:
            seen_phones.add(norm)

    # Then, push Supabase rows that aren't duplicates.
    for c in sb_contacts:
        norm = "".join(ch for ch in (c.get("phone_number") or "") if ch.isdigit())
        if norm and norm in seen_phones:
            continue
        # Attempt to attach a conv_id from the phone map
        cid = c.get("conversation_id")
        if not cid and norm and norm in phone_to_conv:
            cid = phone_to_conv[norm]
        merged.append({
            "id":              c.get("id"),
            "name":            c.get("name"),
            "phone_number":    c.get("phone_number") or "",
            "email":           c.get("email") or "",
            "conversation_id": cid,
        })
        if norm:
            seen_phones.add(norm)

    # ── Step 4: search filter ──
    if q:
        merged = [c for c in merged if
                  q in (c.get("name") or "").lower() or
                  q in (c.get("phone_number") or "").lower() or
                  q in (c.get("email") or "").lower()]

    # ── Step 5: sort — contacts with conversations first, then by name ──
    merged.sort(key=lambda c: (
        0 if c.get("conversation_id") else 1,
        (c.get("name") or "").lower(),
    ))

    return jsonify({"payload": merged})

@app.route("/api/contacts/import", methods=["POST"])
def import_contacts_csv():
    """Import contacts from a CSV file (columns: name, phone_number, email)"""
    if not SUPABASE_URL:
        return error("Supabase not configured")
    if "file" not in request.files:
        return error("No file provided")

    file    = request.files["file"]
    content = file.read().decode("utf-8-sig")  # utf-8-sig strips BOM
    reader  = csv.DictReader(io.StringIO(content))

    inserted = 0
    errors   = []
    rows     = []

    for i, row in enumerate(reader):
        name  = (row.get("name") or row.get("Name") or "").strip()
        phone = (row.get("phone_number") or row.get("phone") or row.get("Phone") or "").strip()
        email = (row.get("email") or row.get("Email") or "").strip()
        if not name and not phone:
            errors.append(f"Row {i+2}: missing name and phone")
            continue
        rows.append({"name": name, "phone_number": phone, "email": email,
                     "created_at": datetime.utcnow().isoformat()})

    if rows:
        r = requests.post(sb_url("contacts"),
                          headers={**sb_headers(), "Prefer": "return=representation"},
                          json=rows)
        if r.status_code in [200, 201]:
            inserted = len(rows)
        else:
            return error(f"Supabase error: {r.text}")

    return jsonify({"inserted": inserted, "errors": errors})

@app.route("/api/contacts/<int:contact_id>", methods=["GET"])
def get_contact(contact_id):
    if SUPABASE_URL:
        r = requests.get(sb_url("contacts"), headers=sb_headers(),
                         params={"id": f"eq.{contact_id}", "select": "*"})
        rows = r.json() if r.status_code == 200 else []
        if rows:
            return jsonify(rows[0])
    r = requests.get(cw_url(f"contacts/{contact_id}"), headers=cw_headers())
    return jsonify(r.json()), r.status_code

@app.route("/api/contacts/<int:contact_id>/conversations", methods=["GET"])
def get_contact_conversations(contact_id):
    r = requests.get(cw_url(f"contacts/{contact_id}/conversations"), headers=cw_headers())
    return jsonify(r.json()), r.status_code

# ── AGENTS (Supabase-only) ────────────────────────────────────────────────────
@app.route("/api/agents", methods=["GET"])
def get_agents():
    if not SUPABASE_URL:
        return jsonify({"agents": []})
    r = requests.get(sb_url("agents"), headers=sb_headers(),
                     params={"select": "id,name,email,role,created_at", "order": "created_at.asc"})
    agents = r.json() if r.status_code == 200 else []
    return jsonify({"agents": agents})

@app.route("/api/agents", methods=["POST"])
def create_agent():
    data = request.json
    name, email, password = data.get("name"), data.get("email"), data.get("password")
    if not all([name, email, password]):
        return error("name, email and password are required")
    if not SUPABASE_URL:
        return error("Supabase not configured")
    payload = {
        "name": name, "email": email, "password": password,
        "role": data.get("role", "agent"),
        "created_at": datetime.utcnow().isoformat()
    }
    r = requests.post(sb_url("agents"),
                      headers={**sb_headers(), "Prefer": "return=representation"},
                      json=payload)
    if r.status_code in [200, 201]:
        return jsonify({"success": True, "agent": r.json()}), 201
    return error(f"Supabase error: {r.text}")

@app.route("/api/agents/<int:agent_id>", methods=["DELETE"])
def delete_agent(agent_id):
    if not SUPABASE_URL:
        return error("Supabase not configured")
    requests.delete(sb_url("agents"), headers=sb_headers(), params={"id": f"eq.{agent_id}"})
    return ok()

# ── INBOXES ───────────────────────────────────────────────────────────────────
@app.route("/api/inboxes", methods=["GET"])
def get_inboxes():
    r = requests.get(cw_url("inboxes"), headers=cw_headers())
    return jsonify(r.json()), r.status_code

# ── REPORTS ───────────────────────────────────────────────────────────────────
@app.route("/api/reports/summary", methods=["GET"])
def get_report_summary():
    """Build a reports/analytics summary from live Chatwoot conversations and
    the Supabase agents table — never returns empty even if the Chatwoot
    /reports/* endpoints (which require Enterprise) are unavailable.
    """
    overview = {
        "open_conversations_count":         0,
        "pending_conversations_count":      0,
        "resolved_conversations_count":     0,
        "unattended_conversations_count":   0,
        "agents_online":                    0,
        "agents":                           [],
        "account": {
            "open":      0,
            "pending":   0,
            "resolved":  0,
            "total":     0,
        },
        "channels":           {},          # whatsapp / email / web etc.
        "recent_activity":    [],
        "messages_last_24h":  0,
    }

    # ── 1. Walk every conversation status to build counts ──
    statuses = ("open", "pending", "resolved")
    all_convs = {s: [] for s in statuses}
    try:
        for s in statuses:
            page = 1
            while page <= 6:   # cap at 6 pages = 150 convs per status
                cr = requests.get(cw_url("conversations"),
                                  headers=cw_headers(),
                                  params={"page": page, "status": s,
                                          "assignee_type": "all"},
                                  timeout=10)
                if cr.status_code != 200:
                    break
                payload = cr.json().get("data", {}).get("payload", [])
                if not payload:
                    break
                all_convs[s].extend(payload)
                if len(payload) < 25:
                    break
                page += 1
    except Exception as e:
        print(f"[reports] Chatwoot fetch failed: {e}")

    overview["open_conversations_count"]     = len(all_convs["open"])
    overview["pending_conversations_count"]  = len(all_convs["pending"])
    overview["resolved_conversations_count"] = len(all_convs["resolved"])
    overview["account"]["open"]      = overview["open_conversations_count"]
    overview["account"]["pending"]   = overview["pending_conversations_count"]
    overview["account"]["resolved"]  = overview["resolved_conversations_count"]
    overview["account"]["total"]     = (overview["open_conversations_count"] +
                                        overview["pending_conversations_count"] +
                                        overview["resolved_conversations_count"])

    # Unattended = open conversations with NO assignee
    unatt = sum(1 for c in all_convs["open"]
                if not (c.get("meta", {}) or {}).get("assignee"))
    overview["unattended_conversations_count"] = unatt

    # Channel breakdown (open + pending)
    for c in all_convs["open"] + all_convs["pending"]:
        ch = (c.get("meta") or {}).get("channel") or c.get("channel") or "unknown"
        overview["channels"][ch] = overview["channels"].get(ch, 0) + 1

    # Messages in the last 24h
    cutoff = datetime.utcnow().timestamp() - 86400
    overview["messages_last_24h"] = sum(
        1 for c in all_convs["open"] + all_convs["pending"]
        if (c.get("last_activity_at") or 0) > cutoff
    )

    # Recent activity feed — last 8 conversations across all statuses
    flat = (all_convs["open"] + all_convs["pending"] +
            all_convs["resolved"][:25])
    flat.sort(key=lambda c: c.get("last_activity_at", 0), reverse=True)
    overview["recent_activity"] = [{
        "id":        c.get("id"),
        "name":      ((c.get("meta") or {}).get("sender") or {}).get("name") or "Unknown",
        "status":    c.get("status"),
        "channel":   (c.get("meta") or {}).get("channel"),
        "ts":        c.get("last_activity_at"),
        "assignee":  ((c.get("meta") or {}).get("assignee") or {}).get("name"),
    } for c in flat[:8]]

    # ── 2. Per-agent stats ──
    agents = []
    if SUPABASE_URL:
        try:
            ar = requests.get(sb_url("agents"), headers=sb_headers(),
                              params={"select": "*"}, timeout=10)
            if ar.status_code == 200:
                agents = ar.json() or []
        except Exception as e:
            print(f"[reports] Supabase agents failed: {e}")

    agent_stats = []
    for ag in agents:
        aid = ag.get("id")
        name = ag.get("name") or ag.get("email") or f"Agent #{aid}"
        is_online = bool(ag.get("availability") == "online" or ag.get("online"))

        # count assigned open / resolved by walking the cached convs
        open_count = sum(
            1 for c in all_convs["open"]
            if ((c.get("meta") or {}).get("assignee") or {}).get("id") == aid
            or c.get("_sb_assigned_to") == aid
        )
        resolved_count = sum(
            1 for c in all_convs["resolved"]
            if ((c.get("meta") or {}).get("assignee") or {}).get("id") == aid
            or c.get("_sb_assigned_to") == aid
        )
        agent_stats.append({
            "id":       aid,
            "name":     name,
            "email":    ag.get("email"),
            "online":   is_online,
            "role":     ag.get("role") or "agent",
            "open":     open_count,
            "resolved": resolved_count,
        })

    overview["agents"]        = agent_stats
    overview["agents_online"] = sum(1 for a in agent_stats if a["online"])

    # Backwards-compat — try the Chatwoot /reports endpoint if available
    raw_conversations = {}
    try:
        r = requests.get(cw_url("reports/agents/conversations"),
                         headers=cw_headers(), timeout=8,
                         params={"since": request.args.get("since", ""),
                                 "until": request.args.get("until", "")})
        if r.status_code == 200:
            raw_conversations = r.json()
    except Exception:
        pass

    return jsonify({"conversations": raw_conversations, "overview": overview})

# ── KNOWLEDGE BASE ────────────────────────────────────────────────────────────
@app.route("/api/knowledge", methods=["GET"])
def get_knowledge():
    if not SUPABASE_URL:
        return jsonify([])
    q        = request.args.get("q", "")
    category = request.args.get("category", "")
    params   = {"select": "*", "order": "updated_at.desc"}
    if category:
        params["category"] = f"eq.{category}"
    r        = requests.get(sb_url("knowledge_base"), headers=sb_headers(), params=params)
    articles = r.json() if r.status_code == 200 else []
    if q and isinstance(articles, list):
        ql       = q.lower()
        articles = [a for a in articles if
                    ql in (a.get("title","") or "").lower() or
                    ql in (a.get("content","") or "").lower() or
                    ql in (a.get("tags","") or "").lower()]
    return jsonify(articles)

@app.route("/api/knowledge", methods=["POST"])
def create_knowledge():
    if not SUPABASE_URL:
        return error("Supabase not configured")
    data    = request.json
    title   = data.get("title","").strip()
    content = data.get("content","").strip()
    if not title or not content:
        return error("title and content are required")
    now     = datetime.utcnow().isoformat()
    payload = {
        "title": title, "content": content,
        "category": data.get("category","General"),
        "tags": data.get("tags",""),
        "created_by": data.get("created_by","Admin"),
        "created_at": now, "updated_at": now
    }
    r = requests.post(sb_url("knowledge_base"),
                      headers={**sb_headers(), "Prefer": "return=representation"},
                      json=payload)
    if r.status_code in [200, 201]:
        result = r.json()
        return jsonify(result[0] if isinstance(result, list) else result), 201
    return error(f"Supabase error: {r.text}")

@app.route("/api/knowledge/<int:article_id>", methods=["PUT"])
def update_knowledge(article_id):
    if not SUPABASE_URL:
        return error("Supabase not configured")
    data    = request.json
    payload = {k: v for k, v in {
        "title":      data.get("title"),
        "content":    data.get("content"),
        "category":   data.get("category"),
        "tags":       data.get("tags"),
        "updated_at": datetime.utcnow().isoformat()
    }.items() if v is not None}
    r = requests.patch(sb_url("knowledge_base"),
                       headers={**sb_headers(), "Prefer": "return=representation"},
                       params={"id": f"eq.{article_id}"}, json=payload)
    if r.status_code in [200, 201]:
        result = r.json()
        return jsonify(result[0] if isinstance(result, list) else result)
    return error(f"Supabase error: {r.text}")

@app.route("/api/knowledge/<int:article_id>", methods=["DELETE"])
def delete_knowledge(article_id):
    if not SUPABASE_URL:
        return error("Supabase not configured")
    requests.delete(sb_url("knowledge_base"), headers=sb_headers(),
                    params={"id": f"eq.{article_id}"})
    return ok()

@app.route("/api/knowledge/categories", methods=["GET"])
def get_knowledge_categories():
    if not SUPABASE_URL:
        return jsonify([])
    r        = requests.get(sb_url("knowledge_base"), headers=sb_headers(),
                            params={"select": "category"})
    articles = r.json() if r.status_code == 200 else []
    cats     = sorted(set(a.get("category","General") for a in articles if isinstance(a, dict)))
    return jsonify(cats)


# ═════════════════════════════════════════════════════════════════════════════
#  WHATSAPP CLOUD API — BROADCAST ENDPOINTS
#  (ported from server.py provided by user — keeps same routes & behavior)
# ═════════════════════════════════════════════════════════════════════════════

WA_PHONE_ID = os.getenv("WA_PHONE_ID") or os.getenv("META_PHONE_ID", "999181363279176")
WA_WABA_ID  = os.getenv("WA_WABA_ID")  or os.getenv("META_WABA_ID",  "3141505256037886")
WA_TOKEN    = os.getenv("WA_TOKEN")    or os.getenv("META_TOKEN",    "EAAThZAdjx1kQBReHhV2U47QyCfRDi9vVFJzdzxEVv6QGcYMrfOg8mHFCYIrbvEZAizHg7OAK0edfw7es9hFqh7ZCYZBFAI9Bc3A89zTsoL3n3In1zfGkEFWvSi4RZAAtWSTGNffSo8eZBvkZA9CQScP8gB6pkV70VVpQaXYlvoMzVODxiB0O4HARfZCI7cZCamgZDZD")
WA_API_VER  = os.getenv("WA_API_VER",  "v20.0")
WA_BASE     = f"https://graph.facebook.com/{WA_API_VER}"

def wa_get(path):
    try:
        r = requests.get(f"{WA_BASE}{path}",
                         headers={"Authorization": f"Bearer {WA_TOKEN}"},
                         timeout=60)
        return r.status_code, r.json()
    except Exception as e:
        return 500, {"error": {"message": str(e)}}

def wa_post(path, body):
    try:
        r = requests.post(f"{WA_BASE}{path}",
                          headers={"Authorization": f"Bearer {WA_TOKEN}",
                                   "Content-Type": "application/json"},
                          json=body, timeout=15)
        return r.status_code, r.json()
    except Exception as e:
        return 500, {"error": {"message": str(e)}}

@app.route("/api/me", methods=["GET"])
def wa_me():
    c1, phone_data = wa_get(f"/{WA_PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,platform_type,throughput,code_verification_status")
    c2, waba_data  = wa_get(f"/{WA_WABA_ID}?fields=name,currency,timezone_id,account_review_status,message_template_namespace")
    return jsonify({
        "phone":      phone_data if c1 == 200 else {},
        "waba":       waba_data  if c2 == 200 else {},
        "phoneError": phone_data.get("error", {}).get("message") if c1 != 200 else None,
        "wabaError":  waba_data.get("error",  {}).get("message") if c2 != 200 else None,
    })

@app.route("/api/templates", methods=["GET"])
def wa_templates():
    code, data = wa_get(f"/{WA_WABA_ID}/message_templates?fields=name,status,language,category,components,id&limit=100")
    return jsonify(data), code

@app.route("/api/phonenumbers", methods=["GET"])
def wa_phonenumbers():
    code, data = wa_get(f"/{WA_WABA_ID}/phone_numbers?fields=display_phone_number,verified_name,quality_rating,status,id")
    return jsonify(data), code

@app.route("/api/send", methods=["POST"])
def wa_send():
    body = request.get_json(force=True) or {}
    to       = str(body.get("to", "")).strip().replace(" ", "").replace("+", "").replace("-", "")
    tpl_name = body.get("template")
    lang     = body.get("language", "en")
    params   = body.get("parameters", [])
    if not to or not tpl_name:
        return jsonify({"error": {"message": "to and template required"}}), 400
    components = []
    if params:
        components.append({"type": "body",
                           "parameters": [{"type": "text", "text": str(x)} for x in params]})
    payload = {"messaging_product": "whatsapp", "to": to, "type": "template",
               "template": {"name": tpl_name, "language": {"code": lang}, "components": components}}
    code, data = wa_post(f"/{WA_PHONE_ID}/messages", payload)
    return jsonify(data), code

@app.route("/api/broadcast", methods=["POST"])
def wa_broadcast():
    body = request.get_json(force=True) or {}
    contacts = body.get("contacts", [])
    tpl_name = body.get("template")
    lang     = body.get("language", "en")
    if not contacts or not tpl_name:
        return jsonify({"error": {"message": "contacts and template required"}}), 400
    results = {"sent": 0, "failed": 0, "errors": []}
    for c in contacts:
        to     = str(c.get("to", "")).strip().replace(" ", "").replace("+", "").replace("-", "")
        params = c.get("parameters", [])
        if len(to) < 7:
            results["failed"] += 1
            continue
        components = []
        if params:
            components.append({"type": "body",
                               "parameters": [{"type": "text", "text": str(x)} for x in params]})
        payload = {"messaging_product": "whatsapp", "to": to, "type": "template",
                   "template": {"name": tpl_name, "language": {"code": lang}, "components": components}}
        code, resp = wa_post(f"/{WA_PHONE_ID}/messages", payload)
        if code == 200:
            results["sent"] += 1
        else:
            results["failed"] += 1
            results["errors"].append({"to": to,
                                      "error": resp.get("error", {}).get("message", "failed")})
    return jsonify(results)

@app.route("/api/create_template", methods=["POST"])
def wa_create_template():
    body = request.get_json(force=True) or {}
    code, data = wa_post(f"/{WA_WABA_ID}/message_templates", body)
    return jsonify(data), code

@app.route("/api/delete_template", methods=["POST"])
def wa_delete_template():
    body = request.get_json(force=True) or {}
    name = body.get("name")
    if not name:
        return jsonify({"error": {"message": "name required"}}), 400
    try:
        from urllib.parse import quote
        r = requests.delete(f"{WA_BASE}/{WA_WABA_ID}/message_templates?name={quote(name)}",
                            headers={"Authorization": f"Bearer {WA_TOKEN}"}, timeout=10)
        if r.status_code == 200:
            return jsonify({"deleted": True})
        return jsonify(r.json()), r.status_code
    except Exception as e:
        return jsonify({"error": {"message": str(e)}}), 500


if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV","development") == "development"
    print("\n╔══════════════════════════════════╗")
    print("║      Talkzi Server starting     ║")
    print("╚══════════════════════════════════╝")
    print(f"  Chatwoot: {CHATWOOT_URL}")
    print(f"  Supabase: {'✓ configured' if SUPABASE_URL else '✗ not set'}")
    print(f"  WhatsApp: phone={WA_PHONE_ID} waba={WA_WABA_ID}")
    print(f"  Running at: http://0.0.0.0:{port}\n")
    app.run(debug=debug, host="0.0.0.0", port=port)
