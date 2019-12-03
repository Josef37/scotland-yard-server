const Game = require("./Game");

class GameScheduler {
  constructor(io) {
    this.io = io;
    /** All searching players */
    this.lobby = [];
    this.games = [];
  }

  joinLobby(player) {
    this.lobby = this.lobby.concat(player);
    this.io.emit("load lobby", {
      players: { playing: [], searching: this.lobby.map(player => player.name) }
    });
    this.startGameWhenPossible();
  }

  leaveLobby(socket) {
    this.lobby = this.lobby.filter(player => player.socket !== socket);
  }

  startGameWhenPossible(numberOfPlayers = 2) {
    const searchingPlayers = this.lobby;
    if (searchingPlayers.length < numberOfPlayers) return;

    const players = searchingPlayers.slice(0, numberOfPlayers);
    const game = new Game(players, this.io);
    this.games = this.games.concat(game);
  }
}

module.exports = GameScheduler;
