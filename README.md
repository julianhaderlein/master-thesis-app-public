# Local-First P2P Personal Finance App

> **Master's Thesis Research Prototype**  
> A decentralized, privacy-focused personal finance mobile application featuring encrypted local storage and peer-to-peer synchronization—without central servers, cloud databases, or mandatory user accounts.  
> 📄 **Thesis Publication:** [epub.technikum-wien.at/.../14153404](https://epub.technikum-wien.at/obvftwhsm/content/titleinfo/14153404)

---

## 📌 Overview

This repository contains the prototype and practical artifacts developed as part of a **Master's Thesis** investigating local-first, peer-to-peer (P2P) data synchronization for personal finance management.

📖 **[Read the full Master's Thesis (FH Technikum Wien)](https://epub.technikum-wien.at/obvftwhsm/content/titleinfo/14153404)**

Most personal finance apps require uploading sensitive financial data to centralized cloud providers. This project evaluates an alternative architecture:
- **Zero Central Servers & No Account Registration:** Financial data is owned entirely by the user on their own device.
- **Encrypted Local-First Storage:** Immediate responsiveness and complete offline availability using SQLCipher-encrypted SQLite and Drizzle ORM.
- **Collaborative P2P "Spaces":** Decentralized sharing and synchronization of selected transactions with peers (e.g., shared households, couples, or group trips).
- **Cryptographic Blind Pairing:** Secure member invitations using QR codes and deep links over HyperDHT without leaking identity or data.
- **End-to-End Encrypted Sync:** Peer replication powered by multi-writer append-only logs and the Noise Protocol Framework.

---

## 🏗️ Architecture & Tech Stack

The application employs a **dual-runtime model**, separating UI interactions from background P2P networking:

```
┌─────────────────────────────────┐       IPC (HRPC)       ┌─────────────────────────────────┐
│     React Native (Expo / UI)    │ <────────────────────> │      Bare Runtime (Worklet)     │
│  - Expo Router (SDK 54)         │                        │  - Hyperswarm (DHT discovery)   │
│  - Drizzle ORM + SQLCipher DB   │                        │  - Autobase (P2P multiwriter)   │
│  - Reactive UI & Local State    │                        │  - Blind-Pairing (QR / invites) │
└─────────────────────────────────┘                        └─────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| **Mobile Client** | React Native 0.81, Expo (SDK 54), Expo Router, TypeScript |
| **Local Database** | Encrypted SQLite (`expo-sqlite` with SQLCipher), Drizzle ORM |
| **P2P Networking** | [Holepunch](https://holepunch.to/) ecosystem via `react-native-bare-kit` (Hyperswarm, HyperDHT, UDX) |
| **Sync & Consensus** | [Autobase](https://github.com/holepunchto/autobase) (event-sourced multiwriter data structures), [Hyperdispatch](https://github.com/holepunchto/hyperdispatch) |
| **Pairing & Discovery** | [Blind-Pairing](https://github.com/holepunchto/blind-pairing) (secure key exchange via HyperDHT & QR codes) |
| **IPC Bridge** | HRPC (schema-driven typed RPC) connecting the React Native thread to the Bare worklet |

---

## 📁 Repository Structure

- [`application/`](./application) — Complete mobile application source code (UI screens, Drizzle schemas, migrations, and the background Bare P2P backend).
- [`security-analysis/`](./security-analysis) — Verification scripts demonstrating traffic analysis and decryption across the protocol stack (UDX → Secret-Stream / Noise XX → Autobase Oplog), as well as at-rest encryption checks.
- [`resources/`](./resources) — Thesis research materials, technology stack evaluations, requirements analysis, and comparison matrices.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- Android Studio or Xcode configured for Expo native development builds (`expo-dev-client` / Bare runtime; Expo Go is not supported due to native Bare C/C++ bindings)

### Installation & Run

1. **Install dependencies:**
   ```bash
   cd application
   npm install
   ```

2. **Generate RPC schemas and pack the Bare background bundle:**
   ```bash
   npm run build-schema
   npm run pack:backend
   ```

3. **Start the application on a connected device or emulator:**
   ```bash
   npm run android
   # or
   npm run ios
   ```

---

## 🔬 Security Analysis

As part of the thesis evaluation, the repository includes tooling to inspect and verify cryptographic guarantees:
- **At-Rest Verification:** Verifying SQLCipher and Autobase block encryption in device backups.
- **In-Transit Traffic Analysis:** Inspecting and decrypting captured UDP packets layer-by-layer using session keys.
- For more information and reproduction steps, see [`security-analysis/description.md`](./security-analysis/description.md) and [`security-analysis/EXPLANATION.md`](./security-analysis/EXPLANATION.md).

---

## ⚖️ Academic Context & Disclaimer

This project is an **academic research prototype** developed for experimental evaluation and demonstration purposes as part of a Master's Thesis at FH Technikum Wien ([publication link](https://epub.technikum-wien.at/obvftwhsm/content/titleinfo/14153404)). It is not intended as a commercial financial application.
