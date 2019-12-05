const Game = require("./Game");
const Player = require("./Player");

class GameScheduler {
  constructor(io) {
    this.io = io;
    /** @type {{pausing: Player[], searching: Player[]}} */
    this.lobby = { pausing: [], searching: [] };
    this.games = [];
  }

  takeNewPlayer(name, socket) {
    const player = new Player(name, socket, this);
    this.stopSearching(player);
  }

  broadcastLobby() {
    this.io.emit("load lobby", {
      players: {
        pausing: this.lobby.pausing.map(player => player.name),
        searching: this.lobby.searching.map(player => player.name)
      }
    });
  }

  startSearching(player) {
    this.lobby.pausing = this.lobby.pausing.filter(
      otherPlayer => otherPlayer !== player
    );
    this.lobby.searching = this.lobby.searching.concat(player);
    this.broadcastLobby();
    this.startGameWhenPossible();
  }

  stopSearching(player) {
    this.lobby.searching = this.lobby.searching.filter(
      otherPlayer => otherPlayer !== player
    );
    this.lobby.pausing = this.lobby.pausing.concat(player);
    this.broadcastLobby();
    this.startGameWhenPossible();
  }

  leaveLobby(socket) {
    this.lobby.pausing = this.lobby.pausing.filter(
      player => player.socket !== socket
    );
    this.lobby.searching = this.lobby.searching.filter(
      player => player.socket !== socket
    );
  }

  startGameWhenPossible(numberOfPlayers = 2) {
    const searchingPlayers = this.lobby.searching;
    if (searchingPlayers.length < numberOfPlayers) return;

    const players = searchingPlayers.slice(0, numberOfPlayers);
    players.forEach(player => this.leaveLobby(player.socket));
    const game = new Game(players, this.io);
    this.games = this.games.concat(game);
  }
}

module.exports = GameScheduler;
