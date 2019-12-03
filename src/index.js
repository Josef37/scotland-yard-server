const { GameScheduler } = require("./GameScheduler");
const io = require("socket.io")(80);

const players = {};
const gameScheduler = new GameScheduler(io);

io.on("connection", socket => {
  socket.on("set name", name => {
    const player = { name, socket, game: null, ownPieceIds: [], isMrX: false };
    gameScheduler.joinLobby(player);
  });

  socket.on("disconnect", () => {
    gameScheduler.leaveLobby(socket);
  });
});
