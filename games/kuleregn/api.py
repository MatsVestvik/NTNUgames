"""
Kuleregn API - Backend for top-down 2D multiplayer shooter.
Handles multidevice room lobbies, player synchronization, weapon pickups,
projectile events, kill feed, health & shields, score limits, and victory podium.
Supports Free-For-All (FFA) with modular architecture prepared for Team Deathmatch and Battle Royale.
"""

import math
import random
import string
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

_rooms: Dict[str, "KuleregnRoom"] = {}
_rooms_lock = threading.RLock()

CLEAN_ROOM_CODES = [
    "KULE", "SKUDD", "ARENA", "PANG", "RIFLE", "HAGLE",
    "BLAST", "TRIGGER", "SNIPER", "REKKE", "KAMPEN", "DRONEN",
    "LASER", "REVOLV", "SEIER", "POKAL"
]

PLAYER_PALETTE = [
    {"color": "#ef4444", "name": "Karmosin Rød"},
    {"color": "#38bdf8", "name": "Himmelblå"},
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

WEAPONS_SPEC = {
    "pistol": {
        "id": "pistol",
        "name": "P-99 Pistol",
        "icon": "🔫",
        "damage": 22,
        "fireRate": 0.22, # seconds per shot
        "magSize": 12,
        "reloadTime": 1.1,
        "bulletSpeed": 850,
        "spread": 0.04,
        "bulletCount": 1,
        "bulletRange": 900,
        "isAutomatic": False,
        "ammoReserve": 999, # infinite
    },
    "shotgun": {
        "id": "shotgun",
        "name": "SPAS-12 Hagle",
        "icon": "💥",
        "damage": 18,     # per pellet (x6 = 108 max)
        "fireRate": 0.72,
        "magSize": 6,
        "reloadTime": 1.8,
        "bulletSpeed": 750,
        "spread": 0.22,
        "bulletCount": 6,
        "bulletRange": 650,
        "isAutomatic": False,
        "ammoReserve": 24,
    },
    "assault": {
        "id": "assault",
        "name": "AR-47 Maskingevær",
        "icon": "⚡",
        "damage": 17,
        "fireRate": 0.11, # 9 rounds/sec
        "magSize": 30,
        "reloadTime": 1.5,
        "bulletSpeed": 950,
        "spread": 0.07,
        "bulletCount": 1,
        "bulletRange": 1100,
        "isAutomatic": True,
        "ammoReserve": 90,
    },
    "sniper": {
        "id": "sniper",
        "name": "AWP Skarpskytter",
        "icon": "🎯",
        "damage": 85,
        "fireRate": 1.25,
        "magSize": 5,
        "reloadTime": 2.2,
        "bulletSpeed": 1400,
        "spread": 0.015,
        "bulletCount": 1,
        "bulletRange": 1600,
        "isAutomatic": False,
        "ammoReserve": 15,
    },
    "rocket": {
        "id": "rocket",
        "name": "RPG Rakettkaster",
        "icon": "🚀",
        "damage": 115,    # AOE explosion
        "splashRadius": 140,
        "fireRate": 1.5,
        "magSize": 2,
        "reloadTime": 2.6,
        "bulletSpeed": 520,
        "spread": 0.03,
        "bulletCount": 1,
        "bulletRange": 1200,
        "isAutomatic": False,
        "ammoReserve": 4,
    },
}

MAP_CONFIGS = {
    "rust": {
        "id": "rust",
        "name": "Rust (Scrapyard) 🏜️",
        "desc": "Kompakt og intens ørkenarena inspirert av klassisk Rust / CS. Sentralt tårn, containere, rørgater og dekningskasser.",
        "width": 2200,
        "height": 2200,
        "spawnCount": 12,
    },
    "gloshaugen_arena": {
        "id": "gloshaugen_arena",
        "name": "Gløshaugen Arena 🏛️",
        "desc": "Taktisk campusarena med sentral gårdplass, dekningsmurer, kasser og eksplosive tønner.",
        "width": 2400,
        "height": 1800,
        "spawnCount": 12,
    },
    "cyber_hangar": {
        "id": "cyber_hangar",
        "name": "Cyber Hangar 🚀",
        "desc": "Industrielt høyteknologisk lagerbygg med shippingcontainere, trange ganger og intense skuddvekslinger.",
        "width": 2600,
        "height": 2000,
        "spawnCount": 12,
    },
}


class KuleregnRoom:
    """Manages an active Kuleregn match session."""

    def __init__(
        self,
        code: str,
        host_name: str,
        host_color: str,
        map_id: str = "rust",
        score_limit: int = 15,
        time_limit: int = 300,
        bot_count: int = 4,
        mode: str = "ffa",
        host_avatar: str = "",
    ) -> None:
        self.code: str = code.upper()
        self.lock = threading.RLock()
        self.created_at: float = time.time()
        self.last_activity: float = time.time()
        self.version: int = 1

        self.status: str = "lobby"  # "lobby" | "countdown" | "playing" | "finished"
        self.countdown_start: Optional[float] = None
        self.match_start: Optional[float] = None
        self.race_end_time: Optional[float] = None

        self.mode: str = mode if mode in ("ffa", "tdm") else "ffa"
        self.map_id: str = map_id if map_id in MAP_CONFIGS else "rust"
        self.score_limit: int = max(5, min(50, score_limit))
        self.time_limit: int = max(60, min(900, time_limit))
        self.bot_count: int = max(0, min(8, bot_count))

        self.players: Dict[str, Dict[str, Any]] = {}
        self.host_id: str = f"p_{uuid.uuid4().hex[:8]}"
        self.host_token: str = uuid.uuid4().hex
        self.color_assignments: Dict[str, str] = {}

        self.kill_feed: List[Dict[str, Any]] = []
        self.recent_events: List[Dict[str, Any]] = []

        # Add Host Player
        self._add_host(host_name, host_color, host_avatar)

    def bump(self) -> None:
        self.version += 1
        self.last_activity = time.time()

    def _add_host(self, name: str, color: str, avatar: str = "") -> None:
        chosen_color = color
        if not chosen_color or any(p.get("color") == chosen_color for p in self.players.values()):
            chosen_color = self._get_next_available_color()

        self.players[self.host_id] = {
            "id": self.host_id,
            "name": name.strip() or "Sjåfør 1",
            "color": chosen_color,
            "avatar": avatar,
            "isHost": True,
            "isReady": False,
            "isBot": False,
            "slot": 0,
            "x": 400.0,
            "y": 400.0,
            "angle": 0.0,
            "vx": 0.0,
            "vy": 0.0,
            "speed": 0.0,
            "health": 100,
            "shield": 25,
            "weapon": "assault",
            "kills": 0,
            "deaths": 0,
            "score": 0,
            "streak": 0,
            "highestStreak": 0,
            "lastSeen": time.time(),
        }
        self.color_assignments[chosen_color] = self.host_id

    def _get_next_available_color(self) -> str:
        used = set(p["color"].lower() for p in self.players.values() if "color" in p)
        for item in PLAYER_PALETTE:
            c = item["color"].lower()
            if c not in used:
                return item["color"]
        return f"#{random.randint(0x222222, 0xEEEEEE):06x}"

    def add_player(self, name: str, color: str, avatar: str = "") -> Optional[Dict[str, Any]]:
        with self.lock:
            if len([p for p in self.players.values() if not p.get("left") and not p.get("isBot")]) >= 16:
                return None

            pid = f"p_{uuid.uuid4().hex[:8]}"
            chosen_color = color
            if not chosen_color or any(p.get("color") == chosen_color for p in self.players.values()):
                chosen_color = self._get_next_available_color()

            slot = len(self.players)
            player_dict = {
                "id": pid,
                "name": name.strip() or f"Spiller {slot + 1}",
                "color": chosen_color,
                "avatar": avatar,
                "isHost": False,
                "isReady": False,
                "isBot": False,
                "slot": slot,
                "x": 400.0 + (slot % 4) * 80.0,
                "y": 400.0 + (slot // 4) * 80.0,
                "angle": 0.0,
                "vx": 0.0,
                "vy": 0.0,
                "speed": 0.0,
                "health": 100,
                "shield": 25,
                "weapon": "assault",
                "kills": 0,
                "deaths": 0,
                "score": 0,
                "streak": 0,
                "highestStreak": 0,
                "lastSeen": time.time(),
            }
            self.players[pid] = player_dict
            self.color_assignments[chosen_color] = pid
            self.bump()
            return player_dict

    def remove_player(self, player_id: str, forfeit: bool = False) -> bool:
        with self.lock:
            p = self.players.get(player_id)
            if not p:
                return False

            if forfeit or self.status in ("playing", "finished"):
                p["left"] = True
                p["forfeit"] = True
            else:
                del self.players[player_id]
                if p.get("color") in self.color_assignments:
                    del self.color_assignments[p["color"]]

            # If host left, elect new host
            if p.get("isHost"):
                active = [item for item in self.players.values() if not item.get("left") and not item.get("isBot")]
                if active:
                    active[0]["isHost"] = True
                    self.host_id = active[0]["id"]

            self.bump()
            self._check_status_transitions()
            return True

    def set_ready(self, player_id: str, ready: bool) -> bool:
        with self.lock:
            p = self.players.get(player_id)
            if not p:
                return False
            p["isReady"] = bool(ready)
            self.bump()

            # If in lobby, check if all real players are ready to start countdown
            if self.status == "lobby":
                active_real = [x for x in self.players.values() if not x.get("left") and not x.get("isBot")]
                if active_real and all(x.get("isReady") for x in active_real):
                    self.status = "countdown"
                    self.countdown_start = time.time()
                    self.match_start = None
                    self.race_end_time = None
                    # Reset stats for fresh match
                    for pl in self.players.values():
                        pl["kills"] = 0
                        pl["deaths"] = 0
                        pl["score"] = 0
                        pl["health"] = 100
                        pl["shield"] = 25
                        pl["weapon"] = pl.get("weapon", "assault")
                    self.kill_feed = []
                    self.recent_events = []
                    self.bump()
            return True

    def change_color(self, player_id: str, color_hex: str) -> bool:
        return self.update_profile(player_id, color=color_hex)

    def update_profile(
        self,
        player_id: str,
        color: Optional[str] = None,
        avatar: Optional[str] = None,
        name: Optional[str] = None,
        weapon: Optional[str] = None,
    ) -> bool:
        with self.lock:
            p = self.players.get(player_id)
            if not p:
                return False

            if color:
                clean_hex = color.strip().lower()
                conflict = False
                for other_id, other in self.players.items():
                    if other_id != player_id and other.get("color", "").lower() == clean_hex:
                        conflict = True
                        break
                if not conflict:
                    old_color = p.get("color")
                    if old_color in self.color_assignments:
                        del self.color_assignments[old_color]
                    p["color"] = color
                    self.color_assignments[color] = player_id

            if avatar:
                p["avatar"] = str(avatar).strip()

            if name:
                clean_name = str(name).strip()[:18]
                if clean_name:
                    p["name"] = clean_name

            if weapon and weapon in WEAPONS_SPEC:
                p["weapon"] = weapon

            self.bump()
            return True

    def update_settings(self, player_id: str, settings: Dict[str, Any]) -> bool:
        with self.lock:
            p = self.players.get(player_id)
            if not p or not p.get("isHost"):
                return False
            if self.status != "lobby":
                return False

            if "mapId" in settings and settings["mapId"] in MAP_CONFIGS:
                self.map_id = settings["mapId"]
            if "scoreLimit" in settings:
                self.score_limit = max(5, min(50, int(settings["scoreLimit"])))
            if "timeLimit" in settings:
                self.time_limit = max(60, min(900, int(settings["timeLimit"])))
            if "botCount" in settings:
                self.bot_count = max(0, min(8, int(settings["botCount"])))

            self.bump()
            return True

    def start_match(self, player_id: str) -> bool:
        """Host force start."""
        with self.lock:
            p = self.players.get(player_id)
            if not p or not p.get("isHost"):
                return False
            if self.status in ("countdown", "playing"):
                return False

            self.status = "countdown"
            self.countdown_start = time.time()
            self.match_start = None
            self.race_end_time = None
            for pl in self.players.values():
                pl["isReady"] = True
                pl["kills"] = 0
                pl["deaths"] = 0
                pl["score"] = 0
                pl["health"] = 100
                pl["shield"] = 25
                pl["weapon"] = pl.get("weapon", "assault")
            self.kill_feed = []
            self.recent_events = []
            self.bump()
            return True

    def restart_match(self, player_id: str) -> bool:
        with self.lock:
            p = self.players.get(player_id)
            if not p or not p.get("isHost"):
                return False

            self.status = "countdown"
            self.countdown_start = time.time()
            self.match_start = None
            self.race_end_time = None
            for pl in self.players.values():
                pl["isReady"] = True
                pl["kills"] = 0
                pl["deaths"] = 0
                pl["score"] = 0
                pl["health"] = 100
                pl["shield"] = 25
                pl["weapon"] = pl.get("weapon", "assault")
            self.kill_feed = []
            self.recent_events = []
            self.bump()
            return True

    def reset_to_lobby(self, player_id: Optional[str] = None) -> bool:
        with self.lock:
            self.status = "lobby"
            self.countdown_start = None
            self.match_start = None
            self.race_end_time = None
            for pl in self.players.values():
                pl["isReady"] = False
                pl["kills"] = 0
                pl["deaths"] = 0
                pl["score"] = 0
                pl["health"] = 100
                pl["shield"] = 25
                pl["weapon"] = pl.get("weapon", "assault")
            self.kill_feed = []
            self.recent_events = []
            self.bump()
            return True

    def _check_status_transitions(self) -> None:
        now = time.time()

        if self.status == "countdown":
            if self.countdown_start and now - self.countdown_start >= 3.0:
                self.status = "playing"
                self.match_start = now
                self.race_end_time = None
                self.bump()

        elif self.status == "playing":
            # Check victory condition (score limit reached or time ran out)
            max_kills = max((p.get("kills", 0) for p in self.players.values() if not p.get("left")), default=0)
            time_expired = (self.match_start is not None) and (now - self.match_start >= self.time_limit)

            is_match_over = (max_kills >= self.score_limit) or time_expired

            if is_match_over:
                if not self.race_end_time:
                    # 4.0s grace period after final elimination so players see the finish
                    self.race_end_time = now + 4.0
                elif now >= self.race_end_time:
                    self.status = "finished"
                    self.bump()

    def register_kill(self, killer_id: str, victim_id: str, weapon_id: str = "pistol") -> None:
        with self.lock:
            killer = self.players.get(killer_id)
            victim = self.players.get(victim_id)
            if not victim:
                return

            victim["deaths"] = victim.get("deaths", 0) + 1
            victim["streak"] = 0

            killer_name = "Omgivelse"
            killer_color = "#94a3b8"
            if killer:
                killer["kills"] = killer.get("kills", 0) + 1
                killer["score"] = killer.get("score", 0) + 100
                killer["streak"] = killer.get("streak", 0) + 1
                if killer["streak"] > killer.get("highestStreak", 0):
                    killer["highestStreak"] = killer["streak"]
                killer_name = killer.get("name", "Ukjent")
                killer_color = killer.get("color", "#ef4444")

            w_name = WEAPONS_SPEC.get(weapon_id, {}).get("name", weapon_id.title())
            w_icon = WEAPONS_SPEC.get(weapon_id, {}).get("icon", "💥")

            event = {
                "id": uuid.uuid4().hex[:6],
                "killerId": killer_id,
                "killerName": killer_name,
                "killerColor": killer_color,
                "victimId": victim_id,
                "victimName": victim.get("name", "Ukjent"),
                "victimColor": victim.get("color", "#38bdf8"),
                "weapon": weapon_id,
                "weaponName": w_name,
                "weaponIcon": w_icon,
                "time": time.time(),
            }
            self.kill_feed.append(event)
            if len(self.kill_feed) > 10:
                self.kill_feed = self.kill_feed[-10:]

            self.recent_events.append({"type": "kill", **event})
            if len(self.recent_events) > 20:
                self.recent_events = self.recent_events[-20:]

            self.bump()
            self._check_status_transitions()

    def update_telemetry(self, player_id: str, telemetry: Dict[str, Any]) -> None:
        with self.lock:
            p = self.players.get(player_id)
            if not p:
                return

            p["lastSeen"] = time.time()
            for key in ("x", "y", "angle", "hullAngle", "trackFrame", "vx", "vy", "speed", "weapon", "health", "shield", "isReloading"):
                if key in telemetry:
                    p[key] = telemetry[key]

            # Ingest hits/kills reported
            events = telemetry.get("events", [])
            for ev in events:
                if ev.get("type") == "kill":
                    self.register_kill(
                        killer_id=ev.get("killerId", player_id),
                        victim_id=ev.get("victimId", ""),
                        weapon_id=ev.get("weapon", "pistol"),
                    )

            self._check_status_transitions()
            self.bump()

    def get_public_state(self, for_player_id: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            self._check_status_transitions()
            now = time.time()

            countdown_rem = 0.0
            if self.status == "countdown" and self.countdown_start:
                countdown_rem = max(0.0, 3.0 - (now - self.countdown_start))

            time_remaining = self.time_limit
            if self.status == "playing" and self.match_start:
                time_remaining = max(0.0, self.time_limit - (now - self.match_start))

            player_list = []
            for p in self.players.values():
                is_me = (for_player_id and p["id"] == for_player_id)
                player_list.append({
                    "id": p["id"],
                    "name": p["name"],
                    "color": p["color"],
                    "avatar": p.get("avatar", ""),
                    "isHost": p.get("isHost", False),
                    "isReady": p.get("isReady", False),
                    "isBot": p.get("isBot", False),
                    "slot": p.get("slot", 0),
                    "x": round(p.get("x", 0.0), 1),
                    "y": round(p.get("y", 0.0), 1),
                    "angle": round(p.get("angle", 0.0), 3),
                    "vx": round(p.get("vx", 0.0), 1),
                    "vy": round(p.get("vy", 0.0), 1),
                    "speed": round(p.get("speed", 0.0), 1),
                    "health": p.get("health", 100),
                    "shield": p.get("shield", 0),
                    "weapon": p.get("weapon", "pistol"),
                    "kills": p.get("kills", 0),
                    "deaths": p.get("deaths", 0),
                    "score": p.get("score", 0),
                    "isMe": bool(is_me),
                    "left": p.get("left", False),
                    "forfeit": p.get("forfeit", False),
                })

            # Sort players by kills (score) descending
            player_list.sort(key=lambda item: (-item["kills"], item["deaths"], -item["score"]))

            return {
                "ok": True,
                "roomCode": self.code,
                "status": self.status,
                "mode": self.mode,
                "mapId": self.map_id,
                "scoreLimit": self.score_limit,
                "timeLimit": self.time_limit,
                "timeRemaining": round(time_remaining, 1),
                "countdownRemaining": round(countdown_rem, 1),
                "botCount": self.bot_count,
                "version": self.version,
                "players": player_list,
                "killFeed": self.kill_feed[-6:],
                "recentEvents": self.recent_events[-12:],
            }


class KuleregnAPI:
    """HTTP router for Kuleregn endpoints."""

    @staticmethod
    def _clean_expired_rooms() -> None:
        now = time.time()
        with _rooms_lock:
            expired = [code for code, r in _rooms.items() if now - r.last_activity > 3600]
            for c in expired:
                del _rooms[c]

    @staticmethod
    def _generate_room_code() -> str:
        with _rooms_lock:
            avail = [c for c in CLEAN_ROOM_CODES if c not in _rooms]
            if avail:
                return random.choice(avail)
            while True:
                candidate = "".join(random.choices(string.ascii_uppercase, k=4))
                if candidate not in _rooms:
                    return candidate

    @staticmethod
    def handle_get(path: str, query: Dict[str, List[str]]) -> Optional[Tuple[int, Dict[str, Any]]]:
        KuleregnAPI._clean_expired_rooms()

        if path == "/api/kuleregn/state":
            room_code = (query.get("roomCode") or query.get("room") or query.get("code") or [""])[0].strip().upper()
            player_id = (query.get("player") or query.get("playerId") or [""])[0].strip()

            with _rooms_lock:
                room = _rooms.get(room_code)
                if not room:
                    # Check bridge from Party Lobby
                    try:
                        from games.party.api import _rooms as party_rooms, extract_color_from_avatar
                        p_room = party_rooms.get(room_code)
                        if p_room and p_room.current_game == "kuleregn":
                            host_player = p_room.players.get(p_room.host_id, {})
                            host_avatar = host_player.get("avatar", "")
                            host_color = host_player.get("color") or extract_color_from_avatar(host_avatar) or PLAYER_PALETTE[0]["color"]

                            room = KuleregnRoom(
                                code=room_code,
                                host_name=host_player.get("name", "Sjåfør 1"),
                                host_color=host_color,
                                map_id="rust",
                                score_limit=15,
                                time_limit=300,
                                bot_count=2,
                                mode="ffa",
                                host_avatar=host_avatar,
                            )
                            room.host_id = p_room.host_id
                            room.status = "countdown"
                            room.countdown_start = time.time()
                            room.players = {}

                            # Add all party players
                            slot = 0
                            for pid, pdata in p_room.players.items():
                                if not pdata.get("is_spectator") and not pdata.get("left"):
                                    p_av = pdata.get("avatar", "")
                                    p_col = pdata.get("color") or extract_color_from_avatar(p_av) or PLAYER_PALETTE[slot % len(PLAYER_PALETTE)]["color"]
                                    room.players[pid] = {
                                        "id": pid,
                                        "name": pdata.get("name", f"Spiller {slot + 1}"),
                                        "color": p_col,
                                        "avatar": p_av,
                                        "isHost": (pid == p_room.host_id),
                                        "isReady": True,
                                        "isBot": False,
                                        "slot": slot,
                                        "x": 400.0 + (slot % 4) * 80.0,
                                        "y": 400.0 + (slot // 4) * 80.0,
                                        "angle": 0.0,
                                        "vx": 0.0, "vy": 0.0, "speed": 0.0,
                                        "health": 100, "shield": 25, "weapon": "assault",
                                        "kills": 0, "deaths": 0, "score": 0, "streak": 0, "highestStreak": 0,
                                        "lastSeen": time.time(),
                                    }
                                    slot += 1
                            _rooms[room_code] = room
                    except Exception as err:
                        print("Error creating Kuleregn room from party bridge:", err)

            if not room:
                return 404, {"error": "Løpet ble ikke funnet."}

            return 200, room.get_public_state(player_id)

        if path == "/api/kuleregn/maps":
            return 200, {
                "ok": True,
                "maps": list(MAP_CONFIGS.values()),
                "weapons": list(WEAPONS_SPEC.values()),
            }

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Dict[str, Any]]]:
        KuleregnAPI._clean_expired_rooms()

        # 1. Create Room
        if path == "/api/kuleregn/create":
            host_name = str(body.get("hostName", "Spiller 1")).strip()[:18] or "Spiller 1"
            host_color = str(body.get("color", "")).strip()
            host_avatar = str(body.get("avatar", "")).strip()
            map_id = str(body.get("mapId", "rust")).strip()
            score_limit = int(body.get("scoreLimit", 15))
            time_limit = int(body.get("timeLimit", 300))
            bot_count = int(body.get("botCount", 4))
            mode = str(body.get("mode", "ffa")).strip()

            code = KuleregnAPI._generate_room_code()
            room = KuleregnRoom(
                code=code,
                host_name=host_name,
                host_color=host_color,
                map_id=map_id,
                score_limit=score_limit,
                time_limit=time_limit,
                bot_count=bot_count,
                mode=mode,
                host_avatar=host_avatar,
            )

            with _rooms_lock:
                _rooms[code] = room

            return 200, {
                "ok": True,
                "roomCode": code,
                "playerId": room.host_id,
                "hostToken": room.host_token,
                "slot": 0,
                "color": room.players[room.host_id]["color"],
                "mapId": room.map_id,
                "scoreLimit": room.score_limit,
                "timeLimit": room.time_limit,
                "botCount": room.bot_count,
                "mode": room.mode,
            }

        # 2. Join Room
        if path == "/api/kuleregn/join":
            code = str(body.get("roomCode", "")).strip().upper()
            player_name = str(body.get("playerName", "Spiller")).strip()[:18] or "Spiller"
            color = str(body.get("color", "")).strip()
            avatar = str(body.get("avatar", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke rommet. Sjekk koden og prøv igjen."}

            player = room.add_player(player_name, color, avatar)
            if not player:
                return 400, {"error": "Rommet er fullt (maks 16 spillere)."}

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": player["id"],
                "slot": player["slot"],
                "color": player["color"],
                "mapId": room.map_id,
                "scoreLimit": room.score_limit,
                "timeLimit": room.time_limit,
                "botCount": room.bot_count,
                "mode": room.mode,
            }

        # 3. Toggle Ready
        if path == "/api/kuleregn/ready":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            ready = bool(body.get("ready", True))

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke rommet."}

            ok = room.set_ready(player_id, ready)
            return 200, {"ok": ok}

        # 4. Customize Profile (Color, Avatar, Name)
        if path in ("/api/kuleregn/color", "/api/kuleregn/customize", "/api/kuleregn/avatar"):
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            color = str(body.get("color", "")).strip() or None
            avatar = str(body.get("avatar", "")).strip() or None
            name = str(body.get("name", "")).strip() or None

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke rommet."}

            ok = room.update_profile(player_id, color=color, avatar=avatar, name=name)
            return 200, {"ok": ok}

        # 5. Update Settings (Host only)
        if path == "/api/kuleregn/settings":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            settings = body.get("settings", {})

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke rommet."}

            ok = room.update_settings(player_id, settings)
            return 200, {"ok": ok}

        # 6. Start Match (Host force start)
        if path == "/api/kuleregn/start":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke rommet."}

            ok = room.start_match(player_id)
            return 200, {"ok": ok}

        # 7. Sync Telemetry
        if path == "/api/kuleregn/sync":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            telemetry = body.get("telemetry", {})

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke rommet."}

            room.update_telemetry(player_id, telemetry)
            return 200, room.get_public_state(player_id)

        # 8. Restart Match (Host only)
        if path == "/api/kuleregn/restart":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke rommet."}

            ok = room.restart_match(player_id)
            return 200, {"ok": ok}

        # 8b. Reset to Lobby (play again)
        if path in ("/api/kuleregn/lobby", "/api/kuleregn/reset_lobby"):
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke rommet."}

            ok = room.reset_to_lobby(player_id)
            return 200, {"ok": ok}

        # 9. Leave Room
        if path == "/api/kuleregn/leave":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 200, {"ok": True}

            ok = room.remove_player(player_id, forfeit=True)
            return 200, {"ok": ok}

        return None

