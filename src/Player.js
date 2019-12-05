class Player {
  constructor(name, socket, gameScheduler) {
    this.name = name;
    this.socket = socket;
    this.gameScheduler = gameScheduler;
    this.initValues();
    this.socket.on("start searching", fn => {
      if (!this.game) gameScheduler.startSearching(this);
      fn(!this.game);
    });
    this.socket.on("stop searching", fn => {
      if (!this.game) gameScheduler.stopSearching(this);
      fn(!this.game);
    });
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
    this.removeClientEventHandlers();
    this.initValues();
    this.gameScheduler.stopSearching(this);
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
      if (!this.game.isMovePossible(move, this)) return;
      this.game.doMove(move, this);
    });
    this.socket.on("leave game", () => {
      this.leaveGame();
    });
  }

  removeClientEventHandlers() {
    this.socket.leave(this.game.room);
    this.socket.removeAllListeners("leave game");
    this.socket.removeAllListeners("move");
  }
}

module.exports = Player;
