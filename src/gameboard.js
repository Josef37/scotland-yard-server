const { TransportationType } = require("./constants");
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
exports.gameboard = gameboard;
