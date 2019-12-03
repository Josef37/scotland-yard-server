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
    this.movedPieces = [];
    this.mrXMovesCompleted = 0;
    this.mrXAppears = [1, 3];

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

  isValidMove(move, player) {
    if (this.winner) return false;
    const { pieceId, stationNumber, ticketType } = move;
    const station = this.stations.find(
      station => station.number === stationNumber
    );
    const piece = this.pieces.find(piece => piece.id === pieceId);
    if (!piece || !station) return false;

    if (!player.ownPieceIds.includes(pieceId)) return false;
    if (this.mrXTurn !== player.isMrX) return false;
    if (
      player.isMrX &&
      ticketType === TicketType.Double &&
      piece.tickets.get(TicketType.Double)
    ) {
      return true;
    }
    const connections = findConnections(
      this.connections,
      piece.stationNumber,
      stationNumber
    );
    if (!connections.length) return false;
    if (this.movedPieces.includes(pieceId) && !this.mrXTurn) return false;

    if (
      this.pieces
        .filter(piece => !piece.isMrX)
        .find(piece => piece.stationNumber === stationNumber)
    ) {
      return false;
    }

    if (!isValidTicket(ticketType, connections)) {
      return false;
    }
    const ticketCount = piece.tickets.get(ticketType);
    if (ticketCount === undefined || ticketCount <= 0) {
      return false;
    }

    return true;
  }

  doMove(move, player) {
    const { pieceId, stationNumber, ticketType } = move;
    const piece = this.pieces.find(piece => pieceId === piece.id);
    if (ticketType !== TicketType.Double) {
      this.movedPieces.push(pieceId);
      piece.stationNumber = stationNumber;
    } else {
      this.doubleTicket = true;
      this.mrXMovesCompleted++;
      move.stationNumber = piece.stationNumber;
    }
    collectTicket(piece, ticketType);

    const switchedTurns = this.switchTurns();
    this.broadcastMove(player, move);
    if (!switchedTurns) return;
    const winner = this.getWinner();
    if (winner) this.triggerGameover(winner);
  }

  broadcastMove(player, move) {
    if (!player.isMrX) {
      this.io.to(this.room).emit("move", move);
    } else {
      player.socket.emit("move", move);
      player.socket.broadcast.to(this.room).emit("move", {
        ...move,
        stationNumber: this.mrXAppears.includes(this.mrXMovesCompleted)
          ? move.stationNumber
          : 0
      });
      this.io.to(this.room).emit("mr x ticket", move.ticketType);
    }
  }

  switchTurns() {
    if (
      this.mrXTurn &&
      this.movedPieces.length === (this.doubleTicket ? 2 : 1)
    ) {
      this.mrXTurn = false;
      this.movedPieces = [];
      this.doubleTicket = false;
      this.io.to(this.room).emit("mr x done");
      this.mrXMovesCompleted++;
      return true;
    } else if (
      !this.mrXTurn &&
      this.movedPieces.length === this.pieces.length - 1
    ) {
      this.mrXTurn = true;
      this.movedPieces = [];
      this.io.to(this.room).emit("detectives done");
      return true;
    }
    return false;
  }

  getWinner() {
    const mrXPiece = this.pieces.find(piece => piece.isMrX);
    const isMrXCaught = this.pieces.some(
      piece =>
        piece !== mrXPiece && mrXPiece.stationNumber === piece.stationNumber
    );
    if (isMrXCaught) {
      return "detectives";
    }

    const stationsNextToMrX = getStationsNextToStation(
      mrXPiece.stationNumber,
      this.connections
    );
    const isMrXSourrounded = stationsNextToMrX.every(stationNumber =>
      this.pieces.find(piece => piece.stationNumber === stationNumber)
    );
    if (isMrXSourrounded && this.mrXTurn) {
      return "detectives";
    }

    if (this.mrXMovesCompleted >= 10 && this.mrXTurn) {
      return "mrx";
    }
  }

  triggerGameover(winner) {
    if (winner === "mrx") {
      this.io.to(this.room).emit("mr x won");
    } else {
      this.io.to(this.room).emit("detectives won");
    }
    this.winner = winner;
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
