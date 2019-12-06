const fs = require("fs");
const GameScheduler = require("./GameScheduler");
const io = require("socket.io")(80);

const players = {};
const gameScheduler = new GameScheduler(io);

io.on("connection", socket => {
  socket.on("set name", name => {
    gameScheduler.takeNewPlayer(name, socket);
  });

  socket.on(
    "submit gameboard",
    (stations, connections, startingPositions, confirmSuccess) => {
      const map = { stations, connections, startingPositions };
      fs.writeFile(
        __dirname + `/../maps/map-${Date.now()}`,
        JSON.stringify(map),
        "utf8",
        err => {
          if (err) {
            console.log(err);
            confirmSuccess(false);
          } else {
            confirmSuccess(true);
          }
        }
      );
    }
  );

  socket.on("disconnect", () => {
    gameScheduler.leaveLobby(socket);
  });
});
