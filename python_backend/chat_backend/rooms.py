from threading import RLock
from unicodedata import category
from uuid import uuid4
from .input import sanitize_plain_text

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
    clean = sanitize_plain_text(name).strip(' \t\r\n\f\v')
    if not clean:
        raise RoomError('VALIDATION_ERROR', 'name is empty after sanitisation')
    return clean


CATALOGUE_CHANNEL = 'chat:catalogue'


def room_channel(room_id):
    return f'chat:room:{room_id}'


def require_identity(identity):
    if not isinstance(identity, dict) or not all(
        isinstance(identity.get(k), str) and identity[k] for k in ('userId', 'sessionId')
    ):
        raise RoomError('UNAUTHORIZED', 'A verified identity is required')


class RoomStore:
    """Process-local catalogue; snapshots never expose mutable internal records."""
    def __init__(self, new_id=None):
        self._new_id = new_id if new_id is not None else lambda: str(uuid4())
        self._rooms = {}
        self._members = {}
        self._sockets = {}
        self._lock = RLock()

    def create(self, identity, payload):
        require_identity(identity)
        name = validate_room_name(payload)
        with self._lock:
            room_id = self._new_id()
            if not isinstance(room_id, str) or not room_id or room_id in self._rooms:
                raise RuntimeError('Room ID allocation failed')
            room = {'roomId': room_id, 'name': name, 'memberCount': 0}
            self._rooms[room_id] = room
            self._members[room_id] = {}
            return dict(room)

    def list(self):
        with self._lock:
            return [self.get({'roomId': room_id}) for room_id in self._rooms]

    def get(self, payload):
        if not isinstance(payload, dict) or not isinstance(payload.get('roomId'), str) or not 1 <= len(payload['roomId']) <= 128:
            raise RoomError('VALIDATION_ERROR', 'roomId must be a nonempty string of at most 128 characters')
        with self._lock:
            if payload['roomId'] not in self._rooms:
                raise RoomError('NOT_FOUND', 'Room not found')
            return dict(self._rooms[payload['roomId']], memberCount=len(self._members[payload['roomId']]))

    def join(self, identity, socket_id, payload):
        require_identity(identity)
        with self._lock:
            room = self.get(payload)
            if not isinstance(socket_id, str) or not socket_id:
                raise ValueError('Socket identity is required')
            binding = self._sockets.get(socket_id)
            if binding and binding['identity']['userId'] != identity['userId']:
                raise RoomError('FORBIDDEN', 'Socket identity cannot change')
            users = self._members[room['roomId']]
            sockets = users.setdefault(identity['userId'], set())
            changed = not sockets
            sockets.add(socket_id)
            connection = binding if binding is not None else {'identity': dict(identity), 'rooms': set()}
            connection['rooms'].add(room['roomId'])
            self._sockets[socket_id] = connection
            return {'room': self.get(payload), 'changed': changed}

    def leave(self, identity, socket_id, payload):
        require_identity(identity)
        with self._lock:
            self.get(payload)
            binding = self._sockets.get(socket_id)
            if binding and binding['identity']['userId'] != identity['userId']:
                raise RoomError('FORBIDDEN', 'Socket identity cannot change')
            users = self._members[payload['roomId']]
            sockets = users.get(identity['userId'], set())
            removed = socket_id in sockets
            sockets.discard(socket_id)
            changed = removed and not sockets
            if changed:
                del users[identity['userId']]
            if binding:
                binding['rooms'].discard(payload['roomId'])
                if not binding['rooms']:
                    del self._sockets[socket_id]
            return {'room': self.get(payload), 'changed': changed}

    def disconnect(self, socket_id):
        with self._lock:
            binding = self._sockets.get(socket_id)
            if not binding:
                return []
            notices = []
            for room_id in list(binding['rooms']):
                result = self.leave(binding['identity'], socket_id, {'roomId': room_id})
                if result['changed']:
                    notices.append({'roomId': room_id, 'userId': binding['identity']['userId'],
                                    'action': 'leave', 'memberCount': result['room']['memberCount']})
            return notices

    def has_member(self, room_id, user_id):
        with self._lock:
            return user_id in self._members.get(room_id, {})

    def has_socket(self, room_id, socket_id):
        with self._lock:
            return room_id in self._sockets.get(socket_id, {}).get('rooms', set())
