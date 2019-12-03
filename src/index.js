const GameScheduler = require("./GameScheduler");
const Player = require("./Player");
const io = require("socket.io")(80);

const players = {};
const gameScheduler = new GameScheduler(io);

io.on("connection", socket => {
  socket.on("set name", name => {
    const player = new Player(name, socket);
    gameScheduler.joinLobby(player);
  });

  socket.on("disconnect", () => {
    gameScheduler.leaveLobby(socket);
  });
});
