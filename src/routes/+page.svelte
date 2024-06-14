<script lang="ts">
  import { actor, printBoard } from "$lib";

  actor.subscribe((snapshot) => {
    console.log(printBoard(snapshot.context.board));

    if (snapshot.status === "done") {
      console.log(`done, player ${snapshot.context.winner} won!`);
    }
  });
  actor.send({ type: "player_join", playerId: 1 });
  actor.send({ type: "player_join", playerId: 2 });
  actor.send({ type: "move", row: 1, col: 1 });
  actor.send({ type: "move", row: 1, col: 0 });
  actor.send({ type: "move", row: 0, col: 1 });
  actor.send({ type: "move", row: 1, col: 2 });
  actor.send({ type: "move", row: 2, col: 1 });
</script>
