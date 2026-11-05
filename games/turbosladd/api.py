"""
Turbosladd API - Backend for top-down 2D drifting & multiplayer racing.
Handles multidevice room lobbies, starting grids, real-time car synchronization,
race progression (checkpoints & laps), and victory podium.
Supports 2-4 players currently, with architecture prepared for up to 16 players.
"""

import math
import random
import string
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

_rooms: Dict[str, "TurbosladdRoom"] = {}
_rooms_lock = threading.RLock()

CLEAN_ROOM_CODES = [
    "TURBO", "SLADD", "SVING", "ASFLT", "PISTA", "DRIFT",
    "GASS", "SPURT", "RUNDE", "POLE", "SPEED", "NITRO",
    "SKRENS", "BANEN", "DEPOT", "SJEKK"
]

PLAYER_PALETTE = [
    {"color": "#ef4444", "name": "Rød Turbo"},
    {"color": "#38bdf8", "name": "Blå Lyn"},
    {"color": "#10b981", "name": "Grønn Fart"},
    {"color": "#fbbf24", "name": "Gul Sol"},
    {"color": "#a855f7", "name": "Lilla Flamme"},
    {"color": "#f97316", "name": "Oransje Ild"},
    {"color": "#ec4899", "name": "Rosa Rakett"},
    {"color": "#06b6d4", "name": "Cyan Drifter"},
    {"color": "#84cc16", "name": "Lime Stunt"},
    {"color": "#6366f1", "name": "Indigo Nitro"},
    {"color": "#e11d48", "name": "Karmosin Sladd"},
    {"color": "#14b8a6", "name": "Teal Racer"},
    {"color": "#d946ef", "name": "Fuchsia Hjul"},
    {"color": "#eab308", "name": "Gull Pokal"},
    {"color": "#3b82f6", "name": "Kongeblå"},
    {"color": "#22c55e", "name": "Smaragd"},
]

TRACK_CONFIGS = {
    "rally_random": {
        "id": "rally_random",
        "name": "Tilfeldig Rallyetappe 🎲",
        "desc": "Kjempestor, tilfeldig generert rallyetappe med grusvei, offroad-skuldre og mange krevende svinger og hårnåler.",
        "difficulty": "Variert",
        "lapsDefault": 3,
        "width": 5000,
        "height": 3500,
    },
    "grand_prix": {
        "id": "grand_prix",
        "name": "Skogsrally Grand Prix",
        "desc": "Kjempestor skogsrallyetappe med over 16 km grusvei, dype sjikaner, fartsstrekker og solide tømmervegger.",
        "difficulty": "Middels",
        "lapsDefault": 3,
        "width": 5000,
        "height": 3500,
    },
    "fjord_drift": {
        "id": "fjord_drift",
        "name": "Fjordsvingen Rally",
        "desc": "Kjempestor teknisk rallyetappe med krappe hårnåler, kampesteiner og endeløse grussladder.",
        "difficulty": "Ekspert",
        "lapsDefault": 3,
        "width": 5000,
        "height": 3500,
    },
    "fjellpasset": {
        "id": "fjellpasset",
        "name": "Fjellpasset Rally",
        "desc": "Kjempestor fjellovergang med kvasse 90°-svinger, doble apices og raske platåer.",
        "difficulty": "Vanskelig",
        "lapsDefault": 3,
        "width": 5000,
        "height": 3500,
    },
}

# Compatibility aliases for legacy track names
TRACK_ALIASES = {
    "f1_random": "rally_random",
    "f1_gp_classic": "grand_prix",
    "f1_fjordsvingen": "fjord_drift",
    "f1_monza": "grand_prix",
    "f1_silverstone": "fjellpasset",
    "f1_spa": "fjord_drift",
    "f1_redbull": "fjellpasset",
    "f1_suzuka": "fjord_drift",
}

def resolve_track_id(tid: Optional[str]) -> str:
    if not tid:
        return "rally_random"
    mapped = TRACK_ALIASES.get(tid, tid)
    return mapped if mapped in TRACK_CONFIGS else "rally_random"


class TurbosladdRoom:
    def __init__(
        self,
        code: str,
        host_name: str,
        host_color: str,
        host_car: str = "gt",
        track_id: str = "rally_random",
        track_seed: Optional[int] = None,
        laps: int = 3,
        max_players: int = 16,  # Configured for 1-16 players
        host_avatar: str = "",
        host_body_id: int = 1,
        host_wheel_id: int = 1,
    ):
        self.code = code
        self.created_at = time.time()
        self.last_active = time.time()
        self.version = 1
        self.lock = threading.RLock()

        self.track_id = resolve_track_id(track_id)
        self.track_seed = int(track_seed) if track_seed is not None else random.randint(10000, 99999)
        self.laps = max(1, min(10, laps))
        self.max_players = max(1, min(16, max_players))

        # Status: "lobby" -> "countdown" -> "racing" -> "finished"
        self.status = "lobby"
        self.countdown_start: Optional[float] = None
        self.race_start: Optional[float] = None
        self.finish_timeout: Optional[float] = None

        self.players: Dict[str, Dict[str, Any]] = {}
        self.host_id: str = f"p_{uuid.uuid4().hex[:8]}"
        self.host_token: str = f"ht_{uuid.uuid4().hex[:12]}"

        # Add host player
        self.players[self.host_id] = {
            "id": self.host_id,
            "name": host_name[:18].strip() or "Sjåfør 1",
            "color": host_color or PLAYER_PALETTE[0]["color"],
            "avatar": host_avatar or "",
            "carModel": "gt",
            "bodyId": max(1, min(4, int(host_body_id or 1))),
            "wheelId": max(1, min(4, int(host_wheel_id or 1))),
            "isHost": True,
            "isReady": True,
            "slot": 0,
            "x": 0.0,
            "y": 0.0,
            "angle": 0.0,
            "vx": 0.0,
            "vy": 0.0,
            "speed": 0.0,
            "isDrifting": False,
            "lap": 1,
            "checkpoint": 0,
            "finished": False,
            "finishTime": 0.0,
            "bestLap": 0.0,
            "lastSeen": time.time(),
        }

    def touch(self) -> None:
        self.last_active = time.time()

    def bump(self) -> None:
        self.version += 1
        self.touch()

    def _check_status_transitions(self) -> None:
        now = time.time()
        if self.status == "countdown":
            if self.countdown_start and (now - self.countdown_start) >= 3.0:
                self.status = "racing"
                self.race_start = now
                self.bump()
        elif self.status == "racing":
            # Racers who are still actively driving (neither finished, nor left, nor forfeited)
            still_driving = [p for p in self.players.values() if not p.get("left") and not p.get("forfeit") and not p.get("finished")]
            total_players = len(self.players)

            # In multiplayer (2+ racers started), if only 1 (or 0) racer is left driving, the race is finished!
            if total_players >= 2 and len(still_driving) <= 1:
                self.status = "finished"
                self.bump()
            # If 0 racers are left driving (e.g. 1-player mode and finished)
            elif len(still_driving) == 0:
                self.status = "finished"
                self.bump()
            # Fallback timeout after first finisher (15s grace period)
            elif any(p.get("finished") for p in self.players.values() if not p.get("left") and not p.get("forfeit")):
                if not self.finish_timeout:
                    self.finish_timeout = now + 15.0
                elif now >= self.finish_timeout:
                    self.status = "finished"
                    self.bump()

    def add_player(self, name: str, color: str, car_model: str = "gt", avatar: str = "", body_id: int = 1, wheel_id: int = 1) -> Optional[Dict[str, Any]]:
        with self.lock:
            active_count = len([p for p in self.players.values() if not p.get("left")])
            if active_count >= self.max_players:
                return None
            if self.status != "lobby":
                return None

            pid = f"p_{uuid.uuid4().hex[:8]}"
            used_slots = {p["slot"] for p in self.players.values() if not p.get("left")}
            slot = 0
            while slot in used_slots:
                slot += 1

            # Auto-assign distinct color if none provided or collision
            assigned_color = color
            used_colors = {p["color"].lower() for p in self.players.values() if not p.get("left")}
            if not assigned_color or assigned_color.lower() in used_colors:
                for pal in PLAYER_PALETTE:
                    if pal["color"].lower() not in used_colors:
                        assigned_color = pal["color"]
                        break
                if not assigned_color:
                    assigned_color = PLAYER_PALETTE[slot % len(PLAYER_PALETTE)]["color"]

            # Deduplicate driver name
            existing_names = {p["name"].lower() for p in self.players.values() if not p.get("left")}
            raw_name = name[:18].strip() or f"Sjåfør {slot + 1}"
            final_name = raw_name
            counter = 2
            while final_name.lower() in existing_names:
                final_name = f"{raw_name} {counter}"
                counter += 1

            player = {
                "id": pid,
                "name": final_name,
                "color": assigned_color,
                "avatar": avatar or "",
                "carModel": "gt",
                "bodyId": max(1, min(4, int(body_id or 1))),
                "wheelId": max(1, min(4, int(wheel_id or 1))),
                "isHost": False,
                "isReady": False,
                "slot": slot,
                "x": 0.0,
                "y": 0.0,
                "angle": 0.0,
                "vx": 0.0,
                "vy": 0.0,
                "speed": 0.0,
                "isDrifting": False,
                "lap": 1,
                "checkpoint": 0,
                "finished": False,
                "finishTime": 0.0,
                "bestLap": 0.0,
                "lastSeen": time.time(),
            }
            self.players[pid] = player
            self.bump()
            return player

    def customize_car(self, player_id: str, body_id: Optional[int] = None, wheel_id: Optional[int] = None, color: Optional[str] = None) -> Tuple[bool, str]:
        with self.lock:
            if player_id not in self.players or self.players[player_id].get("left"):
                return False, "Spilleren finnes ikke i rommet."
            if self.status != "lobby":
                return False, "Kan ikke tilpasse bilen etter at løpet har startet."

            p = self.players[player_id]
            if body_id is not None:
                try:
                    bid = int(body_id)
                    if 1 <= bid <= 4:
                        p["bodyId"] = bid
                except (ValueError, TypeError):
                    pass

            if wheel_id is not None:
                try:
                    wid = int(wheel_id)
                    if 1 <= wid <= 4:
                        p["wheelId"] = wid
                except (ValueError, TypeError):
                    pass

            if color:
                new_color_clean = str(color).strip()
                if new_color_clean:
                    p["color"] = new_color_clean

            self.bump()
            return True, "Bil oppdatert."

    def remove_player(self, player_id: str, forfeit: bool = True) -> None:
        with self.lock:
            if player_id in self.players:
                p = self.players[player_id]
                p["left"] = True
                p["forfeit"] = bool(forfeit)
                p["isReady"] = False

                # Host migration if host left
                if p.get("isHost"):
                    remaining = [pl for pl in self.players.values() if not pl.get("left")]
                    if remaining:
                        remaining[0]["isHost"] = True
                        remaining[0]["isReady"] = True
                        self.host_id = remaining[0]["id"]
                self._check_status_transitions()
                self.bump()

    def set_ready(self, player_id: str, ready: bool) -> bool:
        with self.lock:
            if player_id in self.players and not self.players[player_id].get("left"):
                self.players[player_id]["isReady"] = ready
                self.bump()
                return True
            return False

    def change_color(self, player_id: str, new_color: str) -> Tuple[bool, str]:
        with self.lock:
            if player_id not in self.players or self.players[player_id].get("left"):
                return False, "Spilleren finnes ikke i rommet."
            if self.status != "lobby":
                return False, "Kan ikke endre farge etter at løpet har startet."

            new_color_clean = new_color.strip().lower()
            if not new_color_clean:
                return False, "Ugyldig fargekode."

            # Check if any other player currently in the room uses this color
            for pid, p in self.players.items():
                if pid != player_id and not p.get("left"):
                    if p.get("color", "").strip().lower() == new_color_clean:
                        return False, f"Fargen er allerede valgt av {p.get('name', 'en annen spiller')}."

            self.players[player_id]["color"] = new_color.strip()
            self.bump()
            return True, "Farge oppdatert."

    def update_settings(self, player_id: str, track_id: Optional[str] = None, laps: Optional[int] = None, track_seed: Optional[int] = None) -> Tuple[bool, str]:
        with self.lock:
            if player_id != self.host_id:
                return False, "Bare verten kan endre løpsinnstillinger."
            if self.status != "lobby":
                return False, "Kan ikke endre innstillinger etter at løpet har startet."
            if track_id:
                self.track_id = resolve_track_id(track_id)
            if track_seed is not None:
                try:
                    self.track_seed = int(track_seed)
                except (ValueError, TypeError):
                    pass
            if laps is not None:
                try:
                    num_laps = int(laps)
                    if 1 <= num_laps <= 20:
                        self.laps = num_laps
                except (ValueError, TypeError):
                    pass
            self.bump()
            return True, "Innstillinger oppdatert."

    def start_race(self, player_id: str) -> Tuple[bool, str]:
        with self.lock:
            if player_id != self.host_id:
                return False, "Bare verten kan starte løpet."
            active = [p for p in self.players.values() if not p.get("left")]
            if len(active) < 1:
                return False, "Ingen spillere i rommet."
            if self.status != "lobby":
                return False, "Løpet er allerede i gang."

            self.status = "countdown"
            self.countdown_start = time.time()
            self.race_start = None
            self.finish_timeout = None

            # Reset racer progress
            for p in active:
                p["lap"] = 1
                p["checkpoint"] = 0
                p["finished"] = False
                p["finishTime"] = 0.0
                p["bestLap"] = 0.0

            self.bump()
            return True, ""

    def update_telemetry(self, player_id: str, data: Dict[str, Any]) -> None:
        with self.lock:
            if player_id not in self.players:
                return
            p = self.players[player_id]
            p["lastSeen"] = time.time()

            # Update coordinates & motion
            p["x"] = float(data.get("x", p["x"]))
            p["y"] = float(data.get("y", p["y"]))
            p["angle"] = float(data.get("angle", p["angle"]))
            p["vx"] = float(data.get("vx", p["vx"]))
            p["vy"] = float(data.get("vy", p["vy"]))
            p["speed"] = float(data.get("speed", p["speed"]))
            p["isDrifting"] = bool(data.get("isDrifting", False))

            # Progression
            if "lap" in data:
                p["lap"] = int(data["lap"])
            if "checkpoint" in data:
                p["checkpoint"] = int(data["checkpoint"])
            if "finished" in data and data["finished"] and not p["finished"]:
                p["finished"] = True
                p["finishTime"] = float(data.get("finishTime", 0.0))
            if "bestLap" in data and float(data["bestLap"]) > 0:
                cur = p.get("bestLap", 0.0)
                bl = float(data["bestLap"])
                p["bestLap"] = bl if (cur == 0 or bl < cur) else cur

            self.touch()
            self._check_status_transitions()

    def restart_race(self, player_id: str) -> Tuple[bool, str]:
        with self.lock:
            if player_id != self.host_id:
                return False, "Bare verten kan starte et nytt løp."
            self.status = "lobby"
            self.countdown_start = None
            self.race_start = None
            self.finish_timeout = None
            for p in self.players.values():
                p["isReady"] = p.get("isHost", False)
                p["lap"] = 1
                p["checkpoint"] = 0
                p["finished"] = False
                p["finishTime"] = 0.0
                p["bestLap"] = 0.0
            self.bump()
            return True, ""

    def get_public_state(self, for_player_id: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            self._check_status_transitions()
            now = time.time()
            countdown_rem = 0.0
            if self.status == "countdown" and self.countdown_start:
                countdown_rem = max(0.0, 3.0 - (now - self.countdown_start))

            race_time = 0.0
            if self.status in ("racing", "finished") and self.race_start:
                race_time = now - self.race_start

            # Include all racers in standings if finished (forfeited racers at bottom)
            include_all = (self.status == "finished")
            active_players = [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "color": p["color"],
                    "avatar": p.get("avatar", ""),
                    "carModel": p.get("carModel", "gt"),
                    "bodyId": p.get("bodyId", 1),
                    "wheelId": p.get("wheelId", 1),
                    "isHost": p["isHost"],
                    "isReady": p["isReady"],
                    "slot": p["slot"],
                    "x": p["x"],
                    "y": p["y"],
                    "angle": p["angle"],
                    "vx": p["vx"],
                    "vy": p["vy"],
                    "speed": p["speed"],
                    "isDrifting": p["isDrifting"],
                    "lap": p["lap"],
                    "checkpoint": p["checkpoint"],
                    "finished": p["finished"],
                    "finishTime": p["finishTime"],
                    "bestLap": p["bestLap"],
                    "forfeit": bool(p.get("forfeit")),
                    "left": bool(p.get("left")),
                    "isMe": (p["id"] == for_player_id),
                }
                for p in self.players.values()
                if include_all or not p.get("left")
            ]

            # Calculate standings (Finished first by finishTime, then active by lap/checkpoint, forfeits last)
            standings = sorted(
                active_players,
                key=lambda pl: (
                    1 if pl.get("forfeit") or pl.get("left") else 0,
                    0 if pl["finished"] else 1,
                    pl["finishTime"] if pl["finished"] else 0,
                    -pl["lap"],
                    -pl["checkpoint"]
                )
            )

            is_host = False
            if for_player_id and for_player_id in self.players:
                is_host = self.players[for_player_id].get("isHost", False)

            return {
                "ok": True,
                "roomCode": self.code,
                "version": self.version,
                "status": self.status,
                "countdownRemaining": round(countdown_rem, 2),
                "raceTime": round(race_time, 2),
                "trackId": self.track_id,
                "trackSeed": self.track_seed,
                "laps": self.laps,
                "maxPlayers": self.max_players,
                "isHost": is_host,
                "players": active_players,
                "standings": [pl["id"] for pl in standings],
                "playerCount": len(active_players),
            }


class TurbosladdAPI:
    @staticmethod
    def _clean_expired_rooms() -> None:
        with _rooms_lock:
            now = time.time()
            to_del = [code for code, r in _rooms.items() if (now - r.last_active) > 7200]
            for code in to_del:
                del _rooms[code]

    @staticmethod
    def _generate_room_code() -> str:
        with _rooms_lock:
            for c in CLEAN_ROOM_CODES:
                if c not in _rooms:
                    return c
            while True:
                candidate = "".join(random.choices(string.ascii_uppercase, k=4))
                if candidate not in _rooms:
                    return candidate

    @staticmethod
    def handle_get(path: str, query: Dict[str, List[str]]) -> Optional[Tuple[int, Dict[str, Any]]]:
        TurbosladdAPI._clean_expired_rooms()

        if path == "/api/turbosladd/state":
            room_code = (query.get("room") or query.get("code") or [""])[0].strip().upper()
            player_id = (query.get("player") or query.get("playerId") or [""])[0].strip()

            with _rooms_lock:
                room = _rooms.get(room_code)
                if not room:
                    try:
                        from games.party.api import _rooms as party_rooms, extract_color_from_avatar
                        p_room = party_rooms.get(room_code)
                        if p_room and p_room.current_game == "turbosladd":
                            host_player = p_room.players.get(p_room.host_id, {})
                            host_avatar = host_player.get("avatar", "")
                            host_color = host_player.get("color") or extract_color_from_avatar(host_avatar) or PLAYER_PALETTE[0]["color"]
                            room = TurbosladdRoom(
                                code=room_code,
                                host_name=host_player.get("name", "Sjåfør 1"),
                                host_color=host_color,
                                host_car="gt",
                                track_id="rally_random",
                                track_seed=random.randint(10000, 99999),
                                laps=3,
                                max_players=max(len(p_room.players), 16),
                                host_avatar=host_avatar,
                            )
                            room.host_id = p_room.host_id
                            room.status = "countdown"
                            room.countdown_start = time.time()
                            room.players = {}
                            room.players[p_room.host_id] = {
                                "id": p_room.host_id,
                                "name": host_player.get("name", "Sjåfør 1"),
                                "color": host_color,
                                "avatar": host_avatar,
                                "carModel": "gt",
                                "isHost": True,
                                "isReady": True,
                                "slot": 0,
                                "x": 0.0, "y": 0.0, "angle": 0.0, "vx": 0.0, "vy": 0.0, "speed": 0.0,
                                "isDrifting": False, "lap": 1, "checkpoint": 0, "finished": False,
                                "finishTime": 0.0, "bestLap": 0.0, "lastSeen": time.time(),
                            }
                            slot = 1
                            for pid, pdata in p_room.players.items():
                                if pid != p_room.host_id and len(room.players) < room.max_players:
                                    pal = PLAYER_PALETTE[slot % len(PLAYER_PALETTE)]
                                    p_color = pdata.get("color") or extract_color_from_avatar(pdata.get("avatar", "")) or pal["color"]
                                    room.players[pid] = {
                                        "id": pid,
                                        "name": pdata.get("name", f"Sjåfør {slot + 1}"),
                                        "color": p_color,
                                        "avatar": pdata.get("avatar", ""),
                                        "carModel": "gt",
                                        "isHost": False,
                                        "isReady": True,
                                        "slot": slot,
                                        "x": 0.0, "y": 0.0, "angle": 0.0, "vx": 0.0, "vy": 0.0, "speed": 0.0,
                                        "isDrifting": False, "lap": 1, "checkpoint": 0, "finished": False,
                                        "finishTime": 0.0, "bestLap": 0.0, "lastSeen": time.time(),
                                    }
                                    slot += 1
                            _rooms[room_code] = room
                    except Exception:
                        pass

            if not room:
                return 404, {"error": "Løpet finnes ikke eller er utgått."}

            if player_id and player_id not in room.players:
                try:
                    from games.party.api import _rooms as party_rooms, extract_color_from_avatar
                    p_room = party_rooms.get(room_code)
                    if p_room and player_id in p_room.players:
                        pdata = p_room.players[player_id]
                        with room.lock:
                            slot = len(room.players)
                            pal = PLAYER_PALETTE[slot % len(PLAYER_PALETTE)]
                            p_color = pdata.get("color") or extract_color_from_avatar(pdata.get("avatar", "")) or pal["color"]
                            room.players[player_id] = {
                                "id": player_id,
                                "name": pdata.get("name", f"Sjåfør {slot + 1}"),
                                "color": p_color,
                                "avatar": pdata.get("avatar", ""),
                                "carModel": "gt",
                                "isHost": False,
                                "isReady": True,
                                "slot": slot,
                                "x": 0.0, "y": 0.0, "angle": 0.0, "vx": 0.0, "vy": 0.0, "speed": 0.0,
                                "isDrifting": False, "lap": 1, "checkpoint": 0, "finished": False,
                                "finishTime": 0.0, "bestLap": 0.0, "lastSeen": time.time(),
                            }
                except Exception:
                    pass

            return 200, room.get_public_state(player_id)

        if path == "/api/turbosladd/tracks":
            return 200, {"ok": True, "tracks": list(TRACK_CONFIGS.values())}

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Dict[str, Any]]]:
        TurbosladdAPI._clean_expired_rooms()

        # 1. Create Room
        if path == "/api/turbosladd/create":
            host_name = str(body.get("hostName", "Sjåfør 1")).strip()[:18] or "Sjåfør 1"
            host_color = str(body.get("color", "")).strip()
            host_avatar = str(body.get("avatar", "")).strip()
            host_body_id = int(body.get("bodyId", 1))
            host_wheel_id = int(body.get("wheelId", 1))
            track_id = resolve_track_id(str(body.get("trackId", "rally_random")).strip())
            track_seed = body.get("trackSeed")
            laps = int(body.get("laps", 3))
            max_players = int(body.get("maxPlayers", 16))

            code = TurbosladdAPI._generate_room_code()
            room = TurbosladdRoom(
                code=code,
                host_name=host_name,
                host_color=host_color,
                host_car="gt",
                track_id=track_id,
                track_seed=track_seed,
                laps=laps,
                max_players=max_players,
                host_avatar=host_avatar,
                host_body_id=host_body_id,
                host_wheel_id=host_wheel_id,
            )

            with _rooms_lock:
                _rooms[code] = room

            return 200, {
                "ok": True,
                "roomCode": code,
                "playerId": room.host_id,
                "hostToken": room.host_token,
                "slot": 0,
                "color": host_color,
                "bodyId": host_body_id,
                "wheelId": host_wheel_id,
                "trackId": room.track_id,
                "trackSeed": room.track_seed,
                "laps": room.laps,
            }

        # 2. Join Room
        if path == "/api/turbosladd/join":
            code = str(body.get("roomCode", "")).strip().upper()
            player_name = str(body.get("playerName", "Sjåfør")).strip()[:18] or "Sjåfør"
            color = str(body.get("color", "")).strip()
            avatar = str(body.get("avatar", "")).strip()
            body_id = int(body.get("bodyId", 1))
            wheel_id = int(body.get("wheelId", 1))

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke løpet. Sjekk koden og prøv igjen."}

            player = room.add_player(player_name, color, car_model="gt", avatar=avatar, body_id=body_id, wheel_id=wheel_id)
            if not player:
                return 400, {"error": "Løpet er fullt (maks spillere nådd) eller allerede startet."}

            return 200, {
                "ok": True,
                "roomCode": code,
                "playerId": player["id"],
                "slot": player["slot"],
                "color": player["color"],
                "bodyId": player.get("bodyId", 1),
                "wheelId": player.get("wheelId", 1),
                "trackId": room.track_id,
                "laps": room.laps,
            }

        # 3. Toggle Ready
        if path == "/api/turbosladd/ready":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            ready = bool(body.get("ready", True))

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke løpet."}

            ok = room.set_ready(player_id, ready)
            return 200, {"ok": ok}

        # 3b. Change Color (Lobby only, max 1 player per color)
        if path == "/api/turbosladd/color":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            color = str(body.get("color", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke løpet."}

            ok, msg = room.change_color(player_id, color)
            if not ok:
                return 400, {"error": msg}

            return 200, {"ok": True, "color": color, "message": msg}

        # 3c. Customize Car (body, wheels, color)
        if path == "/api/turbosladd/customize":
            code = str(body.get("roomCode") or body.get("code", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            body_id = body.get("bodyId")
            wheel_id = body.get("wheelId")
            color = body.get("color")

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke løpet."}

            ok, msg = room.customize_car(player_id, body_id=body_id, wheel_id=wheel_id, color=color)
            if not ok:
                return 400, {"error": msg}

            p = room.players.get(player_id, {})
            return 200, {
                "ok": True,
                "bodyId": p.get("bodyId", 1),
                "wheelId": p.get("wheelId", 1),
                "color": p.get("color"),
                "message": msg,
            }

        # 3c. Update Settings (Host only: track and laps)
        if path == "/api/turbosladd/settings":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            track_id = body.get("trackId")
            track_seed = body.get("trackSeed")
            laps = body.get("laps")

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke løpet."}

            ok, msg = room.update_settings(player_id, track_id=track_id, laps=laps, track_seed=track_seed)
            if not ok:
                return 400, {"error": msg}

            return 200, {
                "ok": True,
                "trackId": room.track_id,
                "trackSeed": room.track_seed,
                "laps": room.laps,
                "message": msg,
            }

        # 4. Start Race (Host only)
        if path == "/api/turbosladd/start":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke løpet."}

            ok, msg = room.start_race(player_id)
            if not ok:
                return 400, {"error": msg}

            return 200, {"ok": True, "status": room.status}

        # 5. Sync Telemetry (High-frequency loop during race)
        if path == "/api/turbosladd/sync":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            telemetry = body.get("telemetry", {})

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke løpet."}

            room.update_telemetry(player_id, telemetry)
            return 200, room.get_public_state(player_id)

        # 6. Restart Race (Host only)
        if path == "/api/turbosladd/restart":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()

            with _rooms_lock:
                room = _rooms.get(code)
            if not room:
                return 404, {"error": "Fant ikke løpet."}

            ok, msg = room.restart_race(player_id)
            if not ok:
                return 400, {"error": msg}

            return 200, {"ok": True, "status": room.status}

        # 7. Leave Room / Forfeit
        if path == "/api/turbosladd/leave":
            code = str(body.get("roomCode", "")).strip().upper()
            player_id = str(body.get("playerId", "")).strip()
            forfeit = bool(body.get("forfeit", True))

            with _rooms_lock:
                room = _rooms.get(code)
            if room:
                room.remove_player(player_id, forfeit=forfeit)

            return 200, {"ok": True}

        return None

