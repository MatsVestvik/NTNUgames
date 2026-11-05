"""
Party Lobby & Multi-Device Room Gateway API
Manages synchronized party rooms, live players on their own devices,
and dynamic game transitions across Ordbombe and upcoming party games.
"""

import os
import time
import random
import string
import threading
import uuid
from typing import Any, Dict, List, Optional, Tuple

from games.ordbombe.api import check_word, get_prompts_cache
from games.tegn_og_gjett.words import get_random_word_triplet, is_close_guess
from games.imposter.words import get_random_imposter_pair, is_matching_word

# In-memory party rooms storage
_rooms: Dict[str, "PartyRoom"] = {}
_rooms_lock = threading.RLock()

# Clean room code words for easy typing on phones
CLEAN_WORDS = [
    "FEST", "BOMB", "VORS", "KATT", "QUIZ", "SMIL", "GLOS", "NTNU",
    "GULL", "HELG", "LYS", "SOL", "BUSS", "CAMP", "SPILL", "KAFFE",
    "TAKK", "HYTTE", "VIND", "FJORD", "NORD", "BROR", "VENN", "TEAM"
]

# Curated party colors (matching CharacterCreator palette, 16 distinct colors)
HEAD_COLORS = [
    "#ffd166", "#00b4d8", "#ef476f", "#06d6a0",
    "#fb8500", "#8338ec", "#ff70a6", "#a0c4ff",
    "#fadcba", "#f3c299", "#dfa27a", "#8d5b36",
    "#4a2810", "#f1f5f9", "#94a3b8", "#1e293b"
]


def extract_color_from_avatar(avatar: str) -> str:
    """Extract head color hex string from avatar string or config."""
    if not avatar:
        return "#ffd166"
    av_str = str(avatar).strip()
    if av_str.startswith("char:"):
        for part in av_str[5:].split(":"):
            if part.startswith("c_"):
                hex_val = part[2:].strip()
                if hex_val:
                    return "#" + hex_val.lower()
            elif part.startswith("c") and not part.startswith("char"):
                hex_val = part[1:].strip()
                if hex_val:
                    return "#" + hex_val.lower()
    elif av_str.startswith("{"):
        try:
            import json
            data = json.loads(av_str)
            if "headColor" in data:
                return str(data["headColor"]).lower()
        except Exception:
            pass
    elif av_str.startswith("#") and len(av_str) in (4, 7):
        return av_str.lower()
    return "#ffd166"


def replace_color_in_avatar(avatar: str, new_hex: str) -> str:
    """Return avatar string with updated head color."""
    clean_hex = new_hex.lstrip("#").lower()
    if not avatar or not str(avatar).startswith("char:"):
        return f"char:h1:c_{clean_hex}:r1:e1:m1"
    parts = str(avatar)[5:].split(":")
    new_parts = []
    has_color = False
    for p in parts:
        if p.startswith("c_") or (p.startswith("c") and not p.startswith("char")):
            new_parts.append(f"c_{clean_hex}")
            has_color = True
        else:
            new_parts.append(p)
    if not has_color:
        new_parts.insert(1, f"c_{clean_hex}")
    return "char:" + ":".join(new_parts)


def get_available_party_color(taken_colors: set, preferred_color: Optional[str] = None) -> str:
    """Find a unique color in the party room not already taken by any player."""
    taken_lower = {str(c).lower() for c in taken_colors if c}
    if preferred_color:
        pref = str(preferred_color).lower()
        if pref in [c.lower() for c in HEAD_COLORS] and pref not in taken_lower:
            return pref
    for c in HEAD_COLORS:
        if c.lower() not in taken_lower:
            return c.lower()
    # If room exceeds 16 players, pick cycled fallback
    return HEAD_COLORS[len(taken_lower) % len(HEAD_COLORS)].lower()


# Declarative Party Game Registry
PARTY_REGISTRY: Dict[str, Dict[str, Any]] = {
    "ordbombe": {
        "name": "Ordbombe",
        "url_path": "/ordbombe/",
        "min_players": 1,
        "max_players": 12,
        "is_internal": True,
    },
    "tegn_og_gjett": {
        "name": "Tegn & Gjett",
        "url_path": "/tegn-og-gjett/",
        "min_players": 2,
        "max_players": 12,
        "is_internal": True,
    },
    "imposter": {
        "name": "Imposter",
        "url_path": "/imposter/",
        "min_players": 3,
        "max_players": 10,
        "is_internal": True,
    },
    "fargekoden": {
        "name": "Fargekoden",
        "url_path": "/fargekoden/",
        "min_players": 2,
        "max_players": 8,
        "is_internal": True,
    },
    "sjakk": {
        "name": "Sjakk",
        "url_path": "/sjakk/",
        "min_players": 2,
        "max_players": 2,
        "is_internal": False,
    },
    "korridorer": {
        "name": "Korridorer",
        "url_path": "/korridorer/",
        "min_players": 2,
        "max_players": 16,
        "is_internal": False,
    },
    "wavelength": {
        "name": "Wavelength",
        "url_path": "/wavelength/",
        "min_players": 2,
        "max_players": 12,
        "is_internal": False,
    },
    "turbosladd": {
        "name": "Turbosladd",
        "url_path": "/turbosladd/",
        "min_players": 1,
        "max_players": 16,
        "is_internal": False,
    },
}


def cleanup_external_game_session(code: str, game_id: Optional[str], player_id: Optional[str] = None) -> None:
    """Safely terminate or forfeit external game sessions when returning to lounge."""
    if not game_id:
        return

    if game_id == "sjakk":
        try:
            from games.sjakk.api import _rooms as sjakk_rooms
            with _rooms_lock:
                s_room = sjakk_rooms.get(code)
                if s_room:
                    with s_room.lock:
                        s_room.status = "finished"
                        s_room.returned_to_lounge = True
                        s_room.result_reason = "Partiet ble avsluttet (returnert til Party Lounge)."
                        s_room.bump()
        except Exception as err:
            print("Cleanup sjakk error:", err)

    elif game_id == "korridorer":
        try:
            from games.korridorer.api import _rooms as korr_rooms
            with _rooms_lock:
                k_room = korr_rooms.get(code)
                if k_room:
                    with k_room.lock:
                        k_room.status = "finished"
                        k_room.bump()
        except Exception as err:
            print("Cleanup korridorer error:", err)

    elif game_id == "turbosladd":
        try:
            from games.turbosladd.api import _rooms as ts_rooms
            with _rooms_lock:
                t_room = ts_rooms.get(code)
                if t_room:
                    with t_room.lock:
                        if player_id and player_id in t_room.players:
                            t_room.remove_player(player_id, forfeit=True)
                        else:
                            t_room.status = "finished"
                            t_room.bump()
        except Exception as err:
            print("Cleanup turbosladd error:", err)

    elif game_id == "wavelength":
        try:
            from games.wavelength.api import _rooms as wl_rooms
            with _rooms_lock:
                w_room = wl_rooms.get(code)
                if w_room:
                    with w_room.lock:
                        w_room.status = "finished"
                        w_room.returned_to_lounge = True
                        w_room.bump()
        except Exception as err:
            print("Cleanup wavelength error:", err)


class PartyRoom:
    def __init__(self, code: str, host_token: str, host_name: str, host_avatar: str):
        self.code = code
        self.host_token = host_token
        self.created_at = time.time()
        self.last_active = time.time()
        self.current_game: Optional[str] = None  # None (lobby), "ordbombe", "tegn_og_gjett", etc.
        self.game_state: Dict[str, Any] = {}
        self.players: Dict[str, Dict[str, Any]] = {}
        self.kicked_players: set = set()
        self.version = 1
        self.lock = threading.RLock()

        # Add initial host player with unique color
        host_id = f"p_{uuid.uuid4().hex[:8]}"
        self.host_id = host_id
        pref_color = extract_color_from_avatar(host_avatar)
        host_color = get_available_party_color(set(), pref_color)
        final_host_avatar = replace_color_in_avatar(host_avatar, host_color)

        self.players[host_id] = {
            "id": host_id,
            "name": host_name[:18].strip() or "Vert",
            "avatar": final_host_avatar,
            "color": host_color,
            "is_host": True,
            "is_ready": True,
            "score": 0,
            "lives": 3,
            "eliminated": False,
            "words_count": 0,
            "last_seen": time.time(),
        }

    def touch(self) -> None:
        self.last_active = time.time()

    def bump(self) -> None:
        self.version += 1
        self.touch()

    def get_public_state(self, client_player_id: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            # Tick active game if running
            if self.current_game == "ordbombe":
                self._tick_ordbombe()
            elif self.current_game == "tegn_og_gjett":
                self._tick_tegn_og_gjett()
            elif self.current_game == "imposter":
                self._tick_imposter()
            elif self.current_game == "fargekoden":
                self._tick_fargekoden()

            players_list = []
            for p in self.players.values():
                players_list.append({
                    "id": p["id"],
                    "name": p["name"],
                    "avatar": p["avatar"],
                    "color": p["color"],
                    "isHost": p["is_host"],
                    "isReady": p["is_ready"],
                    "score": p["score"],
                    "lives": p["lives"],
                    "eliminated": p["eliminated"],
                    "wordsCount": p["words_count"],
                })

            client_player = self.players.get(client_player_id or "")

            if self.current_game == "tegn_og_gjett":
                effective_game_state = self._get_tegn_og_gjett_public_state(client_player_id)
            elif self.current_game == "imposter":
                effective_game_state = self._get_imposter_public_state(client_player_id)
            elif self.current_game == "fargekoden":
                effective_game_state = self._get_fargekoden_public_state(client_player_id)
            elif self.current_game == "sjakk":
                effective_game_state = dict(self.game_state)
                try:
                    from games.sjakk.api import _rooms as sjakk_rooms
                    with _rooms_lock:
                        s_room = sjakk_rooms.get(self.code)
                    if s_room:
                        with s_room.lock:
                            s_room._tick_clock()
                            effective_game_state["status"] = s_room.status
                            effective_game_state["resultReason"] = s_room.result_reason
                            if s_room.status == "finished":
                                self.current_game = None
                                self.game_state = {}
                                self.bump()
                except Exception as s_err:
                    print("Error checking sjakk room state in party:", s_err)
            elif self.current_game == "korridorer":
                effective_game_state = dict(self.game_state)
                try:
                    from games.korridorer.api import _rooms as korridorer_rooms
                    with _rooms_lock:
                        k_room = korridorer_rooms.get(self.code)
                    if k_room:
                        with k_room.lock:
                            effective_game_state["status"] = k_room.status
                            effective_game_state["winner"] = k_room.winner
                            if k_room.status == "finished":
                                self.current_game = None
                                self.game_state = {}
                                self.bump()
                except Exception as k_err:
                    print("Error checking korridorer room state in party:", k_err)
            elif self.current_game == "wavelength":
                effective_game_state = dict(self.game_state)
                try:
                    from games.wavelength.api import _rooms as wl_rooms
                    with _rooms_lock:
                        wl_room = wl_rooms.get(self.code)
                    if wl_room:
                        with wl_room.lock:
                            effective_game_state["status"] = wl_room.status
                            effective_game_state["teamScore"] = wl_room.team_score
                            if wl_room.returned_to_lounge:
                                self.current_game = None
                                self.game_state = {}
                                self.bump()
                except Exception as w_err:
                    print("Error checking wavelength room state in party:", w_err)
            elif self.current_game == "turbosladd":
                effective_game_state = dict(self.game_state)
                try:
                    from games.turbosladd.api import _rooms as ts_rooms
                    with _rooms_lock:
                        ts_room = ts_rooms.get(self.code)
                    if ts_room:
                        with ts_room.lock:
                            effective_game_state["status"] = ts_room.status
                            if client_player_id:
                                ts_p = ts_room.players.get(client_player_id)
                                if ts_p and (ts_p.get("left") or ts_p.get("forfeit")):
                                    effective_game_state["my_status"] = "left"
                            if ts_room.status == "finished":
                                self.current_game = None
                                self.game_state = {}
                                self.bump()
                except Exception as t_err:
                    print("Error checking turbosladd room state in party:", t_err)
            else:
                effective_game_state = self.game_state

            game_url = None
            if self.current_game and self.current_game in PARTY_REGISTRY:
                base_path = PARTY_REGISTRY[self.current_game]["url_path"]
                pid_str = f"&player={client_player_id}" if client_player_id else ""
                game_url = f"{base_path}?room={self.code}{pid_str}"

            all_ready = bool(self.players and all(p.get("is_ready", False) for p in self.players.values()))

            is_host_client = bool(client_player and client_player.get("is_host"))

            return {
                "ok": True,
                "roomCode": self.code,
                "hostId": self.host_id,
                "hostToken": self.host_token if is_host_client else None,
                "currentGame": self.current_game,
                "gameUrl": game_url,
                "allReady": all_ready,
                "version": self.version,
                "players": players_list,
                "playerCount": len(players_list),
                "isHost": is_host_client,
                "me": client_player,
                "kicked": bool(client_player_id and client_player_id in self.kicked_players),
                "gameState": effective_game_state,
                "serverTime": time.time(),
            }

    # --- ORDBOMBE ENGINE ---

    def start_ordbombe(self, settings: Dict[str, Any]) -> None:
        with self.lock:
            self.current_game = "ordbombe"
            diff = (settings.get("difficulty") or "medium").lower()
            turn_sec = float(settings.get("turnDuration") or 6.0)

            prompts_cache = get_prompts_cache()
            pool = prompts_cache.get(diff) or prompts_cache.get("medium") or ["BIL"]
            initial_prompt = random.choice(pool).upper()

            # Reset players lives and statuses
            active_ids = []
            for p in self.players.values():
                p["lives"] = 3
                p["eliminated"] = False
                p["words_count"] = 0
                p["score"] = 0
                active_ids.append(p["id"])

            if not active_ids:
                return

            random.shuffle(active_ids)

            self.game_state = {
                "status": "playing",  # "playing", "exploded", "game_over"
                "difficulty": diff,
                "turn_duration": turn_sec,
                "active_player_ids": active_ids,
                "current_player_idx": 0,
                "active_player_id": active_ids[0],
                "active_player_name": self.players[active_ids[0]]["name"],
                "prompt": initial_prompt,
                "current_typing": "",
                "used_words": [],
                "turn_start_time": time.time(),
                "time_remaining": turn_sec,
                "round_number": 1,
                "last_event": {
                    "type": "game_started",
                    "text": f"Ordbombe har startet! Første stavelse: {initial_prompt}",
                    "timestamp": time.time(),
                },
                "winner": None,
            }
            self.bump()

    def submit_ordbombe_word(self, player_id: str, word_raw: str) -> Dict[str, Any]:
        with self.lock:
            if self.current_game != "ordbombe":
                return {"ok": False, "error": "Ordbombe er ikke aktivt"}

            if self.game_state.get("status") != "playing":
                return {"ok": False, "error": "Runden er ikke aktiv nå"}

            # Verify it's this player's turn
            if self.game_state.get("active_player_id") != player_id:
                curr_name = self.game_state.get("active_player_name", "en annen spiller")
                return {"ok": False, "error": f"Det er {curr_name} sin tur!"}

            prompt = self.game_state.get("prompt", "")
            word = (word_raw or "").strip().lower()

            # Check if word has been used in this game
            used = self.game_state.setdefault("used_words", [])
            if word in used:
                return {"ok": False, "valid": False, "reason": f"«{word}» er allerede brukt i denne runden!"}

            # Validate against Norwegian Bokmål dictionary
            val_res = check_word(word, prompt)
            if not val_res.get("valid"):
                return {"ok": True, "valid": False, "reason": val_res.get("reason", "Ugyldig ord")}

            # Word is VALID!
            used.append(word)
            player = self.players.get(player_id)
            if player:
                player["words_count"] += 1
                player["score"] += len(word) * 10

            # Advance to next living player
            active_ids = self.game_state["active_player_ids"]
            living_ids = [pid for pid in active_ids if not self.players.get(pid, {}).get("eliminated")]

            if len(living_ids) <= 1 and len(active_ids) > 1:
                # Winner!
                winner_id = living_ids[0] if living_ids else player_id
                winner = self.players.get(winner_id)
                self.game_state["status"] = "game_over"
                self.game_state["winner"] = winner
                self.game_state["last_event"] = {
                    "type": "game_over",
                    "text": f"👑 {winner['name']} vant Ordbombe!",
                    "winner": winner,
                    "timestamp": time.time(),
                }
                self.bump()
                return {"ok": True, "valid": True, "reason": "Godkjent!", "word": word}

            # Pick next player
            curr_idx = self.game_state.get("current_player_idx", 0)
            next_idx = (curr_idx + 1) % len(active_ids)
            attempts = 0
            while self.players.get(active_ids[next_idx], {}).get("eliminated") and attempts < len(active_ids):
                next_idx = (next_idx + 1) % len(active_ids)
                attempts += 1

            next_player_id = active_ids[next_idx]
            next_player = self.players.get(next_player_id)

            # Pick new prompt
            diff = self.game_state.get("difficulty", "medium")
            prompts_cache = get_prompts_cache()
            pool = prompts_cache.get(diff) or prompts_cache.get("medium") or ["BIL"]
            new_prompt = random.choice(pool).upper()

            self.game_state["current_player_idx"] = next_idx
            self.game_state["active_player_id"] = next_player_id
            self.game_state["active_player_name"] = next_player["name"] if next_player else "Ukjent"
            self.game_state["prompt"] = new_prompt
            self.game_state["current_typing"] = ""
            self.game_state["turn_start_time"] = time.time()
            self.game_state["time_remaining"] = self.game_state["turn_duration"]
            self.game_state["last_event"] = {
                "type": "word_accepted",
                "text": f"✓ {player['name']} klarte «{word}»! Bomben sendt til {self.game_state['active_player_name']}",
                "player_name": player["name"],
                "word": word,
                "next_player_name": self.game_state["active_player_name"],
                "timestamp": time.time(),
            }

            self.bump()
            return {"ok": True, "valid": True, "reason": "Godkjent!", "word": word}

    def _tick_ordbombe(self) -> None:
        # Check turn expiration
        status = self.game_state.get("status")
        now = time.time()

        if status == "playing":
            elapsed = now - self.game_state.get("turn_start_time", now)
            duration = self.game_state.get("turn_duration", 6.0)
            remaining = max(0.0, duration - elapsed)
            self.game_state["time_remaining"] = round(remaining, 1)

            if elapsed >= duration:
                # BOOM! Active player lost a life
                active_id = self.game_state.get("active_player_id")
                player = self.players.get(active_id or "")

                if player:
                    player["lives"] = max(0, player["lives"] - 1)
                    if player["lives"] <= 0:
                        player["eliminated"] = True

                active_ids = self.game_state.get("active_player_ids", [])
                living_ids = [pid for pid in active_ids if not self.players.get(pid, {}).get("eliminated")]

                if len(living_ids) <= 1 and len(active_ids) > 1:
                    # Winner exists!
                    winner_id = living_ids[0] if living_ids else active_id
                    winner = self.players.get(winner_id or "")
                    self.game_state["status"] = "game_over"
                    self.game_state["winner"] = winner
                    self.game_state["last_event"] = {
                        "type": "game_over",
                        "text": f"💥 Bomben smalt! 👑 {winner['name'] if winner else 'Vinner'} overlevde og vant!",
                        "loser": player["name"] if player else "Spiller",
                        "winner": winner,
                        "timestamp": now,
                    }
                    self.bump()
                    return

                # Temporary explosion pause for animation
                self.game_state["status"] = "exploded"
                self.game_state["current_typing"] = ""
                self.game_state["explosion_until"] = now + 2.4
                self.game_state["last_event"] = {
                    "type": "explosion",
                    "text": f"💥 BOOM! Bomben eksploderte hos {player['name'] if player else 'spiller'}!",
                    "player_name": player["name"] if player else "Spiller",
                    "lives_left": player["lives"] if player else 0,
                    "timestamp": now,
                }
                self.bump()

        elif status == "exploded":
            if now >= self.game_state.get("explosion_until", 0):
                # Explosion pause finished -> pass to next living player
                active_ids = self.game_state.get("active_player_ids", [])
                curr_idx = self.game_state.get("current_player_idx", 0)
                next_idx = (curr_idx + 1) % len(active_ids)
                attempts = 0
                while self.players.get(active_ids[next_idx], {}).get("eliminated") and attempts < len(active_ids):
                    next_idx = (next_idx + 1) % len(active_ids)
                    attempts += 1

                next_player_id = active_ids[next_idx]
                next_player = self.players.get(next_player_id)

                diff = self.game_state.get("difficulty", "medium")
                prompts_cache = get_prompts_cache()
                pool = prompts_cache.get(diff) or prompts_cache.get("medium") or ["BIL"]
                new_prompt = random.choice(pool).upper()

                self.game_state["status"] = "playing"
                self.game_state["current_player_idx"] = next_idx
                self.game_state["active_player_id"] = next_player_id
                self.game_state["active_player_name"] = next_player["name"] if next_player else "Ukjent"
                self.game_state["prompt"] = new_prompt
                self.game_state["current_typing"] = ""
                self.game_state["turn_start_time"] = now
                self.game_state["time_remaining"] = self.game_state["turn_duration"]
                self.game_state["last_event"] = {
                    "type": "turn_changed",
                    "text": f"Ny runde! Bomben er hos {self.game_state['active_player_name']}",
                    "next_player_name": self.game_state["active_player_name"],
                    "timestamp": now,
                }
                self.bump()

    def _advance_ordbombe_turn(self) -> None:
        with self.lock:
            active_ids = self.game_state.get("active_player_ids", [])
            if not active_ids:
                return
            living_ids = [pid for pid in active_ids if not self.players.get(pid, {}).get("eliminated")]
            if len(living_ids) <= 1:
                winner_id = living_ids[0] if living_ids else None
                winner = self.players.get(winner_id or "")
                self.game_state["status"] = "game_over"
                self.game_state["winner"] = winner
                self.bump()
                return

            curr_idx = self.game_state.get("current_player_idx", 0)
            next_idx = (curr_idx + 1) % len(active_ids)
            attempts = 0
            while self.players.get(active_ids[next_idx], {}).get("eliminated") and attempts < len(active_ids):
                next_idx = (next_idx + 1) % len(active_ids)
                attempts += 1

            next_player_id = active_ids[next_idx]
            next_player = self.players.get(next_player_id)

            diff = self.game_state.get("difficulty", "medium")
            prompts_cache = get_prompts_cache()
            pool = prompts_cache.get(diff) or prompts_cache.get("medium") or ["BIL"]
            new_prompt = random.choice(pool).upper()

            self.game_state["current_player_idx"] = next_idx
            self.game_state["active_player_id"] = next_player_id
            self.game_state["active_player_name"] = next_player["name"] if next_player else "Ukjent"
            self.game_state["prompt"] = new_prompt
            self.game_state["current_typing"] = ""
            self.game_state["turn_start_time"] = time.time()
            self.game_state["time_remaining"] = self.game_state.get("turn_duration", 6.0)
            self.game_state["status"] = "playing"
            self.bump()

    def set_ordbombe_typing(self, player_id: str, text: str) -> bool:
        with self.lock:
            if self.current_game != "ordbombe":
                return False
            if self.game_state.get("active_player_id") != player_id:
                return False
            clean_text = (text or "")[:40]
            if self.game_state.get("current_typing") != clean_text:
                self.game_state["current_typing"] = clean_text
                self.bump()
            return True

    # --- TEGN & GJETT ENGINE (skribbl.io style) ---

    def start_tegn_og_gjett(self, settings: Dict[str, Any]) -> None:
        with self.lock:
            self.current_game = "tegn_og_gjett"
            draw_time = int(settings.get("drawTime") or 80)
            rounds = int(settings.get("rounds") or 3)

            active_ids = list(self.players.keys())
            if not active_ids:
                return

            random.shuffle(active_ids)
            for p in self.players.values():
                p["score"] = 0
                p["lives"] = 3
                p["eliminated"] = False

            triplet = get_random_word_triplet()
            now = time.time()
            first_drawer_id = active_ids[0]
            first_drawer_name = self.players[first_drawer_id]["name"]

            self.game_state = {
                "status": "playing",
                "total_rounds": rounds,
                "current_round": 1,
                "turn_order": active_ids,
                "turn_idx": 0,
                "active_drawer_id": first_drawer_id,
                "active_drawer_name": first_drawer_name,
                "turn_state": "choosing",  # "choosing", "drawing", "round_recap", "game_over"
                "draw_time": draw_time,
                "time_remaining": 15.0,
                "choice_deadline": now + 15.0,
                "word_choices": triplet,
                "secret_word": "",
                "category": "",
                "revealed_indices": [],
                "draw_actions": [],
                "next_action_id": 1,
                "guessed_player_ids": [],
                "turn_start_time": now,
                "chat_messages": [
                    {
                        "id": 1,
                        "type": "system",
                        "sender": "System",
                        "text": f"🎨 Velkommen til Tegn & Gjett! Runde 1 av {rounds}. {first_drawer_name} velger et ord…",
                        "timestamp": now,
                    }
                ],
                "next_msg_id": 2,
                "winner": None,
                "podium": [],
            }
            self.bump()

    def _get_tegn_og_gjett_public_state(self, client_player_id: Optional[str]) -> Dict[str, Any]:
        gs = dict(self.game_state)
        active_drawer_id = gs.get("active_drawer_id")
        turn_state = gs.get("turn_state", "choosing")
        secret_word = gs.get("secret_word") or ""
        revealed = set(gs.get("revealed_indices") or [])
        guessed_ids = set(gs.get("guessed_player_ids") or [])

        is_drawer = bool(client_player_id and client_player_id == active_drawer_id)
        has_guessed = bool(client_player_id and client_player_id in guessed_ids)
        is_revealed_phase = turn_state in ("round_recap", "game_over")

        # Word masking security
        if is_drawer or has_guessed or is_revealed_phase:
            word_for_client = secret_word
            masked_word = None
        else:
            word_for_client = None
            masked_chars = []
            for idx, ch in enumerate(secret_word):
                if ch == " ":
                    masked_chars.append("  ")
                elif ch == "-":
                    masked_chars.append("-")
                elif idx in revealed:
                    masked_chars.append(ch.upper())
                else:
                    masked_chars.append("_")
            masked_word = " ".join(masked_chars)

        if is_drawer and turn_state == "choosing":
            choices = gs.get("word_choices", [])
        else:
            choices = []

        gs["word"] = word_for_client
        gs["masked_word"] = masked_word
        gs["word_choices"] = choices
        gs["is_drawer"] = is_drawer
        gs["has_guessed"] = has_guessed
        if "secret_word" in gs and not (is_drawer or has_guessed or is_revealed_phase):
            del gs["secret_word"]

        # Only send last 80 chat messages to keep payload light
        if "chat_messages" in gs:
            if len( self.game_state.get("chat_messages", []) ) > 200:
                self.game_state["chat_messages"] = self.game_state["chat_messages"][-120:]
            gs["chat_messages"] = gs["chat_messages"][-80:]

        return gs

    def _start_drawing_turn(self, word: str, category: str) -> None:
        now = time.time()
        gs = self.game_state
        gs["turn_state"] = "drawing"
        gs["secret_word"] = word
        gs["category"] = category
        gs["turn_start_time"] = now
        gs["time_remaining"] = float(gs.get("draw_time", 80))
        gs["revealed_indices"] = []
        gs["guessed_player_ids"] = []
        gs["draw_actions"] = []
        gs["next_action_id"] = 1

        drawer_name = gs.get("active_drawer_name", "Tegneren")
        msg_id = gs.get("next_msg_id", 1)
        letter_count = len(word.replace(" ", "").replace("-", ""))
        gs["chat_messages"].append({
            "id": msg_id,
            "type": "system",
            "sender": "System",
            "text": f"🎨 {drawer_name} har valgt et ord ({letter_count} bokstaver, {category})! Begynn å gjette!",
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _end_drawing_turn(self, reason: str = "time_up") -> None:
        now = time.time()
        gs = self.game_state
        gs["turn_state"] = "round_recap"
        gs["recap_until"] = now + 4.5

        word = gs.get("secret_word", "").upper()
        guessed_count = len(gs.get("guessed_player_ids", []))
        msg_id = gs.get("next_msg_id", 1)

        if reason == "all_guessed":
            text = f"🌟 Fantastisk! Alle gjettet ordet: «{word}»!"
        else:
            text = f"⏰ Tiden er ute! Ordet var «{word}». {guessed_count} spiller(e) gjettet riktig."

        gs["chat_messages"].append({
            "id": msg_id,
            "type": "system_highlight",
            "sender": "System",
            "text": text,
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _advance_turn(self) -> None:
        now = time.time()
        gs = self.game_state
        turn_order = [pid for pid in gs.get("turn_order", []) if pid in self.players]
        if not turn_order:
            turn_order = list(self.players.keys())
        gs["turn_order"] = turn_order

        if not turn_order:
            self._end_tegn_og_gjett_game()
            return

        curr_turn_idx = gs.get("turn_idx", 0)
        next_turn_idx = curr_turn_idx + 1
        total_rounds = gs.get("total_rounds", 3)
        curr_round = gs.get("current_round", 1)

        if next_turn_idx >= len(turn_order):
            curr_round += 1
            next_turn_idx = 0
            if curr_round > total_rounds:
                self._end_tegn_og_gjett_game()
                return
            gs["current_round"] = curr_round

        next_drawer_id = turn_order[next_turn_idx]
        if next_drawer_id not in self.players and self.players:
            next_drawer_id = next(iter(self.players))

        drawer_name = self.players.get(next_drawer_id, {}).get("name", "Ukjent")
        triplet = get_random_word_triplet()

        gs["turn_idx"] = next_turn_idx
        gs["active_drawer_id"] = next_drawer_id
        gs["active_drawer_name"] = drawer_name
        gs["turn_state"] = "choosing"
        gs["time_remaining"] = 15.0
        gs["choice_deadline"] = now + 15.0
        gs["word_choices"] = triplet
        gs["secret_word"] = ""
        gs["category"] = ""
        gs["revealed_indices"] = []
        gs["guessed_player_ids"] = []
        gs["draw_actions"] = []
        gs["next_action_id"] = 1

        msg_id = gs.get("next_msg_id", 1)
        gs["chat_messages"].append({
            "id": msg_id,
            "type": "system",
            "sender": "System",
            "text": f"🔔 Runde {curr_round} av {total_rounds}: {drawer_name} velger et ord…",
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _end_tegn_og_gjett_game(self) -> None:
        now = time.time()
        gs = self.game_state
        gs["status"] = "game_over"
        gs["turn_state"] = "game_over"

        sorted_players = sorted(
            self.players.values(),
            key=lambda p: p.get("score", 0),
            reverse=True
        )

        podium = []
        for rank, p in enumerate(sorted_players[:3], start=1):
            podium.append({
                "rank": rank,
                "id": p["id"],
                "name": p["name"],
                "avatar": p["avatar"],
                "score": p["score"],
                "color": p["color"],
            })

        gs["podium"] = podium
        winner = sorted_players[0] if sorted_players else None
        gs["winner"] = winner

        msg_id = gs.get("next_msg_id", 1)
        winner_name = winner["name"] if winner else "Vinner"
        winner_score = winner["score"] if winner else 0
        gs["chat_messages"].append({
            "id": msg_id,
            "type": "winner",
            "sender": "System",
            "text": f"🏆 Spillet er over! Gratulerer til {winner_name} som vant med {winner_score} poeng!",
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _tick_tegn_og_gjett(self) -> None:
        gs = self.game_state
        if gs.get("status") != "playing":
            return

        now = time.time()
        turn_state = gs.get("turn_state")

        if turn_state == "choosing":
            deadline = gs.get("choice_deadline", now)
            remaining = max(0.0, deadline - now)
            gs["time_remaining"] = round(remaining, 1)
            if remaining <= 0:
                choices = gs.get("word_choices") or [{"word": "sol", "category": "Natur"}]
                chosen = choices[0]
                self._start_drawing_turn(chosen["word"], chosen.get("category", "Ting"))

        elif turn_state == "drawing":
            turn_start = gs.get("turn_start_time", now)
            duration = gs.get("draw_time", 80)
            elapsed = now - turn_start
            remaining = max(0.0, duration - elapsed)
            gs["time_remaining"] = round(remaining, 1)

            word = gs.get("secret_word", "")
            # Hint 1 at 50% elapsed
            if elapsed >= duration * 0.50 and len(word) >= 4:
                revealed = gs.setdefault("revealed_indices", [])
                if not revealed:
                    valid_idx = [i for i, c in enumerate(word) if c not in (" ", "-")]
                    if valid_idx:
                        revealed.append(random.choice(valid_idx))
                        self.bump()

            # Hint 2 at 75% elapsed
            if elapsed >= duration * 0.75 and len(word) >= 6:
                revealed = gs.setdefault("revealed_indices", [])
                valid_idx = [i for i, c in enumerate(word) if c not in (" ", "-") and i not in revealed]
                if len(revealed) == 1 and valid_idx:
                    revealed.append(random.choice(valid_idx))
                    self.bump()

            # Time is up
            if remaining <= 0:
                self._end_drawing_turn(reason="time_up")

        elif turn_state == "round_recap":
            recap_until = gs.get("recap_until", 0)
            remaining = max(0.0, recap_until - now)
            gs["time_remaining"] = round(remaining, 1)
            if now >= recap_until:
                self._advance_turn()

    def handle_tegn_og_gjett_action(self, player_id: str, body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self.lock:
            if self.current_game != "tegn_og_gjett":
                return 400, {"ok": False, "error": "Tegn & Gjett er ikke aktivt"}

            action = str(body.get("action") or "").strip()
            gs = self.game_state
            player = self.players.get(player_id)
            if not player:
                return 403, {"ok": False, "error": "Spiller ikke funnet i rommet"}

            if action == "choose_word":
                if gs.get("turn_state") != "choosing":
                    return 400, {"ok": False, "error": "Ikke i ordvalg-fase"}
                if gs.get("active_drawer_id") != player_id:
                    return 403, {"ok": False, "error": "Bare den aktive tegneren kan velge ord"}

                chosen_word = str(body.get("word") or "").strip().lower()
                valid_words = [w["word"].lower() for w in gs.get("word_choices", [])]
                category = "Ting"
                for w in gs.get("word_choices", []):
                    if w["word"].lower() == chosen_word:
                        category = w.get("category", "Ting")
                        break

                if chosen_word not in valid_words and valid_words:
                    chosen_word = valid_words[0]

                self._start_drawing_turn(chosen_word, category)
                return 200, {"ok": True, "word": chosen_word}

            elif action == "draw":
                if gs.get("turn_state") != "drawing":
                    return 400, {"ok": False, "error": "Tegning er ikke aktiv"}
                if gs.get("active_drawer_id") != player_id:
                    return 403, {"ok": False, "error": "Bare den aktive tegneren kan tegne"}

                new_actions = body.get("actions") or []
                if not isinstance(new_actions, list):
                    return 400, {"ok": False, "error": "actions må være en liste"}

                draw_actions = gs.setdefault("draw_actions", [])
                next_id = gs.get("next_action_id", 1)

                for act in new_actions[:150]:
                    if isinstance(act, dict):
                        act_copy = dict(act)
                        act_copy["id"] = next_id
                        next_id += 1
                        draw_actions.append(act_copy)

                gs["next_action_id"] = next_id
                self.touch()
                return 200, {"ok": True, "lastActionId": next_id - 1}

            elif action == "clear_canvas":
                if gs.get("turn_state") != "drawing":
                    return 400, {"ok": False, "error": "Tegning er ikke aktiv"}
                if gs.get("active_drawer_id") != player_id:
                    return 403, {"ok": False, "error": "Bare den aktive tegneren kan tømme lerretet"}

                draw_actions = gs.setdefault("draw_actions", [])
                next_id = gs.get("next_action_id", 1)
                draw_actions.append({"id": next_id, "type": "clear", "color": "#ffffff"})
                gs["next_action_id"] = next_id + 1
                self.touch()
                return 200, {"ok": True, "lastActionId": next_id}

            elif action == "guess":
                if gs.get("turn_state") != "drawing":
                    return 400, {"ok": False, "error": "Runden er ikke aktiv nå"}
                if gs.get("active_drawer_id") == player_id:
                    return 400, {"ok": False, "error": "Tegneren kan ikke gjette"}

                guessed_ids = gs.setdefault("guessed_player_ids", [])
                if player_id in guessed_ids:
                    return 400, {"ok": False, "error": "Du har allerede gjettet ordet!"}

                text = str(body.get("text") or "").strip()
                if not text:
                    return 400, {"ok": False, "error": "Tom gjetning"}

                secret_word = gs.get("secret_word", "").lower()
                clean_guess = text.lower()
                now = time.time()
                msg_id = gs.get("next_msg_id", 1)

                if clean_guess == secret_word:
                    turn_start = gs.get("turn_start_time", now)
                    duration = gs.get("draw_time", 80)
                    elapsed = now - turn_start
                    frac = max(0.0, min(1.0, 1.0 - (elapsed / duration)))
                    points = int(100 + frac * 300)
                    if len(guessed_ids) == 0:
                        points += 50

                    player["score"] = player.get("score", 0) + points

                    drawer_id = gs.get("active_drawer_id")
                    drawer = self.players.get(drawer_id or "")
                    if drawer:
                        drawer["score"] = drawer.get("score", 0) + 75

                    guessed_ids.append(player_id)

                    gs["chat_messages"].append({
                        "id": msg_id,
                        "type": "correct",
                        "sender": player["name"],
                        "text": f"gjettet ordet! (+{points}p)",
                        "points": points,
                        "timestamp": now,
                    })
                    gs["next_msg_id"] = msg_id + 1

                    active_guessers = [pid for pid in self.players if pid != drawer_id]
                    other_count = max(1, len(active_guessers))
                    if len(guessed_ids) >= other_count:
                        self._end_drawing_turn(reason="all_guessed")
                    else:
                        self.bump()

                    return 200, {
                        "ok": True,
                        "correct": True,
                        "points": points,
                        "word": secret_word,
                        "chatMessages": gs["chat_messages"][-80:],
                    }
                else:
                    is_close = is_close_guess(clean_guess, secret_word)
                    if is_close:
                        return 200, {
                            "ok": True,
                            "correct": False,
                            "close": True,
                            "guess": text,
                        }
                    else:
                        gs["chat_messages"].append({
                            "id": msg_id,
                            "type": "guess",
                            "sender": player["name"],
                            "text": text,
                            "timestamp": now,
                        })
                        gs["next_msg_id"] = msg_id + 1
                        self.bump()
                        return 200, {
                            "ok": True,
                            "correct": False,
                            "close": False,
                            "chatMessages": gs["chat_messages"][-80:],
                        }

            elif action == "restart":
                host_token = str(body.get("hostToken") or "").strip()
                if self.host_token != host_token:
                    return 403, {"ok": False, "error": "Kun verten kan starte spillet på nytt"}
                self.start_tegn_og_gjett(body.get("settings") or {})
                return 200, {"ok": True}

            elif action == "to_lobby":
                host_token = str(body.get("hostToken") or "").strip()
                is_host_req = bool(self.host_token and self.host_token == host_token)
                is_game_over = gs.get("status") == "game_over" or gs.get("turn_state") == "game_over"
                if not (is_host_req or is_game_over):
                    return 403, {"ok": False, "error": "Kun verten kan gå tilbake til lobby mens spillet pågår"}
                self.current_game = None
                self.game_state = {}
                self.bump()
                return 200, {"ok": True}

            return 400, {"ok": False, "error": f"Ukjent handling «{action}»"}

    def get_draw_actions_since(self, since_id: int) -> Tuple[List[Dict[str, Any]], int]:
        with self.lock:
            if self.current_game not in ("tegn_og_gjett", "imposter"):
                return [], 0
            actions = self.game_state.get("draw_actions", [])
            last_id = self.game_state.get("next_action_id", 1) - 1
            if since_id <= 0:
                return list(actions), last_id
            return [a for a in actions if a.get("id", 0) > since_id], last_id

    # --- IMPOSTER (TEGN-IMPOSTER) ENGINE ---

    def start_imposter(self, settings: Dict[str, Any], keep_scores: bool = False) -> None:
        with self.lock:
            self.current_game = "imposter"
            stroke_time = int(settings.get("strokeTime") or 25)
            vote_time = int(settings.get("voteTime") or 45)
            max_guesses = int(settings.get("imposterGuesses") or 2)

            active_ids = list(self.players.keys())
            if not active_ids:
                return

            random.shuffle(active_ids)
            if not keep_scores:
                for p in self.players.values():
                    p["score"] = 0
                    p["lives"] = 3
                    p["eliminated"] = False

            imposter_id = random.choice(active_ids)
            pair = get_random_imposter_pair()
            now = time.time()
            first_drawer_id = active_ids[0]
            first_drawer_name = self.players[first_drawer_id]["name"]
            prev_match_num = int(self.game_state.get("match_number", 0)) if keep_scores else 0

            self.game_state = {
                "status": "playing",
                "settings": {
                    "strokeTime": stroke_time,
                    "voteTime": vote_time,
                    "imposterGuesses": max_guesses,
                },
                "match_number": prev_match_num + 1,
                "stroke_round": 1,
                "turn_order": active_ids,
                "turn_idx": 0,
                "active_drawer_id": first_drawer_id,
                "active_drawer_name": first_drawer_name,
                "imposter_id": imposter_id,
                "category": pair["category"],
                "crew_word": pair["crew_word"],
                "imposter_word": pair["imposter_word"],
                "turn_state": "drawing",  # "drawing", "voting", "imposter_last_chance", "round_over"
                "stroke_time": stroke_time,
                "vote_time": vote_time,
                "phase_start_time": now,
                "time_remaining": float(stroke_time),
                "imposter_guesses_left": max_guesses,
                "votes": {},  # voter_id -> target_player_id or "skip"
                "draw_actions": [],
                "next_action_id": 1,
                "has_drawn_in_turn": False,
                "winner_team": None,  # "crew" or "imposter"
                "win_reason": "",
                "accused_id": None,
                "winning_guess": None,
                "chat_messages": [
                    {
                        "id": 1,
                        "type": "system",
                        "sender": "System",
                        "text": f"🕵️ Imposter har startet! Kategori: «{pair['category']}». Alle får tegne én strek hver per runde. {first_drawer_name} starter!",
                        "timestamp": now,
                    }
                ],
                "next_msg_id": 2,
            }
            self.bump()

    def _get_imposter_public_state(self, client_player_id: Optional[str]) -> Dict[str, Any]:
        gs = dict(self.game_state)
        imposter_id = gs.get("imposter_id")
        turn_state = gs.get("turn_state", "drawing")
        is_imposter = bool(client_player_id and client_player_id == imposter_id)
        is_revealed = turn_state in ("imposter_last_chance", "round_over")

        # Secret word & role masking per player
        gs["is_imposter"] = is_imposter
        gs["my_role"] = "imposter" if is_imposter else "crew"
        gs["my_word"] = gs.get("imposter_word") if is_imposter else gs.get("crew_word")
        gs["is_drawer"] = bool(client_player_id and client_player_id == gs.get("active_drawer_id"))

        # Hide secret words & imposter identity until revealed
        if not is_revealed:
            gs.pop("crew_word", None)
            gs.pop("imposter_word", None)
        if not is_revealed and not is_imposter:
            gs.pop("imposter_id", None)
        elif is_revealed:
            imp_player = self.players.get(imposter_id or "", {})
            gs["imposter_name"] = imp_player.get("name", "Imposter")
            gs["imposter_avatar"] = imp_player.get("avatar", "charbear")
            gs["imposter_color"] = imp_player.get("color", "#ef4444")

        # Summarize votes safely
        votes_map = gs.get("votes") or {}
        vote_counts: Dict[str, int] = {}
        for v_target in votes_map.values():
            vote_counts[v_target] = vote_counts.get(v_target, 0) + 1
        gs["vote_counts"] = vote_counts
        gs["voted_player_ids"] = list(votes_map.keys())
        gs["my_vote"] = votes_map.get(client_player_id or "")

        if "chat_messages" in gs:
            if len(self.game_state.get("chat_messages", [])) > 200:
                self.game_state["chat_messages"] = self.game_state["chat_messages"][-120:]
            gs["chat_messages"] = gs["chat_messages"][-80:]

        return gs

    def _advance_imposter_stroke_turn(self) -> None:
        now = time.time()
        gs = self.game_state
        turn_order = [pid for pid in gs.get("turn_order", []) if pid in self.players]
        if not turn_order:
            turn_order = list(self.players.keys())
        gs["turn_order"] = turn_order

        if not turn_order:
            return

        next_idx = gs.get("turn_idx", 0) + 1
        if next_idx >= len(turn_order):
            # All players have drawn their 1 stroke in this round -> enter voting!
            gs["turn_state"] = "voting"
            gs["phase_start_time"] = now
            gs["time_remaining"] = float(gs.get("vote_time", 45))
            gs["votes"] = {}
            gs["has_drawn_in_turn"] = False
            msg_id = gs.get("next_msg_id", 1)
            gs["chat_messages"].append({
                "id": msg_id,
                "type": "system_highlight",
                "sender": "System",
                "text": f"🗳️ Strekrunde {gs.get('stroke_round', 1)} er ferdig! Diskuter i chatten og stem på hvem dere tror er Imposter – eller stem for en ny runde med streker!",
                "timestamp": now,
            })
            gs["next_msg_id"] = msg_id + 1
            self.bump()
            return

        next_drawer_id = turn_order[next_idx]
        next_drawer_name = self.players.get(next_drawer_id, {}).get("name", "Spiller")
        gs["turn_idx"] = next_idx
        gs["active_drawer_id"] = next_drawer_id
        gs["active_drawer_name"] = next_drawer_name
        gs["turn_state"] = "drawing"
        gs["phase_start_time"] = now
        gs["time_remaining"] = float(gs.get("stroke_time", 25))
        gs["has_drawn_in_turn"] = False

        msg_id = gs.get("next_msg_id", 1)
        gs["chat_messages"].append({
            "id": msg_id,
            "type": "system",
            "sender": "System",
            "text": f"✏️ Det er {next_drawer_name} sin tur til å tegne én strek!",
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _resolve_imposter_votes(self) -> None:
        now = time.time()
        gs = self.game_state
        votes_map: Dict[str, str] = gs.get("votes") or {}

        counts: Dict[str, int] = {}
        for target in votes_map.values():
            counts[target] = counts.get(target, 0) + 1

        if not counts:
            top_target = "skip"
            is_tie = False
        else:
            sorted_targets = sorted(counts.items(), key=lambda x: x[1], reverse=True)
            top_target, top_count = sorted_targets[0]
            is_tie = len(sorted_targets) > 1 and sorted_targets[1][1] == top_count

        if top_target == "skip" or is_tie:
            # Start another round of 1-line strokes!
            turn_order = [pid for pid in gs.get("turn_order", []) if pid in self.players]
            if not turn_order:
                turn_order = list(self.players.keys())
            gs["turn_order"] = turn_order
            gs["stroke_round"] = int(gs.get("stroke_round", 1)) + 1
            gs["turn_idx"] = 0
            first_id = turn_order[0] if turn_order else ""
            first_name = self.players.get(first_id, {}).get("name", "Spiller")
            gs["active_drawer_id"] = first_id
            gs["active_drawer_name"] = first_name
            gs["turn_state"] = "drawing"
            gs["phase_start_time"] = now
            gs["time_remaining"] = float(gs.get("stroke_time", 25))
            gs["votes"] = {}
            gs["has_drawn_in_turn"] = False

            reason_txt = "Stemmene ble uavgjort!" if is_tie else "Flertallet stemte for en ny runde med streker!"
            msg_id = gs.get("next_msg_id", 1)
            gs["chat_messages"].append({
                "id": msg_id,
                "type": "system_highlight",
                "sender": "System",
                "text": f"🎨 {reason_txt} Strekrunde {gs['stroke_round']} starter – {first_name} tegner først!",
                "timestamp": now,
            })
            gs["next_msg_id"] = msg_id + 1
            self.bump()
            return

        # A specific player was voted out!
        accused_id = top_target
        gs["accused_id"] = accused_id
        imposter_id = gs.get("imposter_id")
        accused_name = self.players.get(accused_id, {}).get("name", "Spiller")

        if accused_id == imposter_id:
            # Crew caught the Imposter! Give Imposter 1 last chance (20s) to guess the Crew's word!
            gs["turn_state"] = "imposter_last_chance"
            gs["phase_start_time"] = now
            gs["time_remaining"] = 20.0
            msg_id = gs.get("next_msg_id", 1)
            gs["chat_messages"].append({
                "id": msg_id,
                "type": "system_highlight",
                "sender": "System",
                "text": f"🚨 Crew avslørte {accused_name} som Imposter! {accused_name} får nå 20 sekunder og ett siste forsøk på å gjette Crew-ordet!",
                "timestamp": now,
            })
            gs["next_msg_id"] = msg_id + 1
            self.bump()
        else:
            # Crew voted out an innocent player -> Imposter wins!
            self._end_imposter_round(
                winner_team="imposter",
                reason=f"Crew stemte ut feil person ({accused_name} var uskyldig)!",
                accused_id=accused_id,
            )

    def _end_imposter_round(
        self,
        winner_team: str,
        reason: str,
        accused_id: Optional[str] = None,
        winning_guess: Optional[str] = None,
    ) -> None:
        now = time.time()
        gs = self.game_state
        gs["status"] = "round_over"
        gs["turn_state"] = "round_over"
        gs["winner_team"] = winner_team
        gs["win_reason"] = reason
        if accused_id:
            gs["accused_id"] = accused_id
        if winning_guess:
            gs["winning_guess"] = winning_guess

        imposter_id = gs.get("imposter_id")
        imposter_player = self.players.get(imposter_id or "")
        imposter_name = imposter_player["name"] if imposter_player else "Imposter"
        crew_word = gs.get("crew_word", "")
        imposter_word = gs.get("imposter_word", "")
        votes_map = gs.get("votes") or {}

        if winner_team == "imposter":
            if imposter_player:
                imposter_player["score"] = imposter_player.get("score", 0) + 300
            headline = f"🕵️ Imposteren ({imposter_name}) vant! {reason}"
        else:
            for pid, p in self.players.items():
                if pid != imposter_id:
                    bonus = 50 if votes_map.get(pid) == imposter_id else 0
                    p["score"] = p.get("score", 0) + 150 + bonus
            headline = f"🎉 Crew vant! {reason}"

        msg_id = gs.get("next_msg_id", 1)
        gs["chat_messages"].append({
            "id": msg_id,
            "type": "winner",
            "sender": "System",
            "text": f"{headline} Crew-ordet var «{crew_word.upper()}» (Imposterens dekkord: «{imposter_word.upper()}»).",
            "timestamp": now,
        })
        gs["next_msg_id"] = msg_id + 1
        self.bump()

    def _tick_imposter(self) -> None:
        gs = self.game_state
        if gs.get("status") != "playing":
            return

        now = time.time()
        turn_state = gs.get("turn_state")
        phase_start = gs.get("phase_start_time", now)

        if turn_state == "drawing":
            duration = float(gs.get("stroke_time", 25))
            remaining = max(0.0, duration - (now - phase_start))
            gs["time_remaining"] = round(remaining, 1)
            if remaining <= 0:
                self._advance_imposter_stroke_turn()

        elif turn_state == "voting":
            duration = float(gs.get("vote_time", 45))
            remaining = max(0.0, duration - (now - phase_start))
            gs["time_remaining"] = round(remaining, 1)
            if remaining <= 0:
                self._resolve_imposter_votes()

        elif turn_state == "imposter_last_chance":
            remaining = max(0.0, 20.0 - (now - phase_start))
            gs["time_remaining"] = round(remaining, 1)
            if remaining <= 0:
                imposter_id = gs.get("imposter_id")
                imposter_name = self.players.get(imposter_id or "", {}).get("name", "Imposteren")
                self._end_imposter_round(
                    winner_team="crew",
                    reason=f"{imposter_name} ble avslørt og rakk ikke å gjette Crew-ordet i tide!",
                )

    def handle_imposter_action(self, player_id: str, body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self.lock:
            if self.current_game != "imposter":
                return 400, {"ok": False, "error": "Imposter er ikke aktivt"}

            action = str(body.get("action") or "").strip()
            gs = self.game_state
            player = self.players.get(player_id)
            if not player:
                return 403, {"ok": False, "error": "Spiller ikke funnet i rommet"}

            now = time.time()

            if action == "draw":
                if gs.get("turn_state") != "drawing":
                    return 400, {"ok": False, "error": "Tegning er ikke aktiv nå"}
                if gs.get("active_drawer_id") != player_id:
                    return 403, {"ok": False, "error": "Det er ikke din tur til å tegne"}
                if gs.get("has_drawn_in_turn"):
                    return 400, {"ok": False, "error": "Du har allerede tegnet din ene strek denne runden"}

                new_actions = body.get("actions") or []
                if not isinstance(new_actions, list):
                    return 400, {"ok": False, "error": "actions må være en liste"}

                draw_actions = gs.setdefault("draw_actions", [])
                next_id = gs.get("next_action_id", 1)

                for act in new_actions[:200]:
                    if isinstance(act, dict):
                        act_copy = dict(act)
                        act_copy["id"] = next_id
                        act_copy["drawerId"] = player_id
                        next_id += 1
                        draw_actions.append(act_copy)

                gs["next_action_id"] = next_id
                self.touch()

                if body.get("finishStroke"):
                    gs["has_drawn_in_turn"] = True
                    self._advance_imposter_stroke_turn()

                return 200, {"ok": True, "lastActionId": next_id - 1}

            elif action == "finish_stroke":
                if gs.get("turn_state") != "drawing":
                    return 400, {"ok": False, "error": "Ikke i tegnefase"}
                if gs.get("active_drawer_id") != player_id:
                    return 403, {"ok": False, "error": "Det er ikke din tur"}
                gs["has_drawn_in_turn"] = True
                self._advance_imposter_stroke_turn()
                return 200, {"ok": True}

            elif action == "vote":
                if gs.get("turn_state") != "voting":
                    return 400, {"ok": False, "error": "Avstemning er ikke aktiv nå"}
                target_id = str(body.get("targetId") or "").strip()
                if target_id != "skip" and target_id not in self.players:
                    return 400, {"ok": False, "error": "Ugyldig stemmemål"}

                votes = gs.setdefault("votes", {})
                votes[player_id] = target_id
                self.bump()

                # Check if everyone in the room has voted
                if len(votes) >= len(self.players):
                    self._resolve_imposter_votes()

                return 200, {"ok": True, "myVote": target_id}

            elif action == "imposter_guess":
                imposter_id = gs.get("imposter_id")
                if player_id != imposter_id:
                    return 403, {"ok": False, "error": "Kun Imposteren kan gjette Crew-ordet!"}

                turn_state = gs.get("turn_state")
                if turn_state not in ("drawing", "voting", "imposter_last_chance"):
                    return 400, {"ok": False, "error": "Kan ikke gjette nå"}

                guess_text = str(body.get("guess") or "").strip()
                if not guess_text:
                    return 400, {"ok": False, "error": "Skriv inn et ord å gjette"}

                crew_word = gs.get("crew_word", "")

                if turn_state == "imposter_last_chance":
                    if is_matching_word(guess_text, crew_word):
                        self._end_imposter_round(
                            winner_team="imposter",
                            reason=f"{player['name']} gjettet Crew-ordet «{crew_word.upper()}» på siste forsøk og stjal seieren!",
                            winning_guess=guess_text,
                        )
                        return 200, {"ok": True, "correct": True}
                    else:
                        self._end_imposter_round(
                            winner_team="crew",
                            reason=f"{player['name']} ble avslørt og gjettet feil på siste forsøk («{guess_text}»)!",
                            winning_guess=guess_text,
                        )
                        return 200, {"ok": True, "correct": False}

                # Normal guess during drawing or voting
                guesses_left = int(gs.get("imposter_guesses_left", 0))
                if guesses_left <= 0:
                    return 400, {"ok": False, "error": "Du har brukt opp dine forsøk underveis!"}

                guesses_left -= 1
                gs["imposter_guesses_left"] = guesses_left

                if is_matching_word(guess_text, crew_word):
                    self._end_imposter_round(
                        winner_team="imposter",
                        reason=f"Imposteren ({player['name']}) gjettet Crew-ordet «{crew_word.upper()}» før Crew avslørte hen!",
                        winning_guess=guess_text,
                    )
                    return 200, {"ok": True, "correct": True, "guessesLeft": guesses_left}
                else:
                    msg_id = gs.get("next_msg_id", 1)
                    gs["chat_messages"].append({
                        "id": msg_id,
                        "type": "system_highlight",
                        "sender": "System",
                        "text": f"🕵️ Imposteren prøvde å gjette Crew-ordet med «{guess_text}» – FEIL! ({guesses_left} forsøk igjen)",
                        "timestamp": now,
                    })
                    gs["next_msg_id"] = msg_id + 1
                    self.bump()
                    return 200, {
                        "ok": True,
                        "correct": False,
                        "guessesLeft": guesses_left,
                        "chatMessages": gs["chat_messages"][-80:],
                    }

            elif action == "chat":
                text = str(body.get("text") or "").strip()[:140]
                if not text:
                    return 400, {"ok": False, "error": "Tom melding"}
                msg_id = gs.get("next_msg_id", 1)
                gs["chat_messages"].append({
                    "id": msg_id,
                    "type": "chat",
                    "sender": player["name"],
                    "senderColor": player.get("color", "#ffd166"),
                    "text": text,
                    "timestamp": now,
                })
                gs["next_msg_id"] = msg_id + 1
                self.bump()
                return 200, {"ok": True, "chatMessages": gs["chat_messages"][-80:]}

            elif action in ("next_round", "restart"):
                host_token = str(body.get("hostToken") or "").strip()
                is_host_req = bool(
                    (host_token and self.host_token == host_token)
                    or (player_id and self.host_id == player_id)
                )
                if not is_host_req and gs.get("turn_state") != "round_over":
                    return 403, {"ok": False, "error": "Kun verten kan starte ny runde mens spillet pågår"}
                keep_scores = action == "next_round"
                self.start_imposter(gs.get("settings") or {}, keep_scores=keep_scores)
                return 200, {"ok": True}

            elif action == "to_lobby":
                host_token = str(body.get("hostToken") or "").strip()
                is_host_req = bool(
                    (host_token and self.host_token == host_token)
                    or (player_id and self.host_id == player_id)
                )
                if not (is_host_req or gs.get("turn_state") == "round_over"):
                    return 403, {"ok": False, "error": "Kun verten kan gå tilbake til lobby mens spillet pågår"}
                self.current_game = None
                self.game_state = {}
                self.bump()
                return 200, {"ok": True}

            return 400, {"ok": False, "error": f"Ukjent handling «{action}»"}

    # --- FARGEKODEN (HUES AND CUES) ENGINE ---

    @staticmethod
    def _generate_color_candidates() -> List[List[int]]:
        """Generate 4 distinct candidate coordinates [r, c] on the 16x30 color board."""
        candidates: List[List[int]] = []
        col_buckets = [random.randint(2, 7), random.randint(8, 14), random.randint(15, 21), random.randint(22, 27)]
        random.shuffle(col_buckets)
        for c in col_buckets:
            r = random.randint(2, 13)
            candidates.append([r, c])
        return candidates

    def start_fargekoden(self, settings: Dict[str, Any]) -> None:
        with self.lock:
            self.current_game = "fargekoden"
            rounds = int(settings.get("rounds") or 1)
            guess_time = int(settings.get("guessTime") or 35)

            active_ids = list(self.players.keys())
            if not active_ids:
                return

            random.shuffle(active_ids)
            for p in self.players.values():
                p["score"] = 0
                p["lives"] = 3
                p["eliminated"] = False

            first_giver_id = active_ids[0]
            first_giver_name = self.players[first_giver_id]["name"]
            candidates = self._generate_color_candidates()
            now = time.time()

            self.game_state = {
                "status": "playing",
                "settings": {"rounds": rounds, "guessTime": guess_time},
                "total_rounds": rounds,
                "current_round": 1,
                "turn_order": active_ids,
                "turn_idx": 0,
                "active_giver_id": first_giver_id,
                "active_giver_name": first_giver_name,
                "turn_state": "giving_clue_1",  # "giving_clue_1", "guessing_1", "giving_clue_2", "guessing_2", "turn_recap", "game_over"
                "candidates": candidates,
                "target_pos": candidates[0],
                "clue_1": "",
                "clue_2": "",
                "markers": [],  # [{playerId, playerName, playerColor, playerAvatar, r, c, guessRound, points}]
                "guessed_in_step": [],
                "phase_start_time": now,
                "phase_duration": 30.0,
                "time_remaining": 30.0,
                "last_turn_summary": None,
                "podium": [],
                "winner": None,
            }
            self.bump()

    def _get_fargekoden_public_state(self, client_player_id: Optional[str]) -> Dict[str, Any]:
        gs = dict(self.game_state)
        giver_id = gs.get("active_giver_id")
        turn_state = gs.get("turn_state", "giving_clue_1")
        is_giver = bool(client_player_id and client_player_id == giver_id)
        is_revealed = turn_state in ("turn_recap", "game_over")

        gs["is_giver"] = is_giver
        if not is_giver and not is_revealed:
            gs.pop("target_pos", None)
            gs.pop("candidates", None)

        guessed_step = gs.get("guessed_in_step") or []
        gs["has_placed_this_step"] = bool(client_player_id and client_player_id in guessed_step)
        return gs

    def _score_fargekoden_turn(self) -> None:
        now = time.time()
        gs = self.game_state
        target = gs.get("target_pos") or [7, 15]
        tr, tc = int(target[0]), int(target[1])
        giver_id = gs.get("active_giver_id")
        markers = gs.get("markers") or []

        giver_bonus = 0
        player_turn_gains: Dict[str, int] = {}

        for m in markers:
            mr, mc = int(m["r"]), int(m["c"])
            dist = max(abs(mr - tr), abs(mc - tc))
            pts = 0
            if dist == 0:
                pts = 3
                giver_bonus += 1
            elif dist == 1:
                pts = 2
                giver_bonus += 1
            elif dist == 2:
                pts = 1
            m["points"] = pts
            pid = m["playerId"]
            if pid in self.players:
                self.players[pid]["score"] = self.players[pid].get("score", 0) + pts
                player_turn_gains[pid] = player_turn_gains.get(pid, 0) + pts

        if giver_id and giver_id in self.players:
            self.players[giver_id]["score"] = self.players[giver_id].get("score", 0) + giver_bonus
            player_turn_gains[giver_id] = giver_bonus

        gs["turn_state"] = "turn_recap"
        gs["phase_start_time"] = now
        gs["phase_duration"] = 10.0
        gs["time_remaining"] = 10.0
        gs["last_turn_summary"] = {
            "targetPos": [tr, tc],
            "clue1": gs.get("clue_1", ""),
            "clue2": gs.get("clue_2", ""),
            "giverName": gs.get("active_giver_name", ""),
            "giverBonus": giver_bonus,
            "gains": player_turn_gains,
        }
        self.bump()

    def _advance_fargekoden_turn(self) -> None:
        now = time.time()
        gs = self.game_state
        turn_order = [pid for pid in gs.get("turn_order", []) if pid in self.players]
        if not turn_order:
            turn_order = list(self.players.keys())
        gs["turn_order"] = turn_order

        if not turn_order:
            return

        next_idx = int(gs.get("turn_idx", 0)) + 1
        curr_round = int(gs.get("current_round", 1))
        total_rounds = int(gs.get("total_rounds", 1))

        if next_idx >= len(turn_order):
            next_idx = 0
            curr_round += 1
            if curr_round > total_rounds:
                # Game over!
                gs["status"] = "game_over"
                gs["turn_state"] = "game_over"
                sorted_p = sorted(self.players.values(), key=lambda p: p.get("score", 0), reverse=True)
                gs["podium"] = [
                    {
                        "rank": idx + 1,
                        "id": p["id"],
                        "name": p["name"],
                        "avatar": p["avatar"],
                        "color": p["color"],
                        "score": p["score"],
                    }
                    for idx, p in enumerate(sorted_p[:3])
                ]
                gs["winner"] = sorted_p[0] if sorted_p else None
                self.bump()
                return

        next_giver_id = turn_order[next_idx]
        next_giver_name = self.players.get(next_giver_id, {}).get("name", "Spiller")
        candidates = self._generate_color_candidates()

        gs["current_round"] = curr_round
        gs["turn_idx"] = next_idx
        gs["active_giver_id"] = next_giver_id
        gs["active_giver_name"] = next_giver_name
        gs["turn_state"] = "giving_clue_1"
        gs["candidates"] = candidates
        gs["target_pos"] = candidates[0]
        gs["clue_1"] = ""
        gs["clue_2"] = ""
        gs["markers"] = []
        gs["guessed_in_step"] = []
        gs["phase_start_time"] = now
        gs["phase_duration"] = 30.0
        gs["time_remaining"] = 30.0
        self.bump()

    def _tick_fargekoden(self) -> None:
        gs = self.game_state
        if gs.get("status") != "playing":
            return

        now = time.time()
        turn_state = gs.get("turn_state")
        phase_start = float(gs.get("phase_start_time", now))
        duration = float(gs.get("phase_duration", 30.0))
        remaining = max(0.0, duration - (now - phase_start))
        gs["time_remaining"] = round(remaining, 1)

        if remaining > 0:
            return

        if turn_state == "giving_clue_1":
            # Auto-submit fallback 1-word clue if Cue Giver timed out
            if not gs.get("clue_1"):
                gs["clue_1"] = "Mysterie"
            gs["turn_state"] = "guessing_1"
            gs["guessed_in_step"] = []
            gs["phase_start_time"] = now
            gs["phase_duration"] = float(gs.get("settings", {}).get("guessTime", 35))
            gs["time_remaining"] = gs["phase_duration"]
            self.bump()
        elif turn_state == "guessing_1":
            gs["turn_state"] = "giving_clue_2"
            gs["guessed_in_step"] = []
            gs["phase_start_time"] = now
            gs["phase_duration"] = 25.0
            gs["time_remaining"] = 25.0
            self.bump()
        elif turn_state == "giving_clue_2":
            # Timed out on clue 2 -> go straight to scoring!
            self._score_fargekoden_turn()
        elif turn_state == "guessing_2":
            self._score_fargekoden_turn()
        elif turn_state == "turn_recap":
            self._advance_fargekoden_turn()

    def handle_fargekoden_action(self, player_id: str, body: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        with self.lock:
            if self.current_game != "fargekoden":
                return 400, {"ok": False, "error": "Fargekoden er ikke aktivt"}

            action = str(body.get("action") or "").strip()
            gs = self.game_state
            player = self.players.get(player_id)
            if not player:
                return 403, {"ok": False, "error": "Spiller ikke funnet i rommet"}

            now = time.time()

            if action == "select_candidate":
                if gs.get("active_giver_id") != player_id or gs.get("turn_state") != "giving_clue_1":
                    return 403, {"ok": False, "error": "Kan ikke velge farge nå"}
                r = int(body.get("r", 7))
                c = int(body.get("c", 15))
                if 0 <= r < 16 and 0 <= c < 30:
                    gs["target_pos"] = [r, c]
                    self.bump()
                return 200, {"ok": True, "targetPos": gs["target_pos"]}

            elif action == "submit_clue_1":
                if gs.get("active_giver_id") != player_id or gs.get("turn_state") != "giving_clue_1":
                    return 403, {"ok": False, "error": "Bare hintgiveren kan gi første hint nå"}
                clue_raw = str(body.get("clue") or "").strip()[:32]
                words = clue_raw.split()
                if not words:
                    return 400, {"ok": False, "error": "Skriv inn et ett-ords hint!"}
                if len(words) > 1:
                    return 400, {"ok": False, "error": "Første hint kan bare være ETT ord!"}

                if "r" in body and "c" in body:
                    r, c = int(body["r"]), int(body["c"])
                    if 0 <= r < 16 and 0 <= c < 30:
                        gs["target_pos"] = [r, c]

                gs["clue_1"] = words[0]
                gs["turn_state"] = "guessing_1"
                gs["guessed_in_step"] = []
                gs["phase_start_time"] = now
                gs["phase_duration"] = float(gs.get("settings", {}).get("guessTime", 35))
                gs["time_remaining"] = gs["phase_duration"]
                self.bump()
                return 200, {"ok": True}

            elif action == "submit_clue_2":
                if gs.get("active_giver_id") != player_id or gs.get("turn_state") != "giving_clue_2":
                    return 403, {"ok": False, "error": "Bare hintgiveren kan gi andre hint nå"}
                clue_raw = str(body.get("clue") or "").strip()[:45]
                words = clue_raw.split()
                if not words:
                    return 400, {"ok": False, "error": "Skriv inn et hint på opptil to ord!"}
                if len(words) > 2:
                    return 400, {"ok": False, "error": "Andre hint kan være maks TO ord!"}

                gs["clue_2"] = " ".join(words)
                gs["turn_state"] = "guessing_2"
                gs["guessed_in_step"] = []
                gs["phase_start_time"] = now
                gs["phase_duration"] = float(gs.get("settings", {}).get("guessTime", 35))
                gs["time_remaining"] = gs["phase_duration"]
                self.bump()
                return 200, {"ok": True}

            elif action == "skip_clue_2":
                if gs.get("active_giver_id") != player_id or gs.get("turn_state") != "giving_clue_2":
                    return 403, {"ok": False, "error": "Kan ikke hoppe over nå"}
                self._score_fargekoden_turn()
                return 200, {"ok": True}

            elif action == "place_marker":
                turn_state = gs.get("turn_state")
                if turn_state not in ("guessing_1", "guessing_2"):
                    return 400, {"ok": False, "error": "Ikke i gjettefase nå"}
                if gs.get("active_giver_id") == player_id and len(self.players) > 1:
                    return 403, {"ok": False, "error": "Hintgiveren plasserer ikke brikker"}

                guessed_step = gs.setdefault("guessed_in_step", [])
                if player_id in guessed_step:
                    return 400, {"ok": False, "error": "Du har allerede plassert brikken din i denne fasen"}

                r = int(body.get("r", -1))
                c = int(body.get("c", -1))
                if not (0 <= r < 16 and 0 <= c < 30):
                    return 400, {"ok": False, "error": "Ugyldig rute på fargebrettet"}

                markers = gs.setdefault("markers", [])
                for existing in markers:
                    if existing["r"] == r and existing["c"] == c:
                        return 400, {"ok": False, "error": "Denne fargeruten er allerede tatt av en brikke!"}

                guess_round = 1 if turn_state == "guessing_1" else 2
                markers.append({
                    "playerId": player_id,
                    "playerName": player["name"],
                    "playerColor": player.get("color", "#ffd166"),
                    "playerAvatar": player.get("avatar", "charbear"),
                    "r": r,
                    "c": c,
                    "guessRound": guess_round,
                    "points": 0,
                })
                guessed_step.append(player_id)
                self.bump()

                # Check if all eligible guessers have placed their marker
                expected_guessers = max(1, len(self.players) - (1 if len(self.players) > 1 else 0))
                if len(guessed_step) >= expected_guessers:
                    if turn_state == "guessing_1":
                        gs["turn_state"] = "giving_clue_2"
                        gs["guessed_in_step"] = []
                        gs["phase_start_time"] = now
                        gs["phase_duration"] = 25.0
                        gs["time_remaining"] = 25.0
                        self.bump()
                    else:
                        self._score_fargekoden_turn()

                return 200, {"ok": True}

            elif action == "next_turn":
                if gs.get("turn_state") == "turn_recap":
                    self._advance_fargekoden_turn()
                return 200, {"ok": True}

            elif action == "restart":
                host_token = str(body.get("hostToken") or "").strip()
                is_host_req = bool((host_token and self.host_token == host_token) or (player_id and self.host_id == player_id))
                if not is_host_req and gs.get("turn_state") != "game_over":
                    return 403, {"ok": False, "error": "Kun verten kan starte spillet på nytt"}
                self.start_fargekoden(gs.get("settings") or {})
                return 200, {"ok": True}

            elif action == "to_lobby":
                host_token = str(body.get("hostToken") or "").strip()
                is_host_req = bool((host_token and self.host_token == host_token) or (player_id and self.host_id == player_id))
                if not (is_host_req or gs.get("turn_state") == "game_over"):
                    return 403, {"ok": False, "error": "Kun verten kan gå tilbake til lobby mens spillet pågår"}
                self.current_game = None
                self.game_state = {}
                self.bump()
                return 200, {"ok": True}

            return 400, {"ok": False, "error": f"Ukjent handling «{action}»"}


class PartyAPI:
    @staticmethod
    def _clean_expired_rooms() -> None:
        now = time.time()
        with _rooms_lock:
            to_remove = [
                code for code, room in _rooms.items()
                if (now - room.last_active) > 7200 or len(room.players) == 0
            ]
            for code in to_remove:
                del _rooms[code]

    @staticmethod
    def handle_get(path: str, query: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        PartyAPI._clean_expired_rooms()
        # Remove /api/party/ prefix if present
        rel_path = path
        if rel_path.startswith("/api/party/"):
            rel_path = "/api/" + rel_path[len("/api/party/"):]

        if rel_path in ("/api/room", "/api/state", "/api/poll"):
            code = (query.get("code", [""])[0] or "").strip().upper()
            player_id = (query.get("playerId", [""])[0] or "").strip()
            client_v = int(query.get("v", [-1])[0])

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": f"Fant ikke party-rom med kode «{code}»"}

            # Update heartbeat and lounge readiness
            with room.lock:
                if player_id in room.players:
                    room.players[player_id]["last_seen"] = time.time()
                    in_lounge = query.get("inLounge", [""])[0] in ("1", "true", "yes")
                    if in_lounge and not room.players[player_id].get("is_ready"):
                        room.players[player_id]["is_ready"] = True
                        room.bump()
                room.touch()

            # If polling and client already has current version, short wait (up to 1.5s)
            if client_v >= 0 and client_v == room.version and room.current_game not in ("ordbombe", "tegn_og_gjett", "imposter", "fargekoden"):
                time.sleep(0.4)

            state = room.get_public_state(player_id)
            return 200, state

        if rel_path in ("/api/tegn-og-gjett/draw-sync", "/api/imposter/draw-sync"):
            code = (query.get("code", [""])[0] or "").strip().upper()
            try:
                since_id = int(query.get("since", [0])[0] or 0)
            except (ValueError, TypeError):
                since_id = 0

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            actions, last_action_id = room.get_draw_actions_since(since_id)
            return 200, {
                "ok": True,
                "actions": actions,
                "lastActionId": last_action_id,
            }

        if rel_path == "/api/imposter/random-pair":
            return 200, {
                "ok": True,
                "pair": get_random_imposter_pair(),
            }

        if rel_path in ("/api/tegn-og-gjett/random-word", "/api/tegn-og-gjett/words"):
            return 200, {
                "ok": True,
                "words": get_random_word_triplet(),
            }

        if rel_path == "/api/list-games":
            # List of active party games
            return 200, {
                "ok": True,
                "games": [
                    {
                        "id": "ordbombe",
                        "title": "Ordbombe",
                        "subtitle": "Norsk Word Bomb med tikkende lunte",
                        "desc": "Tast inn et ord med stavelsen før bomben eksploderer på mobilen din!",
                        "status": "ready",
                        "badge": "Klar til å spilles! 💣",
                        "players": "2–16 spillere",
                        "icon": "/assets/icons/ordbombe.png",
                        "route": "/ordbombe/",
                    },
                    {
                        "id": "tegn_og_gjett",
                        "title": "Tegn & Gjett",
                        "subtitle": "Klassisk tegne- og gjettespill (skribbl-stil)",
                        "desc": "Én tegner et hemmelig ord på mobilen, resten gjetter i lynrask sanntidschat!",
                        "status": "ready",
                        "badge": "Klar til å spilles! 🎨",
                        "players": "2–16 spillere",
                        "icon": "/assets/icons/tegn_og_gjett.png",
                        "route": "/tegn-og-gjett/",
                    },
                    {
                        "id": "sjakk",
                        "title": "Sjakk",
                        "subtitle": "Klassisk 2-spillers sjakkduell",
                        "desc": "Utfordre en venn i pikselkunststil med klokke og tilskuere!",
                        "status": "ready",
                        "badge": "Klar til å spilles! ♟️",
                        "players": "2 spillere + tilskuere",
                        "icon": "/assets/icons/sjakk.png",
                        "route": "/sjakk/",
                    },
                    {
                        "id": "korridorer",
                        "title": "Korridorer",
                        "subtitle": "Taktisk labyrintduell",
                        "desc": "Flytt monsteret ditt eller sett opp vegger for å sperre motstanderne ute!",
                        "status": "ready",
                        "badge": "Klar til å spilles! 👾",
                        "players": "2–16 spillere",
                        "icon": "/assets/icons/korridorer.png",
                        "route": "/korridorer/",
                    },
                    {
                        "id": "imposter",
                        "title": "Imposter",
                        "subtitle": "Tegn én strek & avslør bedrageren",
                        "desc": "Alle får samme hemmelige ord unntatt Imposteren. Hvem bløffer?",
                        "status": "ready",
                        "badge": "Klar til å spilles!",
                        "players": "3–16 spillere",
                        "icon": "/assets/icons/imposter.svg",
                        "route": "/imposter/",
                    },
                    {
                        "id": "fargekoden",
                        "title": "Fargekoden (Hues & Cues)",
                        "subtitle": "Fargegjettespill på stort fargespekter",
                        "desc": "Beskriv fargen med 1–2 ord og gjett på det enorme fargekartet!",
                        "status": "ready",
                        "badge": "Klar til å spilles!",
                        "players": "2–16 spillere",
                        "icon": "/assets/icons/fargekoden.svg",
                        "route": "/fargekoden/",
                    },
                    {
                        "id": "wavelength",
                        "title": "Wavelength",
                        "subtitle": "2-spillers telepatisk duell",
                        "desc": "Er dere på samme bølgelengde? Les medspillerens tanker og still inn hjulet!",
                        "status": "ready",
                        "badge": "Klar til å spilles!",
                        "players": "2 spillere",
                        "icon": "/assets/icons/wavelength.svg",
                        "route": "/wavelength/",
                    },
                    {
                        "id": "turbosladd",
                        "title": "Turbosladd",
                        "subtitle": "Topp-ned 2D arkaderacing & drifting",
                        "desc": "Legg bilen bredt gjennom svingene med piltastene og utfordre vennegjengen!",
                        "status": "ready",
                        "badge": "Klar til å spilles! 🏎️",
                        "players": "2–4 spillere",
                        "icon": "/assets/icons/turbosladd.png",
                        "route": "/turbosladd/",
                    },
                ]
            }

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        PartyAPI._clean_expired_rooms()
        rel_path = path
        if rel_path.startswith("/api/party/"):
            rel_path = "/api/" + rel_path[len("/api/party/"):]

        if rel_path == "/api/create":
            host_name = str(body.get("hostName") or "Vert").strip()[:18] or "Vert"
            host_avatar = str(body.get("avatar") or "charbear").strip()[:200000] or "charbear"

            with _rooms_lock:
                # Pick unique memorable 4-letter word or random letters
                code = None
                available_words = [w for w in CLEAN_WORDS if w not in _rooms]
                if available_words:
                    code = random.choice(available_words)
                else:
                    for _ in range(50):
                        cand = "".join(random.choices(string.ascii_uppercase, k=4))
                        if cand not in _rooms:
                            code = cand
                            break
                    if not code:
                        code = f"P{random.randint(100, 999)}"

                host_token = uuid.uuid4().hex
                room = PartyRoom(code, host_token, host_name, host_avatar)
                _rooms[code] = room

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "hostToken": host_token,
                "playerId": room.host_id,
                "message": f"Party-rom {room.code} opprettet!",
            }

        if rel_path == "/api/join":
            code = str(body.get("roomCode") or "").strip().upper()
            player_name = str(body.get("playerName") or "Spiller").strip()[:18] or "Spiller"
            avatar = str(body.get("avatar") or "charbear").strip()[:200000] or "charbear"
            client_player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": f"Fant ikke party-rom med kode «{code}». Sjekk koden og prøv igjen!"}

            with room.lock:
                # If player already exists in the room with this playerId, reuse it
                if client_player_id and client_player_id in room.players:
                    p = room.players[client_player_id]
                    p["name"] = player_name
                    p["avatar"] = replace_color_in_avatar(avatar, p.get("color") or "#ffd166")
                    p["last_seen"] = time.time()
                    p["is_ready"] = True
                    room.bump()
                    return 200, {
                        "ok": True,
                        "roomCode": room.code,
                        "playerId": p["id"],
                        "playerName": p["name"],
                        "avatar": p["avatar"],
                        "color": p["color"],
                        "isHost": p["is_host"],
                    }

                # Also prevent rapid duplicate joins with the same name within 3 seconds
                now = time.time()
                for p in room.players.values():
                    if p["name"].lower() == player_name.lower() and (now - p.get("last_seen", 0)) < 3.0:
                        p["last_seen"] = now
                        p["is_ready"] = True
                        room.bump()
                        return 200, {
                            "ok": True,
                            "roomCode": room.code,
                            "playerId": p["id"],
                            "playerName": p["name"],
                            "avatar": p["avatar"],
                            "color": p["color"],
                            "isHost": p["is_host"],
                        }

                # Check if player name already exists; if so append a number
                existing_names = {p["name"].lower() for p in room.players.values()}
                final_name = player_name
                counter = 2
                while final_name.lower() in existing_names:
                    final_name = f"{player_name} {counter}"
                    counter += 1

                player_id = f"p_{uuid.uuid4().hex[:8]}"
                taken_colors = {p.get("color", "").lower() for p in room.players.values()}
                pref_color = extract_color_from_avatar(avatar)
                assigned_color = get_available_party_color(taken_colors, pref_color)
                final_avatar = replace_color_in_avatar(avatar, assigned_color)

                room.players[player_id] = {
                    "id": player_id,
                    "name": final_name,
                    "avatar": final_avatar,
                    "color": assigned_color,
                    "is_host": False,
                    "is_ready": True,
                    "score": 0,
                    "lives": 3,
                    "eliminated": False,
                    "words_count": 0,
                    "last_seen": time.time(),
                }
                room.bump()

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": player_id,
                "playerName": final_name,
                "avatar": final_avatar,
                "color": assigned_color,
                "isHost": False,
            }

        if rel_path in ("/api/update-avatar", "/api/avatar", "/api/update-character"):
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()
            avatar = str(body.get("avatar") or "").strip()[:200000]

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Party-rommet finnes ikke."}

            with room.lock:
                player = room.players.get(player_id)
                if not player:
                    return 404, {"ok": False, "error": "Spiller ikke funnet i rommet."}

                new_color = extract_color_from_avatar(avatar).lower()

                # Check color conflict: only one person can have each color
                for other_id, other_p in room.players.items():
                    if other_id != player_id and other_p.get("color", "").lower() == new_color:
                        other_name = other_p.get("name") or "en annen spiller"
                        return 409, {
                            "ok": False,
                            "error": f"Fargen er allerede tatt av {other_name}!"
                        }

                player["avatar"] = avatar
                player["color"] = new_color
                player["last_seen"] = time.time()
                room.bump()

            return 200, {
                "ok": True,
                "avatar": avatar,
                "color": new_color
            }

        if rel_path in ("/api/to-lounge", "/api/to-lobby", "/api/ready"):
            code = str(body.get("roomCode") or body.get("code") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()
            host_token = str(body.get("hostToken") or "").strip()
            with _rooms_lock:
                room = _rooms.get(code)
            if room:
                with room.lock:
                    if player_id in room.players:
                        room.players[player_id]["is_ready"] = True
                        room.players[player_id]["last_seen"] = time.time()
                    is_host = bool(
                        (player_id and room.players.get(player_id, {}).get("is_host")) or
                        (host_token and room.host_token == host_token) or
                        (player_id and player_id == room.host_id)
                    )
                    all_ready = all(p.get("is_ready", False) for p in room.players.values())
                    current_game = room.current_game

                    if rel_path in ("/api/to-lounge", "/api/to-lobby"):
                        if is_host or all_ready:
                            # Host returned or all players returned: terminate game session for everyone
                            cleanup_external_game_session(code, current_game)
                            room.current_game = None
                            room.game_state = {}
                            for p in room.players.values():
                                p["is_ready"] = True
                        else:
                            # Guest left active game: notify game and mark guest ready
                            cleanup_external_game_session(code, current_game, player_id=player_id)
                            if current_game == "ordbombe" and room.game_state:
                                if player_id in room.players:
                                    room.players[player_id]["eliminated"] = True
                                if room.game_state.get("active_player_id") == player_id:
                                    room._advance_ordbombe_turn()
                                living = [pid for pid in room.game_state.get("active_player_ids", []) if not room.players.get(pid, {}).get("eliminated")]
                                if len(living) <= 1:
                                    room.game_state["status"] = "game_over"
                                    if living:
                                        room.game_state["winner"] = room.players.get(living[0])
                    room.bump()

            return 200, {"ok": True, "message": "Returnert til lounge"}

        if rel_path in ("/api/select-game", "/api/start-game"):
            code = str(body.get("roomCode") or body.get("code") or "").strip().upper()
            host_token = str(body.get("hostToken") or "").strip()
            game_id = body.get("gameId")  # e.g. "ordbombe" or None for lobby
            settings = body.get("settings") or {}

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            with room.lock:
                is_host_req = bool(room.host_token and room.host_token == host_token)
                # Allow returning to lobby if host OR if game is finished
                if game_id is None:
                    cleanup_external_game_session(code, room.current_game)
                    room.current_game = None
                    room.game_state = {}
                    for p in room.players.values():
                        p["is_ready"] = True
                    room.bump()
                    return 200, {"ok": True, "currentGame": None}

                if not is_host_req:
                    return 403, {"ok": False, "error": "Bare romverten kan starte eller bytte spill"}

                reg_info = PARTY_REGISTRY.get(game_id)
                if not reg_info:
                    return 400, {"ok": False, "error": f"Ukjent spill: '{game_id}'"}

                min_req = reg_info.get("min_players", 1)
                if len(room.players) < min_req:
                    return 400, {"ok": False, "error": f"{reg_info['name']} krever minst {min_req} spillere i rommet."}

                # Check if all players in party room have returned to lounge
                not_ready = [p["name"] for p in room.players.values() if not p.get("is_ready", False)]
                if not_ready:
                    return 400, {
                        "ok": False,
                        "error": f"Kan ikke starte før alle har returnert til lobbyen. Venter på: {', '.join(not_ready)}"
                    }

                # Clean up previous external session if any
                cleanup_external_game_session(code, room.current_game)

                # Mark all players as in game now that the game begins
                for p in room.players.values():
                    p["is_ready"] = False

                if game_id == "ordbombe":
                    room.start_ordbombe(settings)
                elif game_id == "tegn_og_gjett":
                    room.start_tegn_og_gjett(settings)
                elif game_id == "imposter":
                    room.start_imposter(settings)
                elif game_id == "fargekoden":
                    room.start_fargekoden(settings)
                elif game_id == "sjakk":
                    room.current_game = "sjakk"
                    room.game_state = {"settings": settings, "status": "active"}
                    try:
                        from games.sjakk.api import _rooms as sjakk_rooms, SjakkRoom
                        with _rooms_lock:
                            host_player = room.players.get(room.host_id, {})
                            time_ctrl = int(settings.get("timeControl", 300))
                            s_room = SjakkRoom(
                                code=code,
                                host_name=host_player.get("name", "Hvit"),
                                host_avatar=host_player.get("avatar", "charbear"),
                                time_control=time_ctrl
                            )
                            s_room.host_id = room.host_id
                            s_room.white_player["id"] = room.host_id
                            # If second player is in the party, assign as Black
                            other_players = [p for pid, p in room.players.items() if pid != room.host_id]
                            if other_players:
                                p2 = other_players[0]
                                s_room.black_player = {
                                    "id": p2["id"],
                                    "name": p2["name"],
                                    "avatar": p2["avatar"],
                                    "color": "b",
                                    "isHost": False,
                                    "lastSeen": time.time(),
                                }
                                s_room.start_game_if_ready()
                            sjakk_rooms[code] = s_room
                    except Exception as err:
                        print("Error creating sjakk party room bridge:", err)
                    room.bump()
                elif game_id == "korridorer":
                    room.current_game = "korridorer"
                    room.game_state = {"settings": settings, "status": "active"}
                    try:
                        from games.korridorer.api import _rooms as korridorer_rooms, KorridorerRoom, PLAYER_CONFIGS
                        with _rooms_lock:
                            host_player = room.players.get(room.host_id, {})
                            k_room = KorridorerRoom(
                                code=code,
                                host_name=host_player.get("name", "Spiller 1"),
                                host_avatar=host_player.get("avatar", "charbear"),
                                max_players=16
                            )
                            k_room.host_id = room.host_id
                            k_room.players[0]["id"] = room.host_id
                            k_room.players[0]["avatar"] = host_player.get("avatar", "charbear")
                            k_room.players[0]["color"] = host_player.get("color") or extract_color_from_avatar(host_player.get("avatar"), PLAYER_CONFIGS[0]["color"])
                            for pid, pdata in room.players.items():
                                if pid != room.host_id and len(k_room.players) < 16:
                                    idx = len(k_room.players)
                                    cfg = PLAYER_CONFIGS[idx % len(PLAYER_CONFIGS)]
                                    p_color = pdata.get("color") or extract_color_from_avatar(pdata.get("avatar"), cfg["color"])
                                    k_room.players.append({
                                        "id": pid,
                                        "name": pdata.get("name", f"Spiller {idx + 1}"),
                                        "avatar": pdata.get("avatar", cfg["defaultAvatar"]),
                                        "color": p_color,
                                        "colorName": pdata.get("colorName", cfg["colorName"]),
                                        "pos": list(cfg["start"]),
                                        "walls": 10 if len(room.players) == 2 else 5,
                                        "goalDesc": cfg["goalDesc"],
                                        "isHost": False,
                                        "lastSeen": time.time(),
                                    })
                            if len(k_room.players) >= 2:
                                k_room.start_game()
                            korridorer_rooms[code] = k_room
                    except Exception as err:
                        print("Error creating korridorer party room bridge:", err)
                    room.bump()
                elif game_id == "wavelength":
                    room.current_game = "wavelength"
                    room.game_state = {"settings": settings, "status": "active"}
                    try:
                        from games.wavelength.api import _rooms as wl_rooms, WavelengthRoom
                        with _rooms_lock:
                            host_player = room.players.get(room.host_id, {})
                            rounds = int(settings.get("rounds", 7))
                            wl_room = WavelengthRoom(
                                code=code,
                                host_name=host_player.get("name", "Spiller 1"),
                                host_avatar=host_player.get("avatar", "charbear"),
                                rounds=rounds
                            )
                            wl_room.host_id = room.host_id
                            wl_room.players[room.host_id] = {
                                "id": room.host_id,
                                "name": host_player.get("name", "Spiller 1"),
                                "avatar": host_player.get("avatar", "charbear"),
                                "isHost": True,
                                "lastSeen": time.time(),
                            }
                            for pid, pdata in room.players.items():
                                if pid != room.host_id:
                                    wl_room.players[pid] = {
                                        "id": pid,
                                        "name": pdata.get("name", "Spiller"),
                                        "avatar": pdata.get("avatar", "charbear"),
                                        "isHost": False,
                                        "lastSeen": time.time(),
                                    }
                            if len(wl_room.players) >= 2:
                                wl_room.start_game_if_ready()
                            wl_rooms[code] = wl_room
                    except Exception as err:
                        print("Error creating wavelength party room bridge:", err)
                    room.bump()
                elif game_id == "turbosladd":
                    room.current_game = "turbosladd"
                    room.game_state = {"settings": settings, "status": "active"}
                    try:
                        from games.turbosladd.api import _rooms as ts_rooms, TurbosladdRoom, PLAYER_PALETTE
                        with _rooms_lock:
                            host_player = room.players.get(room.host_id, {})
                            laps = int(settings.get("laps", 3))
                            track_id = str(settings.get("trackId", "grand_prix"))
                            max_p = max(len(room.players), 16)
                            host_color = host_player.get("color") or extract_color_from_avatar(host_player.get("avatar", "")) or PLAYER_PALETTE[0]["color"]
                            t_room = TurbosladdRoom(
                                code=code,
                                host_name=host_player.get("name", "Sjåfør 1"),
                                host_color=host_color,
                                host_car="gt",
                                track_id=track_id,
                                laps=laps,
                                max_players=max_p,
                                host_avatar=host_player.get("avatar", ""),
                            )
                            t_room.host_id = room.host_id
                            t_room.status = "countdown"
                            t_room.countdown_start = time.time()
                            t_room.players = {}
                            # Host
                            t_room.players[room.host_id] = {
                                "id": room.host_id,
                                "name": host_player.get("name", "Sjåfør 1"),
                                "color": host_color,
                                "avatar": host_player.get("avatar", ""),
                                "carModel": "gt",
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
                            slot = 1
                            for pid, pdata in room.players.items():
                                if pid != room.host_id and len(t_room.players) < t_room.max_players:
                                    pal = PLAYER_PALETTE[slot % len(PLAYER_PALETTE)]
                                    p_color = pdata.get("color") or extract_color_from_avatar(pdata.get("avatar", "")) or pal["color"]
                                    t_room.players[pid] = {
                                        "id": pid,
                                        "name": pdata.get("name", f"Sjåfør {slot + 1}"),
                                        "color": p_color,
                                        "avatar": pdata.get("avatar", ""),
                                        "carModel": "gt",
                                        "isHost": False,
                                        "isReady": True,
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
                                    slot += 1
                            ts_rooms[code] = t_room
                    except Exception as err:
                        print("Error creating turbosladd party room bridge:", err)
                    room.bump()
                elif game_id is None:
                    # Return to lobby
                    cleanup_external_game_session(code, room.current_game)
                    room.current_game = None
                    room.game_state = {}
                    for p in room.players.values():
                        p["is_ready"] = True
                    room.bump()
                else:
                    return 400, {"ok": False, "error": f"Spillet '{game_id}' er under utvikling og ikke tilgjengelig enda."}

            base_url = PARTY_REGISTRY.get(room.current_game, {}).get("url_path", f"/{room.current_game}/")
            game_url = f"{base_url}?room={room.code}&player={room.host_id}"
            return 200, {"ok": True, "currentGame": room.current_game, "gameUrl": game_url}

        if rel_path == "/api/ordbombe/action":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()
            action = str(body.get("action") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            if action == "typing":
                text = str(body.get("text") or "")
                room.set_ordbombe_typing(player_id, text)
                return 200, {"ok": True}

            if action == "submit_word":
                word = str(body.get("word") or "")
                res = room.submit_ordbombe_word(player_id, word)
                return 200, res

            if action == "restart":
                host_token = str(body.get("hostToken") or "").strip()
                if room.host_token != host_token:
                    return 403, {"ok": False, "error": "Kun verten kan restarte"}
                room.start_ordbombe(body.get("settings") or {})
                return 200, {"ok": True}

            if action == "to_lobby":
                host_token = str(body.get("hostToken") or "").strip()
                if room.host_token != host_token:
                    return 403, {"ok": False, "error": "Kun verten kan gå tilbake til lobby"}
                with room.lock:
                    room.current_game = None
                    room.game_state = {}
                    room.bump()
                return 200, {"ok": True}

            return 400, {"ok": False, "error": f"Ukjent handling «{action}»"}

        if rel_path == "/api/tegn-og-gjett/action":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            return room.handle_tegn_og_gjett_action(player_id, body)

        if rel_path == "/api/imposter/action":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            return room.handle_imposter_action(player_id, body)

        if rel_path == "/api/fargekoden/action":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            return room.handle_fargekoden_action(player_id, body)

        if rel_path == "/api/kick":
            code = str(body.get("roomCode") or "").strip().upper()
            host_token = str(body.get("hostToken") or "").strip()
            player_id = str(body.get("playerId") or "").strip()
            target_id = str(body.get("targetPlayerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke"}

            with room.lock:
                is_host_req = bool(
                    (host_token and room.host_token == host_token)
                    or (player_id and room.host_id == player_id)
                )
                if not is_host_req:
                    return 403, {"ok": False, "error": "Bare romverten kan fjerne spillere"}

                if not target_id or target_id not in room.players:
                    return 404, {"ok": False, "error": "Spilleren finnes ikke i rommet"}

                if target_id == room.host_id:
                    return 400, {"ok": False, "error": "Verten kan ikke fjerne seg selv"}

                kicked_player = room.players.pop(target_id)
                room.kicked_players.add(target_id)
                room.bump()
                state = room.get_public_state(room.host_id)

            return 200, {
                "ok": True,
                "kickedName": kicked_player.get("name", "Spiller"),
                "state": state,
            }

        if rel_path == "/api/leave":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if room:
                with room.lock:
                    if player_id in room.players:
                        del room.players[player_id]
                        # If host left, assign new host if any players remain
                        if room.host_id == player_id and room.players:
                            new_host_id = next(iter(room.players))
                            room.host_id = new_host_id
                            room.players[new_host_id]["is_host"] = True
                            room.host_token = f"ht_{uuid.uuid4().hex[:12]}"
                        room.bump()

                with _rooms_lock:
                    if len(room.players) == 0:
                        del _rooms[code]

            return 200, {"ok": True}

        return None
