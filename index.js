const io = require("socket.io")(80);
const { Random } = require("random-js");
const random = new Random();

const players = {};
let playerCounter = 1;
let gameCounter = 1;

io.on("connection", socket => {
  socket.on("set name", name => {
    const player = { name, socket, game: null, ownPieceIds: [], isMrX: false };
    players[socket.id] = player;
    updateLobby();
    startGameWhenPossible();
  });

  socket.on("move", move => {
    const player = players[socket.id];
    if (!player) return;
    if (!isValidMove(move, player)) return;
    const game = player.game;
    doMove(move, game);
    if (!player.isMrX) {
      io.to(game.room).emit("move", move);
    } else {
      socket.emit("move", move);
      io.to(game.room).emit("mr x ticket", move.ticketType);
    }
    const switchedTurns = switchTurns(game);
    if (!switchedTurns) return;
    const winner = getWinner(game);
    if (winner) triggerGameover(game, winner);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

function updateLobby() {
  const lobbyData = {
    players: {
      playing: Object.values(players)
        .filter(player => player.game)
        .map(player => player.name),
      searching: Object.values(players)
        .filter(player => !player.game)
        .map(player => player.name)
    }
  };
  io.emit("load lobby", lobbyData);
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
  if (!piece.tickets.get(ticketType)) {
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

function switchTurns(game) {
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

  if (game.mrXMovesCompleted >= 3 && game.mrXTurn) {
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

const triggerGameover = (game, winner) => {
  io.to(game.room).emit(
    "game over",
    winner === "mrx" ? "Mr X won" : "Detectives won"
  );
  game.winner = winner;
};

function startGameWhenPossible(numberOfPlayers = 2) {
  const searchingPlayerIds = Object.values(players)
    .filter(player => !player.game)
    .map(player => player.socket.id);
  if (searchingPlayerIds.length < numberOfPlayers) return;

  const game = { room: String(gameCounter++) };
  const playerIds = searchingPlayerIds.slice(0, numberOfPlayers);
  playerIds.forEach(id => {
    players[id].socket.join(game.room);
    players[id].game = game;
  });

  const { stations, connections, startingPositions } = gameboard;
  const mrXId = random.pick(playerIds);
  players[mrXId].isMrX = true;
  const detectiveIds = playerIds.filter(id => id !== mrXId);
  const mrXPiece = {
    id: 1,
    stationNumber: random.pick(startingPositions.mrX),
    color: "lightgrey",
    tickets: mrXTickets(),
    isMrX: true
  };
  players[mrXId].ownPieceIds.push(mrXPiece.id);
  const detectivePositions = random.shuffle(
    startingPositions.detective.slice()
  );
  const detectivePieces = detectiveIds.map((id, index) => {
    const piece = {
      id: index + 2,
      stationNumber: detectivePositions[index],
      color: pieceColors[index],
      tickets: detectiveTicktes(),
      isMrX: false
    };
    players[id].ownPieceIds.push(piece.id);
    return piece;
  });

  Object.assign(game, {
    stations,
    connections,
    pieces: detectivePieces.concat(mrXPiece),
    mrXTurn: true,
    movedPieces: [],
    mrXMovesCompleted: 0
  });

  for (const playerId of playerIds) {
    let pieces = detectivePieces.slice();
    if (playerId === mrXId) pieces.push(mrXPiece);
    players[playerId].socket.emit("start game", {
      stations,
      connections,
      pieces,
      ownPieceIds: players[playerId].ownPieceIds
    });
  }
}

const TransportationType = {
  Taxi: 0,
  Bus: 1,
  Underground: 2,
  Ferry: 3
};

const TicketType = {
  Taxi: 0,
  Bus: 1,
  Underground: 2,
  Black: 3,
  Double: 4
};

const transportationToTicketMap = new Map([
  [TransportationType.Taxi, [TicketType.Taxi, TicketType.Black]],
  [TransportationType.Bus, [TicketType.Bus, TicketType.Black]],
  [TransportationType.Underground, [TicketType.Underground, TicketType.Black]],
  [TransportationType.Ferry, [TicketType.Black]]
]);

const mrXTickets = () => {
  return new Map([
    [TicketType.Taxi, Infinity],
    [TicketType.Bus, Infinity],
    [TicketType.Underground, Infinity],
    [TicketType.Black, 5],
    [TicketType.Double, 2]
  ]);
};

const detectiveTicktes = () => {
  return new Map([
    [TicketType.Taxi, 11],
    [TicketType.Bus, 8],
    [TicketType.Underground, 4],
    [TicketType.Black, 0],
    [TicketType.Double, 0]
  ]);
};

const bobbyTicktes = () => {
  return new Map([
    [TicketType.Taxi, Infinity],
    [TicketType.Bus, Infinity],
    [TicketType.Underground, Infinity],
    [TicketType.Black, 0],
    [TicketType.Double, 0]
  ]);
};

const pieceColors = ["blue", "red", "yellow"];

const gameboard = {
  stations: [
    { number: 1, x: 0, y: 0 },
    { number: 2, x: 1, y: 0 },
    { number: 3, x: 2, y: 0 },
    { number: 4, x: 3, y: 1 },
    { number: 5, x: 1, y: 2 },
    { number: 6, x: 2, y: 2 },
    { number: 7, x: 3, y: 2 }
  ],
  connections: [
    { station1Number: 1, station2Number: 2, type: TransportationType.Taxi },
    { station1Number: 2, station2Number: 3, type: TransportationType.Taxi },
    { station1Number: 3, station2Number: 4, type: TransportationType.Taxi },
    { station1Number: 4, station2Number: 7, type: TransportationType.Taxi },
    { station1Number: 7, station2Number: 6, type: TransportationType.Taxi },
    { station1Number: 6, station2Number: 5, type: TransportationType.Taxi },
    { station1Number: 5, station2Number: 1, type: TransportationType.Taxi },
    { station1Number: 1, station2Number: 6, type: TransportationType.Bus },
    { station1Number: 6, station2Number: 4, type: TransportationType.Bus },
    { station1Number: 4, station2Number: 3, type: TransportationType.Bus },
    { station1Number: 3, station2Number: 1, type: TransportationType.Bus },
    {
      station1Number: 1,
      station2Number: 4,
      type: TransportationType.Underground
    }
  ],
  startingPositions: {
    mrX: [1, 7],
    detective: [3, 4, 5]
  }
};
