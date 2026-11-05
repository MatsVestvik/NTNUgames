"""
Wavelength API - Backend for 2-player cooperative psychic dial game.
Handles room matchmaking, live needle synchronization, clue submission,
and score evaluation across rounds.
"""

import math
import os
import random
import string
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from games.wavelength.cards import get_random_spectrum_card

_rooms: Dict[str, "WavelengthRoom"] = {}
_rooms_lock = threading.RLock()

CLEAN_ROOM_CODES = [
    "WAVE", "SYNC", "TELE", "DIAL", "RADR", "EKKO",
    "SGNL", "FREK", "ROSA", "NEON", "HJER", "BLGE"
]


class WavelengthRoom:
    def __init__(self, code: str, host_name: str, host_avatar: str, rounds: int = 7):
        self.code = code
        self.created_at = time.time()
        self.last_active = time.time()
        self.version = 1
        self.lock = threading.RLock()

        self.total_rounds = max(3, min(15, int(rounds or 7)))
        self.current_round = 1
        self.team_score = 0
        self.round_history: List[Dict[str, Any]] = []

        # Players dictionary: pid -> {id, name, avatar, isHost, lastSeen}
        host_id = f"p_{uuid.uuid4().hex[:8]}"
        self.host_id = host_id
        self.players: Dict[str, Dict[str, Any]] = {
            host_id: {
                "id": host_id,
                "name": host_name[:18].strip() or "Spiller 1",
                "avatar": host_avatar or "charbear",
                "isHost": True,
                "lastSeen": time.time(),
            }
        }

        # Role assignments for current round
        self.psychic_id: Optional[str] = host_id
        self.guesser_id: Optional[str] = None

        # Game state: "waiting", "giving_clue", "guessing", "revealed", "game_over"
        self.status = "waiting"

        # Spectrum card and secret target
        self.current_card = get_random_spectrum_card()
        # Target position between 0.12 and 0.88 (percentage along spectrum)
        self.target_val = round(random.uniform(0.12, 0.88), 4)

        # Needle position (0.0 to 1.0, starts at center 0.50)
        self.dial_val = 0.50
        self.clue = ""
        self.last_round_points = 0
        self.last_round_feedback = ""
        self.returned_to_lounge = False

    def touch(self) -> None:
        self.last_active = time.time()

    def bump(self) -> None:
        self.version += 1
        self.touch()

    def start_game_if_ready(self) -> bool:
        """Start round 1 if at least 2 players are in the room."""
        with self.lock:
            pids = list(self.players.keys())
            if len(pids) >= 2 and self.status == "waiting":
                self.psychic_id = pids[0]
                self.guesser_id = pids[1]
                self.current_round = 1
                self.team_score = 0
                self.round_history = []
                self._setup_new_round(reset_roles=False)
                self.status = "giving_clue"
                self.bump()
                return True
            return False

    def _setup_new_round(self, reset_roles: bool = True) -> None:
        """Prepare target, card, and reset needle for a new round."""
        pids = list(self.players.keys())
        if reset_roles and len(pids) >= 2:
            # Swap roles: the previous guesser becomes the new psychic
            prev_psychic = self.psychic_id
            if prev_psychic == pids[0]:
                self.psychic_id = pids[1]
                self.guesser_id = pids[0]
            else:
                self.psychic_id = pids[0]
                self.guesser_id = pids[1]

        self.current_card = get_random_spectrum_card()
        self.target_val = round(random.uniform(0.12, 0.88), 4)
        self.dial_val = 0.50
        self.clue = ""
        self.last_round_points = 0
        self.last_round_feedback = ""
        self.status = "giving_clue"

    def submit_clue(self, player_id: str, clue_text: str) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "giving_clue":
                return False, "Kan ikke sende ledetråd nå."
            if player_id != self.psychic_id:
                return False, "Bare Telepaten kan gi ledetråd."

            clue = clue_text.strip()[:60]
            if not clue:
                return False, "Ledetråden kan ikke være tom."

            self.clue = clue
            self.status = "guessing"
            self.dial_val = 0.50  # Reset dial to center for guesser
            self.bump()
            return True, "Ledetråd sendt!"

    def update_dial(self, player_id: str, val: float) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "guessing":
                return False, "Ikke i gjettefasen."
            if player_id != self.guesser_id:
                return False, "Bare gjettespilleren kan vri på pekeren."

            clamped = max(0.0, min(1.0, float(val)))
            self.dial_val = round(clamped, 4)
            self.bump()
            return True, "Peker oppdatert."

    def lock_and_reveal(self, player_id: str) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "guessing":
                return False, "Kan ikke låse inn nå."
            if player_id != self.guesser_id:
                return False, "Bare gjettespilleren kan låse inn pekeren."

            diff = abs(self.dial_val - self.target_val)
            # Bullseye = 4 pts (diff <= 0.025)
            # Inner band = 3 pts (diff <= 0.065)
            # Outer band = 2 pts (diff <= 0.120)
            # Miss = 0 pts
            if diff <= 0.025:
                pts = 4
                feedback = "BULLSEYE! Perfekt telepatisk klaff!"
            elif diff <= 0.065:
                pts = 3
                feedback = "3 POENG! Kjempenært!"
            elif diff <= 0.120:
                pts = 2
                feedback = "2 POENG! Godkjent bølgelengde!"
            else:
                pts = 0
                feedback = "0 POENG! Bom! Litt støy på frekvensen!"

            self.team_score += pts
            self.last_round_points = pts
            self.last_round_feedback = feedback

            round_entry = {
                "round": self.current_round,
                "card": dict(self.current_card),
                "clue": self.clue,
                "targetVal": self.target_val,
                "dialVal": self.dial_val,
                "diff": round(diff, 4),
                "points": pts,
                "psychicName": self.players.get(self.psychic_id or "", {}).get("name", "Telepat"),
                "guesserName": self.players.get(self.guesser_id or "", {}).get("name", "Gjetter"),
            }
            self.round_history.append(round_entry)
            self.status = "revealed"
            self.bump()
            return True, "Svar låst inn!"

    def next_round_or_finish(self, player_id: str) -> Tuple[bool, str]:
        with self.lock:
            if self.status != "revealed":
                return False, "Runden er ikke avsluttet enda."

            if self.current_round >= self.total_rounds:
                self.status = "game_over"
                self.bump()
                return True, "Spillet er ferdig!"

            self.current_round += 1
            self._setup_new_round(reset_roles=True)
            self.bump()
            return True, "Neste runde startet!"

    def restart_game(self) -> None:
        with self.lock:
            self.current_round = 1
            self.team_score = 0
            self.round_history = []
            pids = list(self.players.keys())
            if len(pids) >= 2:
                self.psychic_id = pids[0]
                self.guesser_id = pids[1]
                self._setup_new_round(reset_roles=False)
                self.status = "giving_clue"
            else:
                self.status = "waiting"
            self.bump()

    def get_synergy_title(self) -> Dict[str, str]:
        max_possible = self.total_rounds * 4
        pct = (self.team_score / max_possible) if max_possible > 0 else 0
        if pct >= 0.88:
            return {
                "title": "Kosmisk telepati!",
                "desc": "Dere deler én felles bevissthet! Skremmende samkjørte hjerner."
            }
        elif pct >= 0.70:
            return {
                "title": "Telepatiske mestere!",
                "desc": "Fantastisk intuisjon! Dere leser hverandre som en åpen bok."
            }
        elif pct >= 0.50:
            return {
                "title": "Klar FM-frekvens!",
                "desc": "Stort sett på samme bølgelengde! Et solid og samkjørt lag."
            }
        elif pct >= 0.28:
            return {
                "title": "Skurrende signaler!",
                "desc": "Noe statisk støy på linja, men dere fant hverandre innimellom."
            }
        else:
            return {
                "title": "To forskjellige galakser!",
                "desc": "Dere tenker fullstendig ulikt, men herregud så gøy det var å prøve!"
            }

    def get_public_state(self, client_player_id: Optional[str] = None) -> Dict[str, Any]:
        with self.lock:
            pids = list(self.players.keys())
            is_psychic = bool(client_player_id and client_player_id == self.psychic_id)
            is_guesser = bool(client_player_id and client_player_id == self.guesser_id)
            is_revealed = self.status in ("revealed", "game_over")

            # Target position is secretly shown ONLY to the Psychic before reveal
            visible_target = self.target_val if (is_psychic or is_revealed) else None

            psychic_name = self.players.get(self.psychic_id or "", {}).get("name", "Venter på spiller…")
            guesser_name = self.players.get(self.guesser_id or "", {}).get("name", "Venter på spiller…")

            return {
                "ok": True,
                "roomCode": self.code,
                "version": self.version,
                "status": self.status,
                "currentRound": self.current_round,
                "totalRounds": self.total_rounds,
                "teamScore": self.team_score,
                "maxPossibleScore": self.total_rounds * 4,
                "card": self.current_card,
                "clue": self.clue,
                "dialVal": self.dial_val,
                "targetVal": visible_target,
                "isRevealed": is_revealed,
                "lastRoundPoints": self.last_round_points,
                "lastRoundFeedback": self.last_round_feedback,
                "roundHistory": self.round_history,
                "synergyRating": self.get_synergy_title() if is_revealed or self.status == "game_over" else None,
                "players": list(self.players.values()),
                "psychicId": self.psychic_id,
                "psychicName": psychic_name,
                "guesserId": self.guesser_id,
                "guesserName": guesser_name,
                "isPsychic": is_psychic,
                "isGuesser": is_guesser,
                "isHost": bool(client_player_id and client_player_id == self.host_id),
                "returnedToLounge": self.returned_to_lounge,
            }


class WavelengthAPI:
    @staticmethod
    def handle_get(path: str, query: Dict[str, List[str]]) -> Optional[Tuple[int, Any]]:
        rel = path.replace("/api/wavelength", "")
        if not rel.startswith("/"):
            rel = "/" + rel

        if rel == "/state":
            code = (query.get("room", [""])[0] or query.get("code", [""])[0] or "").strip().upper()
            player_id = (query.get("player", [""])[0] or query.get("playerId", [""])[0] or "").strip()
            client_v = -1
            try:
                client_v = int(query.get("v", [-1])[0])
            except (ValueError, TypeError):
                pass

            with _rooms_lock:
                room = _rooms.get(code)
                if not room:
                    try:
                        from games.party.api import _rooms as party_rooms
                        p_room = party_rooms.get(code)
                        if p_room:
                            host_p = p_room.players.get(p_room.host_id, {})
                            room = WavelengthRoom(
                                code=code,
                                host_name=host_p.get("name", "Spiller 1"),
                                host_avatar=host_p.get("avatar", "charbear"),
                                rounds=int(p_room.game_state.get("settings", {}).get("rounds", 7))
                            )
                            room.host_id = p_room.host_id
                            room.players = {}
                            for pid, pdata in p_room.players.items():
                                room.players[pid] = {
                                    "id": pid,
                                    "name": pdata.get("name", "Spiller"),
                                    "avatar": pdata.get("avatar", "charbear"),
                                    "isHost": bool(pid == p_room.host_id),
                                    "lastSeen": time.time(),
                                }
                            if len(room.players) >= 2:
                                room.start_game_if_ready()
                            _rooms[code] = room
                    except Exception as b_err:
                        print("Wavelength auto-bridge error:", b_err)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            if player_id and player_id not in room.players:
                try:
                    from games.party.api import _rooms as party_rooms
                    p_room = party_rooms.get(code)
                    if p_room and player_id in p_room.players:
                        pdata = p_room.players[player_id]
                        with room.lock:
                            room.players[player_id] = {
                                "id": player_id,
                                "name": pdata.get("name", "Spiller"),
                                "avatar": pdata.get("avatar", "charbear"),
                                "isHost": False,
                                "lastSeen": time.time(),
                            }
                            if len(room.players) >= 2 and room.status == "waiting":
                                room.start_game_if_ready()
                except Exception:
                    pass

            with room.lock:
                if player_id in room.players:
                    room.players[player_id]["lastSeen"] = time.time()
                room.touch()

            # Short wait if polling with identical version
            if client_v >= 0 and client_v == room.version and room.status != "guessing":
                time.sleep(0.35)

            return 200, room.get_public_state(player_id)

        if rel == "/random-card":
            return 200, {
                "ok": True,
                "card": get_random_spectrum_card()
            }

        return None

    @staticmethod
    def handle_post(path: str, body: Dict[str, Any]) -> Optional[Tuple[int, Any]]:
        rel = path.replace("/api/wavelength", "")
        if not rel.startswith("/"):
            rel = "/" + rel

        if rel == "/create":
            host_name = str(body.get("hostName") or "Spiller 1").strip()[:18] or "Spiller 1"
            host_avatar = str(body.get("avatar") or "charbear").strip()[:200000] or "charbear"
            rounds = int(body.get("rounds") or 7)

            with _rooms_lock:
                # Find unused code
                for word in CLEAN_ROOM_CODES:
                    if word not in _rooms:
                        code = word
                        break
                else:
                    code = "".join(random.choices(string.ascii_uppercase, k=4))

                room = WavelengthRoom(code, host_name, host_avatar, rounds=rounds)
                _rooms[code] = room

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": room.host_id,
                "isHost": True,
            }

        if rel == "/join":
            code = str(body.get("roomCode") or "").strip().upper()
            player_name = str(body.get("playerName") or "Spiller 2").strip()[:18] or "Spiller 2"
            player_avatar = str(body.get("avatar") or "pixiu").strip()[:200000] or "pixiu"

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Fant ikke rommet."}

            with room.lock:
                # Check if room already full (2 players)
                if len(room.players) >= 2:
                    # Allow rejoin if player ID recognized or return full
                    pid = str(body.get("playerId") or "").strip()
                    if pid and pid in room.players:
                        room.players[pid]["lastSeen"] = time.time()
                        return 200, {"ok": True, "roomCode": room.code, "playerId": pid}
                    return 400, {"ok": False, "error": "Rommet er allerede fullt (2 spillere)."}

                new_pid = f"p_{uuid.uuid4().hex[:8]}"
                room.players[new_pid] = {
                    "id": new_pid,
                    "name": player_name,
                    "avatar": player_avatar,
                    "isHost": False,
                    "lastSeen": time.time(),
                }
                # If we now have 2 players, start game!
                room.start_game_if_ready()
                room.bump()

            return 200, {
                "ok": True,
                "roomCode": room.code,
                "playerId": new_pid,
                "isHost": False,
            }

        if rel == "/clue":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()
            clue = str(body.get("clue") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            ok, msg = room.submit_clue(player_id, clue)
            if not ok:
                return 400, {"ok": False, "error": msg}
            return 200, {"ok": True, "message": msg}

        if rel == "/dial":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()
            val = float(body.get("dialVal") or 0.5)

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            ok, msg = room.update_dial(player_id, val)
            if not ok:
                return 400, {"ok": False, "error": msg}
            return 200, {"ok": True}

        if rel == "/lock":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            ok, msg = room.lock_and_reveal(player_id)
            if not ok:
                return 400, {"ok": False, "error": msg}
            return 200, {"ok": True, "message": msg}

        if rel == "/next-round":
            code = str(body.get("roomCode") or "").strip().upper()
            player_id = str(body.get("playerId") or "").strip()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            ok, msg = room.next_round_or_finish(player_id)
            if not ok:
                return 400, {"ok": False, "error": msg}
            return 200, {"ok": True, "message": msg}

        if rel == "/restart":
            code = str(body.get("roomCode") or "").strip().upper()

            with _rooms_lock:
                room = _rooms.get(code)

            if not room:
                return 404, {"ok": False, "error": "Rommet finnes ikke."}

            room.restart_game()
            return 200, {"ok": True}

        if rel == "/to-lounge":
            code = str(body.get("roomCode") or "").strip().upper()
            with _rooms_lock:
                room = _rooms.get(code)
            if room:
                with room.lock:
                    room.returned_to_lounge = True
                    room.bump()
            return 200, {"ok": True}

        return None

