class Player {
  constructor(name, socket) {
    this.name = name;
    this.socket = socket;
    this.game = null;
    this.ownPieceIds = [];
    this.isMrX = false;
  }

  joinGame(game) {
    this.socket.join(game.room);
    this.game = game;
    this.initClientGame();
    this.initClientMoveHandler();
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

  initClientMoveHandler() {
    this.socket.on("move", move => {
      if (!this.game.isValidMove(move, this)) return;
      this.game.doMove(move, this);
    });
  }
}

module.exports = Player;
