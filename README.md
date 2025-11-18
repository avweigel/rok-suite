# 🏰 Rise of Kingdoms Strategy Suite

A modular toolkit for **Rise of Kingdoms** data analysis and planning.  
Includes tools for map optimization, battle simulations, and GPT-assisted translation and planning.

---

## 📁 Repository Structure

| Path | Description |
|------|--------------|
| `apps/web` | Web dashboard for maps, simulations, and planning |
| `apps/api` | REST API exposing GPT and simulation endpoints |
| `adapters/discord-js` | Discord bot adapter (JavaScript) |
| `adapters/discord-py` | Discord bot adapter (Python) |
| `packages/sim-engine` | Deterministic battle and rally simulator |
| `packages/map-optimizer` | Map and flag placement optimizer |
| `packages/vision` | Image and OCR utilities |
| `packages/shared-schema` | Shared JSON schemas |
| `packages/shared-data` | Shared commander, gear, and map data |

---

## 🎯 Goals

- Keep components independent but interoperable  
- Use shared schemas and data for consistency  
- Support reproducible simulations and map results  
- Provide clear, documented APIs

---

## ⚙️ Setup

Clone and initialize the repository:

```bash
git clone https://github.com/avweigel/rok-suite.git
cd rok-suite
git lfs install
pnpm install
