// place files you want to import through the `$lib` alias in this folder.

import { Array, Option, pipe } from "effect";
import { assign, createActor, enqueueActions, log, setup } from "xstate";

type Crosses = 0;
type Circles = 1;
type Player = Crosses | Circles;
type Column = [
  Option.Option<Player>,
  Option.Option<Player>,
  Option.Option<Player>
];
type Board = [Column, Column, Column];

const CROSSES = 0;
const CIRCLES = 1;

const getEmptyBoard = (): Board => [
  [Option.none(), Option.none(), Option.none()],
  [Option.none(), Option.none(), Option.none()],
  [Option.none(), Option.none(), Option.none()],
];

const rowsFromBoard = (board: Board): Board => [
  [board[0][0], board[1][0], board[2][0]],
  [board[0][1], board[1][1], board[2][1]],
  [board[0][2], board[1][2], board[2][2]],
];

export const printBoard = (board: Board) =>
  pipe(
    board,
    Array.map(
      Array.map((cell) =>
        Option.isNone(cell) ? "---" : cell.value === CROSSES ? " X " : " O "
      )
    ),
    Array.map(Array.join("|")),
    Array.join("\n")
  );

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest;

  describe("printBoard", () => {
    it("should return a string representation of the board", () => {
      const board: Board = [
        [Option.some(CROSSES), Option.none(), Option.some(CIRCLES)],
        [Option.none(), Option.none(), Option.none()],
        [Option.none(), Option.none(), Option.none()],
      ];

      expect(printBoard(board)).toEqual(
        " X |---| O \n---|---|---\n---|---|---"
      );
    });
  });
}

const checkWinnerFromCells =
  (player: Player) =>
  (
    cells: [Option.Option<Player>, Option.Option<Player>, Option.Option<Player>]
  ) => {
    const somes = Array.getSomes(cells);

    if (somes.length < 3) return false;

    return Array.every(somes, (some) => some === player);
  };

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest;

  describe("rowsFromBoard", () => {
    it("should return the rows of the board", () => {
      const board: Board = [
        [Option.some(CROSSES), Option.none(), Option.some(CIRCLES)],
        [Option.none(), Option.none(), Option.none()],
        [Option.none(), Option.none(), Option.none()],
      ];

      expect(rowsFromBoard(board)).toEqual([
        [Option.some(CROSSES), Option.none(), Option.none()],
        [Option.none(), Option.none(), Option.none()],
        [Option.some(CIRCLES), Option.none(), Option.none()],
      ]);
    });
  });
}

const checkWinner = (player: Player) => (cols: Board) => {
  const rows: Board = rowsFromBoard(cols);
  const diagA: [
    Option.Option<Player>,
    Option.Option<Player>,
    Option.Option<Player>
  ] = [cols[0][0], cols[1][1], cols[2][2]];
  const diagB: [
    Option.Option<Player>,
    Option.Option<Player>,
    Option.Option<Player>
  ] = [cols[0][2], cols[1][1], cols[2][0]];

  return pipe(
    [...cols, ...rows, diagA, diagB],
    Array.some(checkWinnerFromCells(player))
  );
};

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest;
  describe("checkWinner", () => {
    it("should return no winner if there is not one", () => {
      const board: Board = [
        [Option.some(CROSSES), Option.none(), Option.some(CIRCLES)],
        [Option.some(CROSSES), Option.some(CIRCLES), Option.some(CIRCLES)],
        [Option.none(), Option.none(), Option.none()],
      ];

      expect(checkWinner(CIRCLES)(board)).toBeFalsy();
      expect(checkWinner(CROSSES)(board)).toBeFalsy();
    });

    it("should return the winner if there is one", () => {
      const board: Board = [
        [Option.some(CROSSES), Option.some(CROSSES), Option.some(CROSSES)],
        [Option.none(), Option.none(), Option.none()],
        [Option.some(CIRCLES), Option.none(), Option.none()],
      ];

      expect(checkWinner(CROSSES)(board)).toBeTruthy();
      expect(checkWinner(CIRCLES)(board)).toBeFalsy();
    });
  });
}

const machine = setup({
  types: {
    context: {} as {
      board: Board;
      turn: number;
      winner: Option.Option<0 | 1>;
      crossesPlayerId: Option.Option<number>;
      circlesPlayerId: Option.Option<number>;
      startingPlayer: Player;
    },
  },
  guards: {
    hasOnePlayer: ({ context }) => {
      if (
        Option.isNone(context.crossesPlayerId) &&
        Option.isNone(context.circlesPlayerId)
      ) {
        return false;
      }

      if (
        Option.isSome(context.crossesPlayerId) &&
        Option.isSome(context.circlesPlayerId)
      ) {
        return false;
      }

      return true;
    },

    hasWinner: ({ context }) =>
      checkWinner(CROSSES)(context.board) ||
      checkWinner(CIRCLES)(context.board),
  },
  actions: {
    addPlayer: assign((_, { id, player }: { id: number; player: Player }) =>
      player === CROSSES
        ? {
            crossesPlayerId: Option.some(id),
          }
        : {
            circlesPlayerId: Option.some(id),
          }
    ),
    removePlayer: assign((_, { player }: { player: Player }) =>
      player === CROSSES
        ? { crossesPlayerId: Option.none() }
        : { circlesPlayerId: Option.none() }
    ),
    updateBoard: assign({
      board: (
        _,
        {
          board,
          row,
          col,
          player,
        }: { row: number; col: number; player: Player; board: Board }
      ) =>
        Array.modify(
          board,
          row,
          Array.modify(col, () => Option.some(player))
        ) as Board,
    }),
  },
}).createMachine({
  context: {
    board: getEmptyBoard(),
    turn: 0,
    winner: Option.none(),
    crossesPlayerId: Option.none(),
    circlesPlayerId: Option.none(),
    startingPlayer: 1,
  },
  initial: "waiting",
  states: {
    waiting: {
      on: {
        player_join: [
          {
            guard: "hasOnePlayer",
            target: "playing",
            actions: [
              {
                type: "addPlayer",
                params: ({ context, event }) =>
                  Option.isSome(context.crossesPlayerId)
                    ? {
                        id: event.playerId,
                        player: CIRCLES,
                      }
                    : {
                        id: event.playerId,
                        player: CROSSES,
                      },
              },
              assign({ turn: 0 }),
              log("player 2 joined"),
            ],
          },
          {
            actions: [
              {
                type: "addPlayer",
                params: ({ event }) =>
                  Math.random() > 0.5
                    ? {
                        id: event.playerId,
                        player: CROSSES,
                      }
                    : {
                        id: event.playerId,
                        player: CIRCLES,
                      },
              },
              log("player 1 joined"),
            ],
          },
        ],
      },
    },
    playing: {
      on: {
        move: {
          actions: [
            enqueueActions(({ enqueue, context, event }) => {
              console.log("Turn:", context.turn + context.startingPlayer);
              const currentPlayer =
                (context.turn + context.startingPlayer) % 2 === CROSSES
                  ? CROSSES
                  : CIRCLES;

              console.log("currentPlayer", currentPlayer);

              enqueue({
                type: "updateBoard",
                params: {
                  board: context.board,
                  player: currentPlayer,
                  row: event.row,
                  col: event.col,
                },
              });
              enqueue.assign({ turn: ({ context }) => context.turn + 1 });

              enqueue.raise({
                type: "check_winner",
                player: currentPlayer,
              });
            }),
          ],
        },
        winner: {
          target: "ended",
          actions: assign({ winner: ({ event }) => event.player }),
        },
        check_winner: {
          guard: "hasWinner",
          target: "ended",
          actions: assign({ winner: ({ event }) => event.player }),
        },
      },
    },
    ended: {
      type: "final",
    },
  },
});

export const actor = createActor(machine);

actor.start();
