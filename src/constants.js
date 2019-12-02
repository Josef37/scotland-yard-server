const TransportationType = {
  Taxi: "Taxi",
  Bus: "Bus",
  Underground: "Underground",
  Ferry: "Ferry"
};

const TicketType = {
  Taxi: "Taxi",
  Bus: "Bus",
  Underground: "Underground",
  Black: "Black",
  Double: "Double"
};

const transportationToTicketMap = new Map([
  [TransportationType.Taxi, [TicketType.Taxi, TicketType.Black]],
  [TransportationType.Bus, [TicketType.Bus, TicketType.Black]],
  [TransportationType.Underground, [TicketType.Underground, TicketType.Black]],
  [TransportationType.Ferry, [TicketType.Black]]
]);

const mrXTickets = () => {
  return new Map([
    [TicketType.Taxi, 10 ** 6],
    [TicketType.Bus, 10 ** 6],
    [TicketType.Underground, 10 ** 6],
    [TicketType.Black, 5],
    [TicketType.Double, 2]
  ]);
};

const detectiveTicktes = () => {
  return new Map([
    [TicketType.Taxi, 11],
    [TicketType.Bus, 8],
    [TicketType.Underground, 4],
    [TicketType.Black, -(10 ** 6)],
    [TicketType.Double, -(10 ** 6)]
  ]);
};

const bobbyTicktes = () => {
  return new Map([
    [TicketType.Taxi, 10 ** 6],
    [TicketType.Bus, 10 ** 6],
    [TicketType.Underground, 10 ** 6],
    [TicketType.Black, -(10 ** 6)],
    [TicketType.Double, -(10 ** 6)]
  ]);
};

const pieceColors = ["blue", "red", "yellow", "darkgreen", "white"];

module.exports = {
  TransportationType,
  TicketType,
  transportationToTicketMap,
  mrXTickets,
  detectiveTicktes,
  bobbyTicktes,
  pieceColors
};
