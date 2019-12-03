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
    players.forEach(player => {
      player.socket.join(this.room);
      player.game = this;
    });

    const { stations, connections, startingPositions } = gameboard;
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

    this.stations = stations;
    this.connections = connections;
    this.pieces = [mrXPiece].concat(detectivePieces);
    this.mrXTurn = true;
    this.movedPieces = [];
    this.mrXMovesCompleted = 0;
    this.mrXAppears = [1, 3];

    for (const player of players) {
      let pieces = detectivePieces.slice();
      if (player === mrX) pieces.unshift(mrXPiece);
      else pieces.unshift({ ...mrXPiece, stationNumber: 0 });
      // Serialize Map for sending
      pieces = pieces.map(piece => ({
        ...piece,
        tickets: Array.from(piece.tickets)
      }));
      player.socket.emit("start game", {
        stations,
        connections,
        pieces,
        ownPieceIds: player.ownPieceIds,
        mrXTurn: true
      });
      player.socket.on("move", move => {
        if (!isValidMove(move, player)) return;
        const game = player.game;
        doMove(move, game);
        const switchedTurns = switchTurns(game, this.io);
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
        if (!switchedTurns) return;
        const winner = getWinner(game);
        if (winner) triggerGameover(game, winner, this.io);
      });
    }
  }
}

function isValidMove(move, player) {
  const game = player.game;
  if (!game || game.winner) return false;
  const { pieceId, stationNumber, ticketType } = move;
  const station = game.stations.find(
    station => station.number === stationNumber
  );
  const piece = game.pieces.find(piece => piece.id === pieceId);
  if (!piece || !station) return false;

  if (!player.ownPieceIds.includes(pieceId)) return false;
  if (game.mrXTurn !== player.isMrX) return false;
  if (
    player.isMrX &&
    ticketType === TicketType.Double &&
    piece.tickets.get(TicketType.Double)
  ) {
    return true;
  }
  const connections = findConnections(
    game.connections,
    piece.stationNumber,
    stationNumber
  );
  if (!connections.length) return false;
  if (game.movedPieces.includes(pieceId) && !game.mrXTurn) return false;

  if (
    game.pieces
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

function isValidTicket(ticketType, connections) {
  return connections.some(connection =>
    transportationToTicketMap.get(connection.type).includes(ticketType)
  );
}

function doMove(move, game) {
  const { pieceId, stationNumber, ticketType } = move;
  const piece = game.pieces.find(piece => pieceId === piece.id);
  if (ticketType !== TicketType.Double) {
    game.movedPieces.push(pieceId);
    piece.stationNumber = stationNumber;
  } else {
    game.doubleTicket = true;
    game.mrXMovesCompleted++;
    move.stationNumber = piece.stationNumber;
  }
  collectTicket(piece, ticketType);
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

function switchTurns(game, io) {
  if (game.mrXTurn && game.movedPieces.length === (game.doubleTicket ? 2 : 1)) {
    game.mrXTurn = false;
    game.movedPieces = [];
    game.doubleTicket = false;
    io.to(game.room).emit("mr x done");
    game.mrXMovesCompleted++;
    return true;
  } else if (
    !game.mrXTurn &&
    game.movedPieces.length === game.pieces.length - 1
  ) {
    game.mrXTurn = true;
    game.movedPieces = [];
    io.to(game.room).emit("detectives done");
    return true;
  }
  return false;
}

const getWinner = game => {
  const mrXPiece = game.pieces.find(piece => piece.isMrX);
  const isMrXCaught = game.pieces.some(
    piece =>
      piece !== mrXPiece && mrXPiece.stationNumber === piece.stationNumber
  );
  if (isMrXCaught) {
    return "detectives";
  }

  const stationsNextToMrX = getStationsNextToStation(
    mrXPiece.stationNumber,
    game.connections
  );
  const isMrXSourrounded = stationsNextToMrX.every(stationNumber =>
    game.pieces.find(piece => piece.stationNumber === stationNumber)
  );
  if (isMrXSourrounded && game.mrXTurn) {
    return "detectives";
  }

  if (game.mrXMovesCompleted >= 10 && game.mrXTurn) {
    return "mrx";
  }
};

const getStationsNextToStation = (stationNumber, connections) => {
  return connections.reduce((stations, connection) => {
    if (stationNumber === connection.station1Number)
      return stations.concat(connection.station2Number);
    else if (stationNumber === connection.station2Number)
      return stations.concat(connection.station1Number);
    return stations;
  }, []);
};

const triggerGameover = (game, winner, io) => {
  if (winner === "mrx") {
    io.to(game.room).emit("mr x won");
  } else {
    io.to(game.room).emit("detectives won");
  }
  game.winner = winner;
};

module.exports = { Game };
