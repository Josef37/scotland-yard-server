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
