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

// TODO: Evaluate the highest card from community and player cards
export function evaluateHighestCard(communityCards: number[][], playerCards: number[][]) {
    if(communityCards.length != 5 || playerCards.length != 2)
        return {"success": false, "massage": "Es wurde nicht die richtige Anzahl an Karten übergeben."}

    const allCards = communityCards.concat(playerCards);
}