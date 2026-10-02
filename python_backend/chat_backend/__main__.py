from .app import create_application
from .config import read_config


def main():
    config = read_config()
    app, socketio = create_application()
    print(f"Flask development server: http://{config['host']}:{config['port']}/api/health", flush=True)
    print('Authentication, rooms and messaging are not implemented yet. Socket access is denied by default.', flush=True)
    # Werkzeug is intentionally used only for this local development launcher.
    socketio.run(app, host=config['host'], port=config['port'], allow_unsafe_werkzeug=True)


if __name__ == '__main__':
    main()
