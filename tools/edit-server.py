#!/usr/bin/env python3
"""Local preview server with an on-page copy editor.

    python3 tools/edit-server.py        → http://localhost:8000/

Serves the site like `python3 -m http.server`, but every HTML page gets an
"Edit text" button. In edit mode, headings, paragraphs, buttons, links, etc.
become editable in place; "Save" writes the changed text straight back into
that page's .html file. Local use only — never deploy this file.

How saving stays safe: when a page is served, each editable element is tagged
with data-ed="N", numbered in source order by a parser. Saving re-parses the
file on disk the same way and replaces only the inner HTML of element N. A
version token (the file's mtime) rejects saves against a file that changed
since the page loaded.
"""
import html
import http.server
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

# Elements whose text can be edited.
TEXT_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "button",
             "label", "span", "em", "strong", "small", "figcaption",
             "blockquote", "td", "th", "dt", "dd", "summary", "legend", "option"}
# An element containing any of these isn't a simple text block — skip it.
NON_TEXT = {"div", "section", "ul", "ol", "img", "svg", "input", "select",
            "textarea", "form", "table", "script", "style", "picture",
            "video", "iframe", "nav", "header", "footer", "canvas"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "source", "track", "wbr", "param"}
SKIP_INSIDE = {"script", "style", "svg", "head", "template", "select"}


class Scanner(HTMLParser):
    """Finds editable elements and their exact source offsets."""

    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.line_starts = [0] + [m.end() for m in re.finditer("\n", src)]
        self.stack = []      # [tag, tag_start, inner_start, has_non_text]
        self.found = []      # (tag_start, tag_name_end, inner_start, inner_end)

    def src_pos(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.src_pos()
        text = self.get_starttag_text() or ""
        for frame in self.stack:
            if tag in NON_TEXT or tag in TEXT_TAGS - {"em", "strong", "small", "span", "a"}:
                frame[3] = True
        if tag in VOID:
            return
        self.stack.append([tag, start, start + len(text), False])

    def handle_startendtag(self, tag, attrs):
        for frame in self.stack:
            if tag in NON_TEXT:
                frame[3] = True

    def handle_endtag(self, tag):
        end = self.src_pos()
        # Pop to the matching open tag (tolerates sloppy nesting).
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                frame = self.stack[i]
                del self.stack[i:]
                self.record(frame, end)
                return

    def record(self, frame, inner_end):
        tag, start, inner_start, has_non_text = frame
        if tag not in TEXT_TAGS or has_non_text:
            return
        if any(f[0] in SKIP_INSIDE for f in self.stack):
            return
        if not self.src[inner_start:inner_end].strip():
            return
        self.found.append((start, start + 1 + len(tag), inner_start, inner_end))

    def editable(self):
        """Outermost text elements only (a <p> wins over the <a> inside it)."""
        self.found.sort()
        result, last_end = [], -1
        for item in self.found:
            if item[0] >= last_end:
                result.append(item)
                last_end = item[3]
            # else: nested inside an element already chosen
        return result


def scan(src):
    s = Scanner(src)
    s.feed(src)
    return s.editable()


def version(path):
    return str(os.stat(path).st_mtime_ns)


EDITOR_JS = r"""
(() => {
  const els = [...document.querySelectorAll('[data-ed]')];
  const page = location.pathname.replace(/^\//, '') || 'index.html';
  const ver = document.documentElement.dataset.edVersion;
  const bar = document.createElement('div');
  bar.id = '__edbar';
  bar.innerHTML = '<span id="__edmsg"></span><button id="__edsave" hidden>Save</button><button id="__edcancel" hidden>Cancel</button><button id="__edtoggle">Edit text</button>';
  document.body.appendChild(bar);
  const st = document.createElement('style');
  st.textContent = `
    #__edbar{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483647;display:flex;gap:8px;align-items:center;font:500 13px/1 system-ui,sans-serif;letter-spacing:0;text-transform:none}
    #__edbar button{padding:10px 16px;border-radius:999px;border:0;cursor:pointer;font:inherit;background:#f7efe0;color:#3a2418;box-shadow:0 2px 10px rgba(0,0,0,.35)}
    #__edbar #__edsave{background:#f2b8c6}
    #__edmsg{color:#f7efe0;background:rgba(0,0,0,.55);padding:8px 12px;border-radius:999px}
    #__edmsg:empty{display:none}
    html.__editing [data-ed]{outline:1px dashed rgba(242,184,198,.7);outline-offset:3px;cursor:text}
    html.__editing [data-ed]:hover{outline:2px solid #f2b8c6}
    html.__editing [data-ed]:focus{outline:2px solid #f2b8c6;background:rgba(242,184,198,.12)}
    html.__editing [data-ed].__changed{outline:2px solid #f7d36b}`;
  document.head.appendChild(st);
  const $ = id => document.getElementById(id);
  const msg = t => { $('__edmsg').textContent = t; };
  let original = new Map(), editing = false;

  const blockClicks = e => {
    if (!editing || e.target.closest('#__edbar')) return;
    if (e.target.closest('a,button,[data-ed]')) { e.preventDefault(); }
  };
  document.addEventListener('click', blockClicks, true);
  document.addEventListener('submit', e => { if (editing) e.preventDefault(); }, true);

  function setEditing(on) {
    editing = on;
    document.documentElement.classList.toggle('__editing', on);
    els.forEach(el => {
      el.contentEditable = on ? 'true' : 'false';
      if (on) original.set(el, el.innerHTML);
      el.classList.remove('__changed');
    });
    $('__edtoggle').hidden = on;
    $('__edsave').hidden = $('__edcancel').hidden = !on;
    msg(on ? 'Click any outlined text to edit' : '');
  }
  els.forEach(el => {
    el.addEventListener('input', () => el.classList.toggle('__changed', el.innerHTML !== original.get(el)));
    el.addEventListener('keydown', e => {
      if (!editing) return;
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); }
    });
    // Paste as plain text so formatting from Word/Docs doesn't sneak in.
    el.addEventListener('paste', e => {
      if (!editing) return;
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
  });

  $('__edtoggle').onclick = () => setEditing(true);
  $('__edcancel').onclick = () => {
    els.forEach(el => { if (original.has(el)) el.innerHTML = original.get(el); });
    setEditing(false);
  };
  $('__edsave').onclick = async () => {
    const edits = els.filter(el => el.innerHTML !== original.get(el))
      .map(el => ({ id: +el.dataset.ed, html: el.innerHTML.replace(/&nbsp;/g, ' ') }));
    if (!edits.length) { setEditing(false); return; }
    msg('Saving…');
    try {
      const r = await fetch('/__save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, version: ver, edits }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      msg('Saved ✓'); setTimeout(() => location.reload(), 600);
    } catch (err) { msg('Not saved: ' + err.message); }
  };
})();
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def page_path(self, url_path):
        rel = url_path.split("?")[0].split("#")[0].lstrip("/") or "index.html"
        if rel.endswith("/"):
            rel += "index.html"
        full = os.path.realpath(os.path.join(ROOT, rel))
        if not full.startswith(ROOT + os.sep) or not full.endswith(".html"):
            return None
        return full if os.path.isfile(full) else None

    def send_body(self, code, body, ctype):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/__edit.js"):
            return self.send_body(200, EDITOR_JS, "application/javascript; charset=utf-8")
        path = self.page_path(self.path)
        if not path:
            return super().do_GET()
        with open(path, encoding="utf-8") as f:
            src = f.read()
        out = src
        for n, (start, name_end, _, _) in reversed(list(enumerate(scan(src)))):
            out = out[:name_end] + f' data-ed="{n}"' + out[name_end:]
        out = re.sub(r"<html\b", f'<html data-ed-version="{version(path)}"', out, count=1)
        tag = '<script src="/__edit.js"></script>\n'
        i = out.lower().rfind("</body>")
        out = out[:i] + tag + out[i:] if i >= 0 else out + tag
        self.send_body(200, out, "text/html; charset=utf-8")

    def do_POST(self):
        if self.path != "/__save":
            return self.send_body(404, '{"error":"not found"}', "application/json")
        try:
            req = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            path = self.page_path("/" + req["page"])
            if not path:
                raise ValueError("unknown page")
            if req["version"] != version(path):
                raise ValueError("this page changed since you opened it — reload and redo your edit")
            with open(path, encoding="utf-8") as f:
                src = f.read()
            spans = scan(src)
            edits = sorted(req["edits"], key=lambda e: e["id"], reverse=True)
            for e in edits:
                _, _, a, b = spans[int(e["id"])]
                new = e["html"]
                # Keep the source's indentation style for multi-line blocks.
                if src[a:b].startswith("\n") and not new.startswith("\n"):
                    lead = re.match(r"\n[ \t]*", src[a:b]).group(0)
                    trail = re.search(r"\n[ \t]*$", src[a:b])
                    new = lead + new.strip() + (trail.group(0) if trail else "")
                src = src[:a] + new + src[b:]
            with open(path, "w", encoding="utf-8") as f:
                f.write(src)
            print(f"  saved {len(edits)} edit(s) to {os.path.relpath(path, ROOT)}")
            self.send_body(200, '{"ok":true}', "application/json")
        except Exception as err:
            self.send_body(400, json.dumps({"error": str(err)}), "application/json")

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    print(f"Dutchy site with editing → http://localhost:{PORT}/   (Ctrl+C to stop)")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
