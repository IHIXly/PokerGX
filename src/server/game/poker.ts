import { Deck, evaluateHighestCard } from "./cards";

export interface Player {
  name: string;
  chips: number;
  settedChips: number;
  checked: boolean;
  allIn: boolean;
  cards: number[][];
  score: number;
}

export interface Room {
  members: Player[];
  locked: boolean;
  phase: number;
  turnOrder: string[];
  currentTurnIndex: number;
  blindsIndex: number;
  deck: Deck;
  cards: number[][];
  roundNumber: number;
  smallBlind: string;
  bigBlind: string;
}

export interface CheckCallData {
  sessionId: string;
  playerName: string;
  amount?: number;
}

export interface FoldData {
  sessionId: string;
  playerName: string;
}

export interface ChatData {
  sessionId: string;
  playerName: string;
  message: string;
}

export interface ReadyData {
  sessionId: string;
  playerName: string;
}

export interface RoundResult {
  winnerName: string;
  totalPot: number;
  playerHands: Array<{
    name: string;
    cards: number[][];
    handType: string | null;
    chips: number;
  }>;
}

export interface HandleActionResult {
  playerName: string;
  action: string;
  amount: number;
  roundResult: RoundResult | null;
}

export class PokerGame {
  static createRoom(): Room {
    return {
      members: [],
      locked: false,
      phase: 0,
      turnOrder: [],
      currentTurnIndex: 0,
      blindsIndex: 0,
      deck: new Deck(),
      cards: [],
      roundNumber: 0,
      smallBlind: "",
      bigBlind: "",
    };
  }

  static initializeRoomMembers(room: Room, players: Array<{ name: string; chips?: number }>): void {
    room.members = players.map((p) => ({
      name: p.name,
      chips: p.chips ?? 1000,
      settedChips: 0,
      checked: false,
      allIn: false,
      cards: [],
      score: 0,
    }));
  }

  static startNewRound(room: Room): RoundResult | null {
    room.phase = 0;
    room.roundNumber += 1;
    room.members.forEach((p) => {
      p.settedChips = 0;
      p.checked = false;
      p.allIn = false;
      p.score = 0;
    });

    room.turnOrder = room.members.filter((p) => p.chips > 0).map((p) => p.name);
    room.cards = [];
    room.deck.reset();

    room.members.forEach((p) => {
      if (room.turnOrder.includes(p.name)) {
        const playerCards = room.deck.drawTwoCards();
        p.cards = playerCards ? playerCards : [];
      }
    });

    room.currentTurnIndex = room.blindsIndex % room.turnOrder.length;
    room.blindsIndex += 1;

    room.smallBlind = room.turnOrder[room.currentTurnIndex] ?? "";
    room.bigBlind = room.turnOrder[(room.currentTurnIndex + 1) % room.turnOrder.length] ?? "";

    return this.nextPhase(room);
  }

  static chipsTransfer(room: Room, player: Player, amount: number): RoundResult | null {
    return chipsTransfer(room, player, amount);
  }

  static checkPlayer(room: Room, player: Player): void {
    return checkPlayer(room, player);
  }

  static killCheckedStatus(room: Room): void {
    return killCheckedStatus(room);
  }

  static quitTurnOrder(room: Room): RoundResult | null {
    return quitTurnOrder(room);
  }

  static goAllin(room: Room, player: Player): RoundResult | null {
    return goAllin(room, player);
  }

  static nextTurn(room: Room, turnSteps: number): RoundResult | null {
    return nextTurn(room, turnSteps);
  }

  static winnerOfTheRound(room: Room): RoundResult {
    return winnerOfTheRound(room);
  }

  static nextPhase(room: Room): RoundResult | null {
    return nextPhase(room);
  }

  static closeTheGame(room: Room): void {
    return closeTheGame(room);
  }

  static handleCheckCall(room: Room, playerName: string): HandleActionResult | null {
    return handleCheckCall(room, playerName);
  }

  static handleFold(room: Room, playerName: string): HandleActionResult | null {
    return handleFold(room, playerName);
  }

  static handleRaise(room: Room, playerName: string, amount: number): HandleActionResult | null {
    return handleRaise(room, playerName, amount);
  }

  static handleContinue(room: Room): RoundResult | null {
    return handleContinue(room);
  }
}

export function chipsTransfer(room: Room, player: Player, amount: number): RoundResult | null {
  if (amount < player.chips) {
    player.chips -= amount;
    player.settedChips += amount;
    return null;
  }

  player.settedChips += player.chips;
  player.chips = 0;
  return goAllin(room, player);
}

export function checkPlayer(room: Room, player: Player): void {
  player.checked = true;
}

export function killCheckedStatus(room: Room): void {
  room.members.forEach((p) => {
    p.checked = false;
  });
}

export function quitTurnOrder(room: Room): RoundResult | null {
  room.turnOrder.splice(room.currentTurnIndex, 1);

  if (room.turnOrder.length === 1) {
    const lastPlayer = room.members.find((m) => m.name === room.turnOrder[0]);
    if (lastPlayer?.checked) {
      return winnerOfTheRound(room);
    }

    const hasAllInPlayer = room.members.some((p) => p.allIn);
    if (!hasAllInPlayer) {
      return winnerOfTheRound(room);
    }
  }

  if (room.turnOrder.length === 0) {
    return winnerOfTheRound(room);
  }

  if (room.currentTurnIndex >= room.turnOrder.length) {
    room.currentTurnIndex = 0;
  }

  return null;
}

export function goAllin(room: Room, player: Player): RoundResult | null {
  player.allIn = true;
  return quitTurnOrder(room);
}

export function nextTurn(room: Room, turnSteps: number): RoundResult | null {
  if (turnSteps) {
    room.currentTurnIndex = (room.currentTurnIndex + turnSteps) % room.turnOrder.length;
  }

  if (
    room.turnOrder.every((playerName) => {
      const player = room.members.find((p) => p.name === playerName);
      return player?.checked ?? false;
    })
  ) {
    return nextPhase(room);
  }

  return null;
}

export function winnerOfTheRound(room: Room): RoundResult {
  let winnerName: string;
  const allInPlayers = room.members.filter((p) => p.allIn);

  allInPlayers.forEach((p) => {
    if (!room.turnOrder.includes(p.name)) {
      room.turnOrder.push(p.name);
    }
  });

  const playerHandTypes: Record<string, string> = {};
  const hasAllCards = room.cards.length === 5;

  if (room.turnOrder.length === 1) {
    winnerName = room.turnOrder[0]!;
  } else {
    let highestScore = -1;
    winnerName = room.turnOrder[0]!;

    room.turnOrder.forEach((playerName) => {
      const player = room.members.find((p) => p.name === playerName);
      if (!player) return;

      const result = evaluateHighestCard(room.cards, player.cards);
      player.score = result.score;

      if (hasAllCards && result.handType) {
        playerHandTypes[playerName] = result.handType as string;
      }

      if (result.score > highestScore) {
        highestScore = result.score;
        winnerName = player.name;
      }
    });
  }

  const totalPot = room.members.reduce((sum, p) => sum + p.settedChips, 0);
  const winner = room.members.find((p) => p.name === winnerName);
  if (winner) {
    winner.chips += totalPot;
  }

  const playerHands = room.members.map((p) => ({
    name: p.name,
    cards: p.cards,
    handType: playerHandTypes[p.name] ?? null,
    chips: p.chips,
  }));

  return { winnerName, totalPot, playerHands };
}

export function nextPhase(room: Room): RoundResult | null {
  room.phase += 1;
  killCheckedStatus(room);

  switch (room.phase) {
    case 1: {
      const player1 = room.members.find((m) => m.name === room.turnOrder[room.currentTurnIndex]);
      if (player1) {
        const result = chipsTransfer(room, player1, 10);
        if (result) {
          return result;
        }
      }

      const nextAfterPlayer1 = nextTurn(room, 1);
      if (nextAfterPlayer1) {
        return nextAfterPlayer1;
      }

      const player2 = room.members.find((m) => m.name === room.turnOrder[room.currentTurnIndex]);
      if (player2) {
        const result = chipsTransfer(room, player2, 20);
        if (result) {
          return result;
        }
        checkPlayer(room, player2);
      }

      return nextTurn(room, 1);
    }

    case 2:
      room.cards[0] = room.deck.drawOneCard() ?? [];
      room.cards[1] = room.deck.drawOneCard() ?? [];
      room.cards[2] = room.deck.drawOneCard() ?? [];
      break;

    case 3:
      room.cards[3] = room.deck.drawOneCard() ?? [];
      break;

    case 4:
      room.cards[4] = room.deck.drawOneCard() ?? [];
      break;

    case 5:
      return winnerOfTheRound(room);

    default:
      console.log("⚠️ Unbekannte Phase:", room.phase);
  }

  return null;
}

export function closeTheGame(room: Room): void {
  room.locked = false;
}

export interface HandleActionResult {
  playerName: string;
  action: string;
  amount: number;
  roundResult: RoundResult | null;
}

export function handleCheckCall(room: Room, playerName: string): HandleActionResult | null {
  const member = room.members.find((m) => m.name === playerName);
  if (!member) return null;

  const maxSettedChips = Math.max(...room.members.map((m) => m.settedChips));
  const currentPlayerBet = member.settedChips;
  const amountToCall = maxSettedChips - currentPlayerBet;

  let roundResult: RoundResult | null = null;
  if (amountToCall > 0) {
    roundResult = chipsTransfer(room, member, amountToCall);
  }

  checkPlayer(room, member);

  const nextResult = nextTurn(room, 1);
  if (nextResult) {
    roundResult = nextResult;
  }

  return {
    playerName,
    action: "call",
    amount: amountToCall,
    roundResult,
  };
}

export function handleFold(room: Room, playerName: string): HandleActionResult | null {
  const roundResult = quitTurnOrder(room);

  let nextResult = null;
  if (!roundResult) {
    nextResult = nextTurn(room, 0);
  }

  return {
    playerName,
    action: "fold",
    amount: 0,
    roundResult: roundResult || nextResult,
  };
}

export function handleRaise(room: Room, playerName: string, amount: number): HandleActionResult | null {
  const member = room.members.find((m) => m.name === playerName);
  if (!member) return null;

  let roundResult = chipsTransfer(room, member, amount);
  killCheckedStatus(room);
  checkPlayer(room, member);

  const nextResult = nextTurn(room, 1);
  if (nextResult) {
    roundResult = nextResult;
  }

  return {
    playerName,
    action: "raise",
    amount,
    roundResult,
  };
}

export function handleContinue(room: Room): RoundResult | null {
  return PokerGame.startNewRound(room);
}