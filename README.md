# ♠️ PokerGX

**PokerGX** is a modern multiplayer Texas Hold’em poker platform built with the **T3 Stack**.  
It combines a type-safe full-stack architecture, authentication, persistent session data, and real-time communication to create an interactive online poker experience.

The project was developed to provide a scalable and maintainable foundation for a browser-based multiplayer poker application.

---

## ⚠️ Early Access

PokerGX is currently in **early development**.

While core features are implemented, the project is not yet feature-complete and may contain bugs or unfinished functionality.

Known limitations include:
- incomplete reconnect handling
- limited mobile support
- potential edge cases in game logic
- ongoing UI/UX improvements
- ...


---

## ✨ Features

- **Multiplayer poker sessions** with real-time game updates
- **Authentication system** using GitHub and Discord login
- **Persistent player and session data** stored in PostgreSQL
- **Lobby and room management** for creating and joining poker sessions
- **Interactive frontend** built with React and Tailwind CSS
- **Type-safe communication** between frontend and backend using tRPC
- **Backend game logic** for handling poker rounds, player states, and actions
- **Poker hand evaluation** for determining the best Texas Hold’em hand
- **Responsive and animated UI elements** for a modern user experience

---

## 🧱 Tech Stack

PokerGX is based on the **T3 Stack** and uses the following technologies:

- **Next.js** – full-stack React framework
- **TypeScript** – type-safe development across the entire project
- **tRPC** – end-to-end type-safe API communication
- **Prisma** – ORM for database access
- **PostgreSQL** – persistent storage for users, sessions, and chips
- **NextAuth.js / Auth.js** – authentication via GitHub and Discord
- **Tailwind CSS** – utility-first styling
- **Socket.IO** – real-time communication between clients and server
- **Three.js** - 3D renderings and animations
- **Framer Motion** – animations and transitions

---

## 🎯 Project Goal

The goal of PokerGX is to build a web-based multiplayer poker platform that combines:

- a modern frontend
- a maintainable backend architecture
- real-time interaction between players
- persistent user and game data
- a clear separation of responsibilities between UI, API, and game logic

The focus lies on creating a solid technical foundation for a complete online poker application.

---

## 🃏 Game Scope

Currently, the project focuses on **Texas Hold’em** core functionality, including:

- player session management
- game room / lobby logic
- turn-based player actions
- card deck handling
- hand ranking and winner determination
- real-time state synchronization

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** >= 18
- **npm** >= 10
- a running **PostgreSQL** database
- OAuth applications for **GitHub** and **Discord**
- a valid `.env` configuration file for development

---

## ⚙️ Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/PokerGX.git
cd PokerGX
