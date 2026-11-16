"""
Verdenskart API - Backend for real-time multiplayer country map game.
Supports 1-16 players typing simultaneously in real-time.
Modes:
 - Kappløp (FFA - Free for all): First to type a country claims it.
 - Samarbeid (Co-op): Players work together to fill out the world map.
 - Lagkamp (Team Red vs Blue): Teams compete to conquer the most countries.
"""

import json
import os
import random
import re
import string
import threading
import time
import unicodedata
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "countries.json")

# -----------------------------------------------------------------------------
# COUNTRY DATABASE & ALIAS NORMALIZATION
# -----------------------------------------------------------------------------

_COUNTRY_LIST: List[Dict[str, Any]] = []
_COUNTRIES_BY_ID: Dict[str, Dict[str, Any]] = {}
_ALIAS_TO_ID: Dict[str, str] = {}
_DEPENDENCIES: Dict[str, str] = {
    "gl": "dk",  # Greenland -> Denmark
    "gf": "fr",  # French Guiana -> France
    "pr": "us",  # Puerto Rico -> USA
    "sj": "no",  # Svalbard -> Norway
    "fo": "dk",  # Faroe Islands -> Denmark
    "eh": "ma",  # Western Sahara -> Morocco
}

PLAYER_PALETTE = [
    {"color": "#38bdf8", "name": "Himmelblå"},
    {"color": "#ef4444", "name": "Karmosinrød"},
    {"color": "#10b981", "name": "Smaragdgrønn"},
    {"color": "#fbbf24", "name": "Solgul"},
    {"color": "#a855f7", "name": "Neon Lilla"},
    {"color": "#f97316", "name": "Ild Oransje"},
    {"color": "#ec4899", "name": "Cyber Rosa"},
    {"color": "#06b6d4", "name": "Turkis"},
    {"color": "#84cc16", "name": "Giftgrønn"},
    {"color": "#6366f1", "name": "Indigo Blå"},
    {"color": "#14b8a6", "name": "Teal Frost"},
    {"color": "#d946ef", "name": "Fuchsia"},
    {"color": "#eab308", "name": "Gull Pokal"},
    {"color": "#3b82f6", "name": "Kongeblå"},
    {"color": "#f43f5e", "name": "Rubin"},
    {"color": "#22c55e", "name": "Militærgrønn"},
]

CLEAN_ROOM_CODES = [
    "KART", "GLOB", "ATLA", "VERD", "NORG", "KAPP", "REIS", "LAND",
    "SØR", "NORD", "ØST", "VEST", "FJORD", "FJELL", "BYER", "HAV"
]


def strip_accents(s: str) -> str:
    """Normalize and remove diacritics / accents (e.g. é -> e, ø -> o, å -> a)."""
    s = s.replace("æ", "ae").replace("ø", "o").replace("å", "a")
    s = s.replace("Æ", "ae").replace("Ø", "o").replace("Å", "a")
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def normalize_input(raw: str) -> str:
    """Produces clean, lowercase, alphanumeric-only key for matching."""
    if not raw:
        return ""
    text = raw.lower().strip()
    # Normalize punctuation and hyphens
    text = re.sub(r"[\s\-_'\.\,\/]+", " ", text).strip()
    return text


def normalize_strict_key(raw: str) -> str:
    """Strict key without spaces or accents for robust fuzzy match."""
    cleaned = strip_accents(normalize_input(raw))
    return re.sub(r"[^a-z0-9]", "", cleaned)


def _load_countries() -> None:
    global _COUNTRY_LIST, _COUNTRIES_BY_ID, _ALIAS_TO_ID
    if _COUNTRY_LIST:
        return

    if not os.path.isfile(DATA_FILE):
        return

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        _COUNTRY_LIST = json.load(f)

    for item in _COUNTRY_LIST:
        cid = item["id"].lower()
        _COUNTRIES_BY_ID[cid] = item

        # Register primary names
        for name in [item.get("name_no", ""), item.get("name_en", "")]:
            if name:
                _ALIAS_TO_ID[normalize_input(name)] = cid
                _ALIAS_TO_ID[normalize_strict_key(name)] = cid

        # Register aliases
        for alias in item.get("aliases", []):
            if alias:
                _ALIAS_TO_ID[normalize_input(alias)] = cid
                _ALIAS_TO_ID[normalize_strict_key(alias)] = cid

    # Additional handy aliases
    extra_aliases = {
        "usa": "us",
        "united states": "us",
        "united states of america": "us",
        "amerika": "us",
        "u s a": "us",
        "us": "us",
        "uk": "gb",
        "united kingdom": "gb",
        "storbritannia": "gb",
        "england": "gb",
        "great britain": "gb",
        "britain": "gb",
        "skottland": "gb",
        "wales": "gb",
        "uae": "ae",
        "de forente arabiske emirater": "ae",
        "emirates": "ae",
        "drc": "cd",
        "dr congo": "cd",
        "dr kongo": "cd",
        "zaire": "cd",
        "car": "cf",
        "sentralafrika": "cf",
        "holland": "nl",
        "nederland": "nl",
        "netherlands": "nl",
        "the netherlands": "nl",
        "sør korea": "kr",
        "south korea": "kr",
        "korea": "kr",
        "nord korea": "kp",
        "north korea": "kp",
        "russland": "ru",
        "russia": "ru",
        "tyskland": "de",
        "germany": "de",
        "frankrike": "fr",
        "france": "fr",
        "spania": "es",
        "spain": "es",
        "italia": "it",
        "italy": "it",
        "sveits": "ch",
        "switzerland": "ch",
        "vatikanstaten": "va",
        "vatican": "va",
        "vatican city": "va",
        "holy see": "va",
        "palestina": "ps",
        "palestine": "ps",
        "taiwan": "tw",
        "kosovo": "xk",
        "tsjekkia": "cz",
        "czechia": "cz",
        "czech republic": "cz",
        "elfenbenskysten": "ci",
        "ivory coast": "ci",
        "cote d ivoire": "ci",
        "eswatini": "sz",
        "swaziland": "sz",
        "kapp verde": "cv",
        "cape verde": "cv",
        "cabo verde": "cv",
        "sao tome": "st",
        "sao tome og principe": "st",
        "st kitts": "kn",
        "st lucia": "lc",
        "st vincent": "vc",
        "ost timor": "tl",
        "east timor": "tl",
        "timor leste": "tl",
        "myanmar": "mm",
        "burma": "mm",
        "bosnia": "ba",
        "trinidad": "tt",
        "marshalloyene": "mh",
        "salomonoyene": "sb",
        "new zealand": "nz",
        "aotearoa": "nz",
    }
    for alias, cid in extra_aliases.items():
        _ALIAS_TO_ID[normalize_input(alias)] = cid
        _ALIAS_TO_ID[normalize_strict_key(alias)] = cid


_load_countries()


# -----------------------------------------------------------------------------
# ROOM MODEL
# -----------------------------------------------------------------------------

_rooms: Dict[str, "VerdenskartRoom"] = {}
_rooms_lock = threading.RLock()


class VerdenskartRoom:
    def __init__(
        self,
        code: str,
        host_name: str = "Vert",
        host_color: Optional[str] = None,
        host_avatar: Optional[str] = None,
        mode: str = "ffa",  # "ffa" (kappløp), "coop" (samarbeid), "team" (lagkamp)
        time_limit: int = 0,  # 0 = ubegrenset / ingen timer
        region: str = "all",  # "all", "Europa", "Asia", "Afrika", "Amerika", "Oseania"
    ) -> None:
        self.code = code
        self.lock = threading.RLock()
        self.mode = mode if mode in ("ffa", "coop", "team") else "ffa"
        self.time_limit = int(time_limit)
        self.region = region or "all"
        self.status = "lobby"  # "lobby", "playing", "finished"
        self.created_at = time.time()
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.version = 1

        self.host_id = f"host_{uuid.uuid4().hex[:8]}"
        self.host_token = uuid.uuid4().hex

        # Players dictionary: pid -> dict
        self.players: Dict[str, Dict[str, Any]] = {}
        # Discovered countries: cid -> dict
        self.discovered: Dict[str, Dict[str, Any]] = {}
        # Live activity feed: list of recent discovery objects
        self.feed: List[Dict[str, Any]] = []

        # Add Host
        c = host_color or PLAYER_PALETTE[0]["color"]
        self.players[self.host_id] = {
            "id": self.host_id,
            "name": host_name[:20] or "Vert",
            "color": c,
            "avatar": host_avatar or "char:h1:c_ffd166:r1:e1:m1",
            "score": 0,
            "team": "red",
            "is_ready": True,
            "is_host": True,
            "joined_at": time.time(),
        }

    def _get_target_countries(self) -> List[Dict[str, Any]]:
        _load_countries()
        if self.region == "all":
            return _COUNTRY_LIST
        return [c for c in _COUNTRY_LIST if c.get("continent", "").lower() == self.region.lower()]

    def add_player(
        self,
        name: str,
        color: Optional[str] = None,
        avatar: Optional[str] = None,
        team: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        if len(self.players) >= 16:
            return None

        pid = f"p_{uuid.uuid4().hex[:8]}"
        used_colors = {p["color"] for p in self.players.values()}
        avail_colors = [p["color"] for p in PLAYER_PALETTE if p["color"] not in used_colors]
        chosen_color = color if (color and color not in used_colors) else (avail_colors[0] if avail_colors else random.choice(PLAYER_PALETTE)["color"])

        # Auto-balance team if team mode
        if not team:
            red_count = sum(1 for p in self.players.values() if p.get("team") == "red")
            blue_count = sum(1 for p in self.players.values() if p.get("team") == "blue")
            team = "red" if red_count <= blue_count else "blue"

        player = {
            "id": pid,
            "name": (name or f"Spiller {len(self.players) + 1}")[:20],
            "color": chosen_color,
            "avatar": avatar or "char:h1:c_ffd166:r1:e1:m1",
            "score": 0,
            "team": team,
            "is_ready": False,
            "is_host": False,
            "joined_at": time.time(),
        }
        self.players[pid] = player
        self.version += 1
        return player

    def remove_player(self, pid: str) -> None:
        if pid in self.players:
            del self.players[pid]
            self.version += 1

    def update_player(
        self,
        pid: str,
        name: Optional[str] = None,
        color: Optional[str] = None,
        avatar: Optional[str] = None,
        team: Optional[str] = None,
        ready: Optional[bool] = None,
    ) -> bool:
        if pid not in self.players:
            return False
        p = self.players[pid]
        if name:
            p["name"] = name[:20]
        if color:
            p["color"] = color
        if avatar:
            p["avatar"] = avatar
        if team and team in ("red", "blue"):
            p["team"] = team
        if ready is not None:
            p["is_ready"] = bool(ready)
        self.version += 1
        return True

    def start_game(
        self,
        mode: Optional[str] = None,
        time_limit: Optional[int] = None,
        region: Optional[str] = None,
    ) -> None:
        if mode:
            self.mode = mode
        if time_limit is not None:
            self.time_limit = int(time_limit)
        if region:
            self.region = region

        self.status = "playing"
        self.start_time = time.time()
        if self.time_limit > 0:
            self.end_time = self.start_time + self.time_limit
        else:
            self.end_time = None

        self.discovered.clear()
        self.feed.clear()
        for p in self.players.values():
            p["score"] = 0
            p["is_ready"] = True
        self.version += 1

    def submit_guess(self, player_id: str, guess_text: str) -> Dict[str, Any]:
        _load_countries()
        now = time.time()

        # Check if time expired
        if self.status == "playing" and self.end_time and now >= self.end_time:
            self.status = "finished"
            self.version += 1
            return {"ok": False, "status": "time_expired", "error": "Tiden er ute!"}

        if self.status != "playing":
            return {"ok": False, "status": "not_playing", "error": "Spillet er ikke i gang."}

        player = self.players.get(player_id)
        if not player:
            return {"ok": False, "status": "unknown_player", "error": "Ukjent spiller."}

        raw = (guess_text or "").strip()
        if not raw or len(raw) < 2:
            return {"ok": False, "status": "too_short"}

        # 1. Match alias
        key_norm = normalize_input(raw)
        key_strict = normalize_strict_key(raw)
        matched_cid = _ALIAS_TO_ID.get(key_norm) or _ALIAS_TO_ID.get(key_strict)

        if not matched_cid:
            return {"ok": False, "status": "no_match"}

        country = _COUNTRIES_BY_ID.get(matched_cid)
        if not country:
            return {"ok": False, "status": "no_match"}

        # 2. Check region filter
        if self.region != "all":
            c_cont = country.get("continent", "").lower()
            if c_cont != self.region.lower():
                return {"ok": False, "status": "wrong_region", "country": country}

        # 3. Check already discovered
        if matched_cid in self.discovered:
            disc = self.discovered[matched_cid]
            return {
                "ok": True,
                "status": "already_discovered",
                "country": country,
                "discoveredBy": disc.get("playerName", ""),
                "playerColor": disc.get("playerColor", ""),
            }

        # 4. New discovery!
        # Determine color according to game mode
        claim_color = player["color"]
        if self.mode == "team":
            claim_color = "#ef4444" if player.get("team") == "red" else "#38bdf8"
        elif self.mode == "coop":
            claim_color = player["color"]

        discovery_record = {
            "countryId": matched_cid,
            "countryName": country.get("name_no", ""),
            "countryNameEn": country.get("name_en", ""),
            "flag": country.get("flag", "🌍"),
            "continent": country.get("continent", ""),
            "capital": country.get("capital", ""),
            "playerId": player_id,
            "playerName": player["name"],
            "playerColor": claim_color,
            "playerAvatar": player["avatar"],
            "team": player.get("team"),
            "timestamp": now,
        }

        self.discovered[matched_cid] = discovery_record
        player["score"] += 1

        feed_item = {
            "playerName": player["name"],
            "countryName": country.get("name_no", ""),
            "flag": country.get("flag", "🌍"),
            "color": claim_color,
            "avatar": player.get("avatar", ""),
            "timestamp": now,
        }
        self.feed.append(feed_item)
        if len(self.feed) > 50:
            self.feed = self.feed[-50:]

        self.version += 1

        # 5. Check victory (all target countries found!)
        target_count = len(self._get_target_countries())
        if len(self.discovered) >= target_count:
            self.status = "finished"

        return {
            "ok": True,
            "status": "new",
            "country": country,
            "score": player["score"],
            "totalDiscovered": len(self.discovered),
            "totalTarget": target_count,
            "claimColor": claim_color,
        }

    def get_state(self, client_player_id: Optional[str] = None) -> Dict[str, Any]:
        now = time.time()
        # Auto-expire timer
        if self.status == "playing" and self.end_time and now >= self.end_time:
            self.status = "finished"
            self.version += 1

        target_countries = self._get_target_countries()
        target_count = len(target_countries)
        disc_count = len(self.discovered)
        percent = round((disc_count / max(1, target_count)) * 100, 1)

        time_remaining = None
        if self.status == "playing":
            if self.end_time:
                time_remaining = max(0, int(self.end_time - now))
            else:
                time_remaining = -1  # unlimited
        elif self.status == "finished":
            time_remaining = 0

        # Build leaderboard
        leaderboard = sorted(
            self.players.values(),
            key=lambda p: (p.get("score", 0), -p.get("joined_at", 0)),
            reverse=True,
        )

        # Team scores
        team_scores = {"red": 0, "blue": 0}
        if self.mode == "team":
            for d in self.discovered.values():
                t = d.get("team")
                if t in team_scores:
                    team_scores[t] += 1

        client_player = self.players.get(client_player_id) if client_player_id else None
        is_host = bool(client_player and client_player.get("is_host"))

        return {
            "ok": True,
            "roomCode": self.code,
            "status": self.status,
            "mode": self.mode,
            "region": self.region,
            "timeLimit": self.time_limit,
            "timeRemaining": time_remaining,
            "totalCountries": target_count,
            "discoveredCount": disc_count,
            "percent": percent,
            "discovered": self.discovered,
            "feed": self.feed[-20:],
            "players": list(self.players.values()),
            "leaderboard": leaderboard,
            "teamScores": team_scores,
            "isHost": is_host,
            "hostId": self.host_id,
            "hostToken": self.host_token if is_host else None,
            "me": client_player,
            "version": self.version,
            "serverTime": now,
        }


# -----------------------------------------------------------------------------
# API ROUTER (KORRIDORER / KULEREGN / PARTY STYLE)
# -----------------------------------------------------------------------------

class VerdenskartAPI:
    @staticmethod
    def handle_get(path: str, query: Dict[str, List[str]]) -> Optional[Tuple[int, Dict[str, Any]]]:
        if path == "/api/verdenskart/countries":
            _load_countries()
            region = (query.get("region", ["all"])[0] or "all").lower()
            if region == "all":
                c_list = _COUNTRY_LIST
            else:
                c_list = [c for c in _COUNTRY_LIST if c.get("continent", "").lower() == region]
            return 200, {"ok": True, "countries": c_list, "total": len(c_list)}

        if path == "/api/verdenskart/state":
            code = (query.get("roomCode", [""])[0] or query.get("code", [""])[0]).strip().upper()
            player_id = (query.get("playerId", [""])[0] or query.get("player", [""])[0]).strip()

            if not code:
                return 400, {"ok": False, "error": "Mangler roomCode"}

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": f"Fant ikke rommet «{code}»."}

            return 200, room.get_state(player_id)

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Dict[str, Any]]]:
        # 1. Create Room
        if path == "/api/verdenskart/create":
            host_name = str(body.get("hostName", "Vert")).strip()[:20] or "Vert"
            host_color = str(body.get("color", "")).strip() or None
            host_avatar = str(body.get("avatar", "")).strip() or None
            mode = str(body.get("mode", "ffa")).strip().lower()
            time_limit = int(body.get("timeLimit", 900))
            region = str(body.get("region", "all")).strip()

            code = "".join(random.choices(string.ascii_uppercase, k=4))
            with _rooms_lock:
                for candidate in CLEAN_ROOM_CODES:
                    if candidate not in _rooms:
                        code = candidate
                        break

                room = VerdenskartRoom(
                    code=code,
                    host_name=host_name,
                    host_color=host_color,
                    host_avatar=host_avatar,
                    mode=mode,
                    time_limit=time_limit,
                    region=region,
                )
                _rooms[code] = room

            return 200, {
                "ok": True,
                "roomCode": code,
                "playerId": room.host_id,
                "hostToken": room.host_token,
                "mode": room.mode,
                "timeLimit": room.time_limit,
                "region": room.region,
            }

        # 2. Join Room
        if path == "/api/verdenskart/join":
            code = str(body.get("roomCode", "")).strip().upper()
            player_name = str(body.get("playerName", "Spiller")).strip()[:20] or "Spiller"
            color = str(body.get("color", "")).strip() or None
            avatar = str(body.get("avatar", "")).strip() or None
            team = str(body.get("team", "")).strip().lower() or None

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": f"Fant ikke rommet «{code}»."}

            player = room.add_player(player_name, color=color, avatar=avatar, team=team)
            if not player:
                return 400, {"ok": False, "error": "Rommet er fullt (maks 16 spillere)."}

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": player["id"],
                "player": player,
            }

        # 3. Start Game
        if path == "/api/verdenskart/start":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            mode = body.get("mode")
            time_limit = body.get("timeLimit")
            region = body.get("region")

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": "Fant ikke rommet."}

            p = room.players.get(player_id)
            if not p or not p.get("is_host"):
                return 403, {"ok": False, "error": "Kun verten kan starte spillet."}

            room.start_game(mode=mode, time_limit=time_limit, region=region)
            return 200, {"ok": True, "status": "playing"}

        # 4. Guess Country
        if path == "/api/verdenskart/guess":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            text = str(body.get("text", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": "Fant ikke rommet."}

            res = room.submit_guess(player_id, text)
            return 200, res

        # 5. Toggle Ready
        if path == "/api/verdenskart/ready":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            ready = bool(body.get("ready", True))

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": "Fant ikke rommet."}

            ok = room.update_player(player_id, ready=ready)
            return 200, {"ok": ok}

        # 6. Update Profile
        if path in ("/api/verdenskart/profile", "/api/verdenskart/team"):
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            name = body.get("name")
            color = body.get("color")
            avatar = body.get("avatar")
            team = body.get("team")

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": "Fant ikke rommet."}

            ok = room.update_player(player_id, name=name, color=color, avatar=avatar, team=team)
            return 200, {"ok": ok}

        # 7. Update Settings (Host)
        if path == "/api/verdenskart/settings":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": "Fant ikke rommet."}

            p = room.players.get(player_id)
            if not p or not p.get("is_host"):
                return 403, {"ok": False, "error": "Kun verten kan endre innstillinger."}

            if "mode" in body and body["mode"] in ("ffa", "coop", "team"):
                room.mode = body["mode"]
            if "timeLimit" in body:
                room.time_limit = int(body["timeLimit"])
            if "region" in body:
                room.region = str(body["region"])
            room.version += 1
            return 200, {"ok": True}

        # 8. Give Up / Forfeit Round
        if path in ("/api/verdenskart/give_up", "/api/verdenskart/end"):
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": "Fant ikke rommet."}

            with room.lock:
                p = room.players.get(player_id)
                p_name = p["name"] if p else "En spiller"
                room.status = "finished"
                room.version += 1
                room.feed.append({
                    "playerName": p_name,
                    "countryName": "ga opp runden",
                    "flag": "🏳️",
                    "color": "#ef4444",
                    "avatar": p.get("avatar", "") if p else "",
                    "timestamp": time.time(),
                })
            return 200, {"ok": True, "status": "finished"}

        # 9. Restart / Play Again
        if path == "/api/verdenskart/restart":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"ok": False, "error": "Fant ikke rommet."}

            p = room.players.get(player_id)
            if not p or not p.get("is_host"):
                return 403, {"ok": False, "error": "Kun verten kan restarte runden."}

            room.start_game()
            return 200, {"ok": True}

        # 9. Leave Room
        if path == "/api/verdenskart/leave":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
                if room:
                    room.remove_player(player_id)
                    if not room.players:
                        del _rooms[code]
            return 200, {"ok": True}

        return None

