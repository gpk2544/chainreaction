import os
import secrets
from flask import Flask, render_template, request, redirect, url_for, session

app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24)

# In-memory storage for rooms
rooms = {}

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/game")
def game():
    return render_template("game.html")

@app.route("/lobby", methods=["POST"])
def lobby():
    username = request.form.get("username")
    session['username'] = username
    return render_template("lobby.html", username=username)

@app.route("/play_ai", methods=["POST"])
def play_ai():
    return redirect(url_for('game'))

@app.route("/join", methods=["POST"])
def join_game():
    room_code = request.form.get("room_code").upper()
    username = session.get('username')

    if room_code in rooms:
        if username not in rooms[room_code]['players']:
            rooms[room_code]['players'].append(username)
        return redirect(url_for('room', room_code=room_code))
    else:
        return "Room not found!", 404

@app.route("/create", methods=["POST"])
def create_game():
    username = session.get('username')
    room_code = secrets.token_hex(3).upper()
    while room_code in rooms:
        room_code = secrets.token_hex(3).upper()
    
    rooms[room_code] = {
        'players': [username],
        'host': username,
        'ready_players': []
    }
    return redirect(url_for('room', room_code=room_code))

@app.route("/room/<room_code>")
def room(room_code):
    if room_code in rooms:
        room_data = rooms[room_code]
        username = session.get('username')
        
        all_players_except_host = [p for p in room_data['players'] if p != room_data['host']]
        all_ready = set(room_data['ready_players']) == set(all_players_except_host)
        
        return render_template("room.html", room_code=room_code, room=room_data, username=username, all_ready=all_ready)
    else:
        return redirect(url_for('index'))

@app.route("/ready/<room_code>", methods=["POST"])
def ready(room_code):
    username = session.get('username')
    if room_code in rooms and username in rooms[room_code]['players']:
        if username not in rooms[room_code]['ready_players']:
            rooms[room_code]['ready_players'].append(username)
    return redirect(url_for('room', room_code=room_code))

@app.route("/start/<room_code>", methods=["POST"])
def start_game(room_code):
    username = session.get('username')
    if room_code in rooms and rooms[room_code]['host'] == username:
        return f"Game in room {room_code} is starting!"
    return redirect(url_for('room', room_code=room_code))

def main():
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 80)), debug=True)

if __name__ == "__main__":
    main()
