class Player {
  constructor(name, socket, joinLobby) {
    this.name = name;
    this.socket = socket;
    this.joinLobby = joinLobby;
    this.initValues();
  }

  initValues() {
    this.game = null;
    this.ownPieceIds = [];
    this.isMrX = false;
  }

  joinGame(game) {
    this.socket.join(game.room);
    this.game = game;
    this.initClientGame();
    this.initClientEventHandlers();
  }

  leaveGame() {
    this.removeListeners();
    this.initValues();
    this.joinLobby();
  }

  initClientGame() {
    let pieces = this.game.getClientPieceInfo(this);
    this.socket.emit("start game", {
      stations: this.game.stations,
      connections: this.game.connections,
      pieces,
      ownPieceIds: this.ownPieceIds,
      mrXTurn: this.game.mrXTurn
    });
  }

  initClientEventHandlers() {
    this.socket.on("move", move => {
      console.log(this.name, "move");
      if (!this.game.isMovePossible(move, this)) return;
      this.game.doMove(move, this);
    });
    this.socket.on("leave game", () => {
      this.leaveGame();
    });
  }

  removeListeners() {
    this.socket.leave(this.game.room);
    this.socket.removeAllListeners("leave game");
    this.socket.removeAllListeners("move");
  }
}

module.exports = Player;
