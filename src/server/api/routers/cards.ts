export const CLUBS = 4;
export const SPADES = 3;
export const HEARTS = 2;
export const DIAMONDS = 1;

export const TWO = 2;
export const THREE = 3;
export const FOUR = 4;
export const FIVE = 5;
export const SIX = 6;
export const SEVEN = 7;
export const EIGHT = 8;
export const NINE = 9;
export const TEN = 10;
export const JACK = 11;
export const QUEEN = 12;
export const KING = 13;
export const ACE = 14;

// Card representation: [suit, rank]
export function getCard(suit: number, rank: number): number[] {
    return [suit, rank];
}

export class Deck {
    private cards: number[][] = [];

    // Initialize the deck with 52 cards
    public initializeDeck(): void {
        this.cards = [];
        const suits = [CLUBS, SPADES, HEARTS, DIAMONDS];
        const ranks = [TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, TEN, JACK, QUEEN, KING, ACE];

        for (const suit of suits) {
            for (const rank of ranks) {
                this.cards.push(getCard(suit, rank));
            }
        }

        this.shuffle();
    }

    // Draw one random card from the deck
    public drawOneCard(): number[] | null {
        if (this.cards.length === 0) {
            return null;
        }

        const randomIndex = Math.floor(Math.random() * this.cards.length);
        const card = this.cards[randomIndex]!;
        this.cards.splice(randomIndex, 1);

        return card;
    }

    // Draw two random cards from the deck
    public drawTwoCards(): number[][] | null {
        if (this.cards.length < 2) {
            return null;
        }

        const firstCard = this.drawOneCard();
        const secondCard = this.drawOneCard();

        return firstCard && secondCard ? [firstCard, secondCard] : null;
    }

    // Shuffle the deck (Fisher-Yates algorithm)
    public shuffle(): void {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const randomIndex = Math.floor(Math.random() * (i + 1));
            const temp = this.cards[i]!;
            this.cards[i] = this.cards[randomIndex]!;
            this.cards[randomIndex] = temp;
        }
    }

    // Get the number of remaining cards in the deck
    public getRemainingCards(): number {
        return this.cards.length;
    }

    // Reset the deck to its initial state
    public reset(): void {
        this.initializeDeck();
    }
}

// Hand types
const HIGH_CARD = 0;
const ONE_PAIR = 1;
const TWO_PAIR = 2;
const THREE_OF_A_KIND = 3;
const STRAIGHT = 4;
const FLUSH = 5;
const FULL_HOUSE = 6;
const FOUR_OF_A_KIND = 7;
const STRAIGHT_FLUSH = 8;
const ROYAL_FLUSH = 9;

// Card representation: [suit, rank]
type Card = [number, number];

// Check if a card is in player cards
function isPlayerCard(card: Card, playerCards: Card[]): boolean {
    return playerCards.some(pc => pc[0] === card[0] && pc[1] === card[1]);
}

// Get the 5 flush cards
function getFlushCards(cards: Card[]): Card[] | null {
    const suitCounts = countSuits(cards);
    for (const [suit, count] of suitCounts.entries()) {
        if (count >= 5) {
            const flushCards = cards.filter((card: Card) => card[0] === suit).sort((a: Card, b: Card) => b[1] - a[1]);
            return flushCards.slice(0, 5);
        }
    }
    return null;
}

// Get the 5 straight cards
function getStraightCards(cards: Card[]): Card[] | null {
    const ranks = getRanks(cards).sort((a, b) => a - b);
    const unique = Array.from(new Set(ranks));
    
    // Normal straights
    for (let i = unique.length - 1; i >= 4; i--) {
        if (unique[i]! - unique[i - 4]! === 4) {
            const straightRanks = unique.slice(i - 4, i + 1).reverse();
            const straightCards: Card[] = [];
            for (const rank of straightRanks) {
                const card = cards.find(c => c[1] === rank);
                if (!card) return null;
                straightCards.push(card);
            }
            return straightCards;
        }
    }
    
    // Wheel
    if (unique.includes(14) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) {
        const wheelRanks = [5, 4, 3, 2, 14];
        const straightCards: Card[] = [];
        for (const rank of wheelRanks) {
            const card = cards.find(c => c[1] === rank);
            if (!card) return null;
            straightCards.push(card);
        }
        return straightCards;
    }
    
    return null;
}

// Get four of a kind cards
function getFourOfAKindCards(cards: Card[]): Card[] | null {
    const rankCounts = countRanks(cards);
    for (const [rank, count] of rankCounts.entries()) {
        if (count === 4) {
            const quads = cards.filter((c: Card) => c[1] === rank);
            const kickers = cards.filter((c: Card) => c[1] !== rank).sort((a: Card, b: Card) => b[1] - a[1]);
            if (kickers.length === 0) return null;
            const kicker = kickers[0]!;
            return quads.concat([kicker]);
        }
    }
    return null;
}

// Get full house cards
function getFullHouseCards(cards: Card[]): Card[] | null {
    const rankCounts = countRanks(cards);
    let tripsRank: number | null = null;
    let pairRank: number | null = null;
    for (const [rank, count] of Array.from(rankCounts.entries()).sort((a, b) => b[0] - a[0])) {
        if (count >= 3 && tripsRank === null) tripsRank = rank;
        else if (count >= 2 && pairRank === null) pairRank = rank;
    }
    if (tripsRank !== null && pairRank !== null) {
        const trips = cards.filter((c: Card) => c[1] === tripsRank);
        const pair = cards.filter((c: Card) => c[1] === pairRank).slice(0, 2);
        return trips.concat(pair);
    }
    return null;
}

// Get three of a kind cards
function getThreeOfAKindCards(cards: Card[]): Card[] | null {
    const rankCounts = countRanks(cards);
    for (const [rank, count] of rankCounts.entries()) {
        if (count === 3) {
            const trips = cards.filter((c: Card) => c[1] === rank);
            const kickers = cards.filter((c: Card) => c[1] !== rank).sort((a: Card, b: Card) => b[1] - a[1]).slice(0, 2);
            return trips.concat(kickers);
        }
    }
    return null;
}

// Get two pair cards
function getTwoPairCards(cards: Card[]): Card[] | null {
    const rankCounts = countRanks(cards);
    const pairs: number[] = [];
    for (const [rank, count] of Array.from(rankCounts.entries()).sort((a, b) => b[0] - a[0])) {
        if (count === 2) pairs.push(rank);
    }
    if (pairs.length >= 2) {
        const firstPair = cards.filter((c: Card) => c[1] === pairs[0]);
        const secondPair = cards.filter((c: Card) => c[1] === pairs[1]);
        const kickers = cards.filter((c: Card) => c[1] !== pairs[0] && c[1] !== pairs[1]).sort((a: Card, b: Card) => b[1] - a[1]);
        if (kickers.length === 0) return null;
        const kicker = kickers[0]!;
        return firstPair.concat(secondPair, [kicker]);
    }
    return null;
}

// Get one pair cards
function getOnePairCards(cards: Card[]): Card[] | null {
    const rankCounts = countRanks(cards);
    for (const [rank, count] of rankCounts.entries()) {
        if (count === 2) {
            const pair = cards.filter((c: Card) => c[1] === rank);
            const kickers = cards.filter((c: Card) => c[1] !== rank).sort((a: Card, b: Card) => b[1] - a[1]).slice(0, 3);
            return pair.concat(kickers);
        }
    }
    return null;
}

// Get high card (top 5)
function getHighCardCards(cards: Card[]): Card[] {
    return cards.sort((a: Card, b: Card) => b[1] - a[1]).slice(0, 5);
}

// Build score from hand type and cards
function buildScore(handType: number, cards: Card[], playerCards: Card[]): number {
    const adjustedRanks: number[] = cards.map(card => {
        const rank = card[1];
        return isPlayerCard(card, playerCards) ? rank + 50 : rank;
    });
    // Sort adjusted ranks descending? No, the cards are already sorted by rank descending
    // But for score, we use the order of cards
    let score = handType;
    for (let i = 0; i < 5; i++) {
        score = score * 100 + adjustedRanks[i]!;
    }
    return score;
}

// TODO: Evaluate the highest card from community and player cards
export function evaluateHighestCard(communityCards: number[][], playerCards: number[][]) {
    if (communityCards.length !== 5 || playerCards.length !== 2)
        return { "success": false, "err_message": "Es wurde nicht die richtige Anzahl an Karten übergeben.", "score": -1 };

    const allCards = communityCards.concat(playerCards) as Card[];
    const playerCardsTyped = playerCards as Card[];

    const flushCards = getFlushCards(allCards);
    const straightCards = getStraightCards(allCards);

    if (flushCards) {
        const flushStraight = getStraightCards(flushCards);
        if (flushStraight && flushStraight.length > 0) {
            const high = flushStraight[0]![1];
            if (high === 14) {
                return { "success": true, "handType": "Royal Flush", "score": buildScore(ROYAL_FLUSH, flushStraight, playerCardsTyped) };
            } else {
                return { "success": true, "handType": "Straight Flush", "score": buildScore(STRAIGHT_FLUSH, flushStraight, playerCardsTyped) };
            }
        }
        return { "success": true, "handType": "Flush", "score": buildScore(FLUSH, flushCards, playerCardsTyped) };
    }
    
    if (straightCards) {
        return { "success": true, "handType": "Straight", "score": buildScore(STRAIGHT, straightCards, playerCardsTyped) };
    }

    const pairInfo = getPairInfo(allCards);

    if (pairInfo.quads.length > 0) {
        const quadsCards = getFourOfAKindCards(allCards);
        if (!quadsCards) return { "success": false, "err_message": "Unexpected error in Four of a Kind", "score": -1 };
        return { "success": true, "handType": "Four of a Kind", "score": buildScore(FOUR_OF_A_KIND, quadsCards, playerCardsTyped) };
    }

    if (pairInfo.trips.length > 0 && pairInfo.pairs.length > 0) {
        const fhCards = getFullHouseCards(allCards);
        if (!fhCards) return { "success": false, "err_message": "Unexpected error in Full House", "score": -1 };
        return { "success": true, "handType": "Full House", "score": buildScore(FULL_HOUSE, fhCards, playerCardsTyped) };
    }

    if (pairInfo.trips.length > 0) {
        const tripsCards = getThreeOfAKindCards(allCards);
        if (!tripsCards) return { "success": false, "err_message": "Unexpected error in Three of a Kind", "score": -1 };
        return { "success": true, "handType": "Three of a Kind", "score": buildScore(THREE_OF_A_KIND, tripsCards, playerCardsTyped) };
    }

    if (pairInfo.pairs.length >= 2) {
        const tpCards = getTwoPairCards(allCards);
        if (!tpCards) return { "success": false, "err_message": "Unexpected error in Two Pair", "score": -1 };
        return { "success": true, "handType": "Two Pair", "score": buildScore(TWO_PAIR, tpCards, playerCardsTyped) };
    }

    if (pairInfo.pairs.length > 0) {
        const opCards = getOnePairCards(allCards);
        if (!opCards) return { "success": false, "err_message": "Unexpected error in One Pair", "score": -1 };
        return { "success": true, "handType": "One Pair", "score": buildScore(ONE_PAIR, opCards, playerCardsTyped) };
    }

    const hcCards = getHighCardCards(allCards);
    return { "success": true, "handType": "High Card", "score": buildScore(HIGH_CARD, hcCards, playerCardsTyped) };
}

// Extrahiere nur die Werte (Ranks) aus den Karten
function getRanks(cards: number[][]): number[] {
    return cards.map(card => card[1] as number);
}

// Extrahiere nur die Farben (Suits) aus den Karten
function getSuits(cards: number[][]): number[] {
    return cards.map(card => card[0] as number);
}

// Zähle wie oft jeder Wert vorkommt
function countRanks(cards: number[][]): Map<number, number> {
    const counts = new Map<number, number>();
    for (const card of cards) {
        const rank = card[1] as number;
        counts.set(rank, (counts.get(rank) || 0) + 1);
    }
    return counts;
}

// Zähle wie oft jede Farbe vorkommt
function countSuits(cards: number[][]): Map<number, number> {
    const counts = new Map<number, number>();
    for (const card of cards) {
        const suit = card[0] as number;
        counts.set(suit, (counts.get(suit) || 0) + 1);
    }
    return counts;
}

// Prüfe ob es einen Flush gibt und gebe die höchste Karte zurück
/*
function getFlushHighCard(cards: number[][]): number | null {
    const suitCounts = countSuits(cards);
    
    for (const [suit, count] of suitCounts.entries()) {
        if (count >= 5) {
            // Finde alle Karten mit dieser Farbe und gebe die höchste zurück
            const flushCards = cards
                .filter(card => card[0] === suit)
                .map(card => card[1] as number)
                .sort((a, b) => b - a);
            return flushCards[0] as number;
        }
    }
    
    return null;
}
*/


// Prüfe ob es einen Straight gibt und gebe die höchste Karte zurück
/*
function getStraightHighCard(cards: number[][]): number | null {
    const ranks = getRanks(cards).sort((a, b) => a - b);
    const unique = Array.from(new Set(ranks)) as number[];
    
    // Prüfe normale Straights (von hinten, damit höchste zuerst)
    for (let i = unique.length - 1; i >= 4; i--) {
        if (unique[i]! - unique[i - 4]! === 4) {
            return unique[i]!; // Höchste Karte des Straights
        }
    }
    
    // Prüfe auch Wheel (A-2-3-4-5) - höchste Karte ist 5
    if (unique.includes(14) && unique.includes(2) && unique.includes(3) && 
        unique.includes(4) && unique.includes(5)) {
        return 5; // Wheel ist die niedrigste Straight
    }
    
    return null;
}
*/

// Bekommen alle Paare/Trips/Quads mit ihrer Wertigkeit
function getPairInfo(cards: number[][]): {quads: number[], trips: number[], pairs: number[]} {
    const rankCounts = countRanks(cards);
    const quads: number[] = [];
    const trips: number[] = [];
    const pairs: number[] = [];
    
    // Sortiere nach Wertigkeit (höchste zuerst)
    const sortedRanks = Array.from(rankCounts.entries())
        .sort((a, b) => b[0] - a[0]); // Sortiere nach Rank absteigend
    
    for (const [rank, count] of sortedRanks) {
        if (count === 4) quads.push(rank);
        else if (count === 3) trips.push(rank);
        else if (count === 2) pairs.push(rank);
    }
    
    return { quads, trips, pairs };
}