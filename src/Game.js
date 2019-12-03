const {
  mrXTickets,
  pieceColors,
  detectiveTicktes,
  TicketType,
  transportationToTicketMap
} = require("./constants");
const { gameboard } = require("./gameboard");
const { Random } = require("random-js");
const random = new Random();

class Game {
  constructor(players, io) {
    this.io = io;
    this.room = random.string(10);

    const { stations, connections, startingPositions } = gameboard;
    const { mrXPiece, detectivePieces, mrX } = this.generatePieces(
      players,
      startingPositions
    );

    this.stations = stations;
    this.connections = connections;
    this.pieces = [mrXPiece].concat(detectivePieces);
    this.mrXTurn = true;
    this.doubleTicket = false;
    this.movedPieces = [];
    this.mrXMovesCompleted = 0;
    this.mrXAppears = [1, 3];
    /** @type {?("mrx"|"det")} */
    this.winner;

    players.forEach(player => player.joinGame(this));
  }

  getClientPieceInfo(player) {
    let pieces = this.pieces;
    if (!player.isMrX)
      pieces = pieces.map(piece =>
        piece.isMrX ? { ...piece, stationNumber: 0 } : piece
      );
    // Serialize Map for sending
    pieces = pieces.map(piece => ({
      ...piece,
      tickets: Array.from(piece.tickets)
    }));
    return pieces;
  }

  generatePieces(players, startingPositions) {
    const mrX = random.pick(players);
    mrX.isMrX = true;
    const detectives = players.filter(player => player !== mrX);
    const mrXPiece = {
      id: 1,
      stationNumber: random.pick(startingPositions.mrX),
      color: "lightgrey",
      tickets: mrXTickets(),
      isMrX: true,
      playerName: mrX.name
    };
    mrX.ownPieceIds.push(mrXPiece.id);
    const detectivePositions = random.shuffle(
      startingPositions.detective.slice()
    );
    const detectivePieces = detectives.map((detective, index) => {
      const piece = {
        id: index + 2,
        stationNumber: detectivePositions[index],
        color: pieceColors[index],
        tickets: detectiveTicktes(),
        isMrX: false,
        playerName: detective.name
      };
      detective.ownPieceIds.push(piece.id);
      return piece;
    });
    return { mrXPiece, detectivePieces, mrX };
  }

  isMovePossible(move, player) {
    if (this.winner) return false;
    const { pieceId, stationNumber, ticketType } = move;
    const { piece, station } = this.parseMove(move);

    if (!piece) return false;
    if (!player.ownPieceIds.includes(pieceId)) return false;
    if (this.mrXTurn !== player.isMrX) return false;
    if (this.movedPieces.includes(pieceId)) return false;
    if (this.isValidDoubleTicket(player, ticketType, piece)) return true;

    if (!station) return false;
    const connections = findConnections(
      this.connections,
      piece.stationNumber,
      stationNumber
    );
    if (!connections.length) return false;
    if (this.isPersecutorAt(stationNumber)) return false;
    if (!isValidTicket(ticketType, connections)) return false;
    if (!this.pieceHasTicket(piece, ticketType)) return false;

    return true;
  }

  isValidDoubleTicket(player, ticketType, piece) {
    return (
      player.isMrX &&
      !this.doubleTicket &&
      ticketType === TicketType.Double &&
      this.pieceHasTicket(piece, TicketType.Double)
    );
  }

  parseMove({ stationNumber, pieceId }) {
    const station = this.stations.find(
      station => station.number === stationNumber
    );
    const piece = this.pieces.find(piece => piece.id === pieceId);
    return { piece, station };
  }

  pieceHasTicket(piece, ticketType) {
    const ticketCount = piece.tickets.get(ticketType);
    return ticketCount && ticketCount > 0;
  }

  isPersecutorAt(stationNumber) {
    return this.pieces
      .filter(piece => !piece.isMrX)
      .some(piece => piece.stationNumber === stationNumber);
  }

  doMove(move, player) {
    const { pieceId, stationNumber, ticketType } = move;
    const { piece } = this.parseMove(move);
    collectTicket(piece, ticketType);
    this.broadcastMove(player, move);
    if (ticketType == TicketType.Double) {
      this.doubleTicket = true;
    } else {
      this.movedPieces.push(pieceId);
      piece.stationNumber = stationNumber;
      if (this.mrXTurn) this.mrXMovesCompleted++;
      const switchedTurns = this.switchTurns();
      if (switchedTurns) {
        const winner = this.getWinner();
        if (winner) {
          this.winner = winner;
          this.broadcastGameover(winner);
        }
      }
    }
  }

  broadcastMove(player, move) {
    if (move.ticketType === TicketType.Double) {
      this.io.to(this.room).emit("mr x ticket", TicketType.Double);
    } else if (!player.isMrX) {
      this.io.to(this.room).emit("move", move);
    } else {
      player.socket.emit("move", move);
      this.io.to(this.room).emit("mr x ticket", move.ticketType);
      const mrXAppears = this.mrXAppears.includes(this.mrXMovesCompleted);
      if (mrXAppears) {
        player.socket.broadcast.to(this.room).emit("move", move);
      } else {
        const hiddenMove = { ...move, stationNumber: 0 };
        player.socket.broadcast.to(this.room).emit("move", hiddenMove);
      }
    }
  }

  switchTurns() {
    if (this.mrXTurn) {
      if (this.doubleTicket && this.movedPieces.length === 1) {
        this.movedPieces = [];
        this.doubleTicket = false;
        return false;
      }
      if (this.movedPieces.length < 1) return false;
      this.mrXTurn = false;
      this.movedPieces = [];
      this.io.to(this.room).emit("mr x done");
      return true;
    } else {
      if (this.movedPieces.length < this.pieces.length - 1) return false;
      this.mrXTurn = true;
      this.movedPieces = [];
      this.io.to(this.room).emit("detectives done");
      return true;
    }
  }

  getWinner() {
    if (this.isMrXCaught()) {
      return "det";
    }
    if (this.mrXTurn && this.isMrXSurrounded()) {
      return "det";
    }
    if (this.mrXTurn && this.mrXMovesCompleted >= 23) {
      return "mrx";
    }
  }

  isMrXSurrounded() {
    const mrXPiece = this.pieces.find(piece => piece.isMrX);
    const stationsNextToMrX = getStationsNextToStation(
      mrXPiece.stationNumber,
      this.connections
    );
    const isMrXSourrounded = stationsNextToMrX.every(stationNumber =>
      this.pieces.find(piece => piece.stationNumber === stationNumber)
    );
    return isMrXSourrounded;
  }

  isMrXCaught() {
    const mrXPiece = this.pieces.find(piece => piece.isMrX);
    const isMrXCaught = this.pieces
      .filter(piece => piece !== mrXPiece)
      .some(detective => mrXPiece.stationNumber === detective.stationNumber);
    return isMrXCaught;
  }

  broadcastGameover() {
    if (this.winner === "mrx") {
      this.io.to(this.room).emit("mr x won");
    } else if (this.winner === "det") {
      this.io.to(this.room).emit("detectives won");
    } else {
      console.log("invalid gameover broadcast");
    }
  }
}

function isValidTicket(ticketType, connections) {
  return connections.some(connection =>
    transportationToTicketMap.get(connection.type).includes(ticketType)
  );
}

function collectTicket(piece, ticketType) {
  piece.tickets.set(piece.tickets.get(ticketType) - 1);
}

function findConnections(connections, station1Number, station2Number) {
  return connections.filter(
    connection =>
      (connection.station1Number === station1Number &&
        connection.station2Number === station2Number) ||
      (connection.station1Number === station2Number &&
        connection.station2Number === station1Number)
  );
}

const getStationsNextToStation = (stationNumber, connections) => {
  return connections.reduce((stations, connection) => {
    if (stationNumber === connection.station1Number)
      return stations.concat(connection.station2Number);
    else if (stationNumber === connection.station2Number)
      return stations.concat(connection.station1Number);
    return stations;
  }, []);
};

module.exports = Game;
