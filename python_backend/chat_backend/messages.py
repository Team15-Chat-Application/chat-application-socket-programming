from datetime import datetime, timezone
from uuid import uuid4
from .input import sanitize_message
from .rooms import require_identity


class MessageError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def utc_timestamp():
    # Same rendering as the Node backend: millisecond precision and a trailing Z.
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


class MessageService:
    """CHAT-F-005/006 messaging increment.

    Resolution order follows the shared contract: the room, then this socket's
    membership, then the content. Identity comes from the verified token, never from
    the payload, and length/markup policy comes from the shared sanitisation helper.
    """

    def __init__(self, rooms, new_id=None, clock=None, history=None):
        if rooms is None:
            raise ValueError('a RoomStore instance is required')
        self._rooms = rooms
        self._new_id = new_id if new_id is not None else lambda: str(uuid4())
        self._clock = clock if clock is not None else utc_timestamp
        self.history = history

    def send(self, identity, socket_id, payload):
        require_identity(identity)
        room = self._rooms.get(payload)
        if not self._rooms.has_socket(room['roomId'], socket_id):
            raise MessageError('FORBIDDEN', 'Join the room before sending messages')
        content = sanitize_message(payload.get('content'))
        message_id = self._new_id()
        if not isinstance(message_id, str) or not message_id:
            # Same convention as rooms.py: an allocation failure is a defect, not a contract error.
            raise RuntimeError('Message ID allocation failed')
        message = {'messageId': message_id, 'roomId': room['roomId'],
                'senderId': identity['userId'], 'content': content, 'createdAt': self._clock()}
        if self.history is not None:
            self.history.save(message)
        return self.history.get(message_id) if self.history is not None else message
