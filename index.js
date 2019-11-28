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
    if (!isValidMove(move, player)) return;
    const game = player.game;
    doMove(move, game);
    if (!player.isMrX) {
      io.to(game.room).emit("move", move);
    } else {
      socket.emit("move", move);
    }
    switchTurns(game);
    console.log(game);
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
  if (!game) return false;
  const { piece: pieceId, station: stationNumber } = move;
  const station = game.stations.find(
    station => station.number === stationNumber
  );
  const piece = game.pieces.find(piece => piece.id === pieceId);
  if (!piece || !station) return false;

  if (!player.ownPieceIds.includes(pieceId)) return false;
  if (game.mrXTurn !== player.isMrX) return false;
  const connection = findConnection(
    game.connections,
    piece.station,
    stationNumber
  );
  if (!connection) return false;
  if (game.movedPieces.includes(pieceId)) return false;

  if (
    game.pieces
      .filter(piece => !piece.isMrX)
      .find(piece => piece.station === stationNumber)
  )
    return false;
  // ticket is valid
  // player has ticket
  return true;
}

function doMove(move, game) {
  const { piece: pieceId, station: stationNumber } = move;
  const piece = game.pieces.find(piece => pieceId === piece.id);
  game.movedPieces.push(pieceId);
  piece.station = stationNumber;
}

function findConnection(connections, station1, station2) {
  return connections.find(
    connection =>
      (connection.station1 === station1 && connection.station2 === station2) ||
      (connection.station1 === station2 && connection.station2 === station1)
  );
}

function switchTurns(game) {
  if (game.mrXTurn && game.movedPieces.length === 1) {
    game.mrXTurn = false;
    game.movedPieces = [];
    io.to(game.room).emit("mr x done");
  } else if (
    !game.mrXTurn &&
    game.movedPieces.length === game.pieces.length - 1
  ) {
    game.mrXTurn = true;
    game.movedPieces = [];
    io.to(game.room).emit("detectives done");
  }
}

function startGameWhenPossible(numberOfPlayers = 3) {
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
    station: random.pick(startingPositions.mrX),
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
      station: detectivePositions[index],
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
    movedPieces: []
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
    { station1: 1, station2: 2, type: TransportationType.Taxi },
    { station1: 2, station2: 3, type: TransportationType.Taxi },
    { station1: 3, station2: 4, type: TransportationType.Taxi },
    { station1: 4, station2: 7, type: TransportationType.Taxi },
    { station1: 7, station2: 6, type: TransportationType.Taxi },
    { station1: 6, station2: 5, type: TransportationType.Taxi },
    { station1: 5, station2: 1, type: TransportationType.Taxi },
    { station1: 1, station2: 6, type: TransportationType.Bus },
    { station1: 6, station2: 4, type: TransportationType.Bus },
    { station1: 4, station2: 3, type: TransportationType.Bus },
    { station1: 3, station2: 1, type: TransportationType.Bus },
    { station1: 1, station2: 4, type: TransportationType.Underground }
  ],
  startingPositions: {
    mrX: [1, 7],
    detective: [3, 4, 5]
  }
};
