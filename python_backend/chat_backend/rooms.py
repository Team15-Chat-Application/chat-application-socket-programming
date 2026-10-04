from threading import RLock
from unicodedata import category
from uuid import uuid4

MAX_ROOM_NAME_LENGTH = 64


class RoomError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def validate_room_name(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get('name'), str):
        raise RoomError('VALIDATION_ERROR', 'name must be a string')
    name = payload['name'].strip(' \t\r\n\f\v')
    if not 1 <= len(name) <= MAX_ROOM_NAME_LENGTH or any(category(c) in ('Cc', 'Cs') for c in name):
        raise RoomError('VALIDATION_ERROR', 'name must contain 1 to 64 characters without control characters')
    return name


class RoomStore:
    """Process-local catalogue; snapshots never expose mutable internal records."""
    def __init__(self, new_id=None):
        self._new_id = new_id if new_id is not None else lambda: str(uuid4())
        self._rooms = {}
        self._lock = RLock()

    def create(self, identity, payload):
        if not isinstance(identity, dict) or not all(
            isinstance(identity.get(key), str) and identity[key] for key in ('userId', 'sessionId')
        ):
            raise RoomError('UNAUTHORIZED', 'A verified identity is required')
        name = validate_room_name(payload)
        with self._lock:
            room_id = self._new_id()
            if not isinstance(room_id, str) or not room_id or room_id in self._rooms:
                raise RuntimeError('Room ID allocation failed')
            room = {'roomId': room_id, 'name': name, 'memberCount': 0}
            self._rooms[room_id] = room
            return dict(room)

    def list(self):
        with self._lock:
            return [dict(room) for room in self._rooms.values()]
