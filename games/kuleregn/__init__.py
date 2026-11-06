"""
Kuleregn API - Backend for top-down multiplayer shooter.
Supports multidevice Free-For-All (FFA), modular game modes,
weapon synchronization, health/shield pickups, kill feed, and podium.
"""

from .api import KuleregnAPI, KuleregnRoom

__all__ = ["KuleregnAPI", "KuleregnRoom"]

