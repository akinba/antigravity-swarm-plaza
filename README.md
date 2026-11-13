# Antigravity Swarm Plaza 🏢🎮

[![CI](https://github.com/akinba/antigravity-swarm-plaza/actions/workflows/ci.yml/badge.svg)](https://github.com/akinba/antigravity-swarm-plaza/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akinba/antigravity-swarm-plaza?include_prereleases)](https://github.com/akinba/antigravity-swarm-plaza/releases)

> Google Antigravity projelerindeki otonom ajanları bir plazanın katlarındaki gerçek ofis çalışanları gibi gösteren 2.5B retro izometrik oyunlaştırılmış gösterge paneli.
>
> *A 2.5D retro isometric gamified dashboard that visualizes Google Antigravity autonomous agents as living office workers across multi-tenant skyscraper floors.*

---

## 📸 Ekran Görüntüleri / Screenshots

| 2.5B İzometrik Ofis & BOSS / Model Kıyafetleri | 60 Dakikalık Analitik & Model Dağılımı | Canlı Swarm Board & `@mention` Grafiği |
| :---: | :---: | :---: |
| ![Main 2.5D Office](docs/screenshots/office-main.png) | ![Analytics Modal](docs/screenshots/analytics-modal.png) | ![Swarm Board Graph](docs/screenshots/swarm-board-graph.png) |

---

## 🇹🇷 Türkçe Dokümantasyon

### 🌟 Özellikler

- **🏢 Plaza Kulesi & Asansör Kat Geçişi:**
  - Her Antigravity projesi gökdelende bağımsız bir şirket katı olarak temsil edilir (`K0` Giriş Lobisi, `K1..KN` Projeler ve Çatı Katı Demo Penthouse).
  - Tüm mimari planlarda sabit sol duvar asansör girişi (`gx: 0, gy: 6..7`), yaklaşan ajanlara otomatik açılan fırçalanmış çelik sürgülü kapılar ve yumuşak iniş/çıkış animasyonları.
- **👔 BOSS & 8 Modele Özel Kıyafet / Renk Paleti:**
  - Koordinatör ajanlar tüm arayüzde **★ BOSS** olarak gösterilir ve yönetici masasında altın taçla yer alır.
  - 8 farklı model ailesi kendine özgü kıyafet, aksesuar ve renk paletine sahiptir: `argon` (Mor ceket + taç), `hydrogen` (Turkuaz hoodie + kulaklık), `flash` (Zümrüt/Sarı yarış ceketi + vizör), `carbon` (Kırmızı/Beyaz önlük + siber gözlük), `pro` (Lacivert/Altın takım + kravat), `claude` (Kiremit örgü kazak + bere), `gpt` (Petrol balıkçı yaka + kulaklık), `other` (İndigo polo + yaka kartı).
- **💬 Sadeleştirilmiş Ajan Üstü & Araç Aktivitesi:**
  - İsim etiketleri yalnızca fare üzerine gelindiğinde (hover) veya ajan seçildiğinde görünür; diğer zamanlarda sade bir durum noktası ve aktif araç ikonu (`📖`, `✏️`, `🧪`, `🌐`, `⚠️`) gösterilir.
  - Konuşma balonları sürekli açık kalmaz; yeni mesaj geldiğinde 4.5 saniye görünüp kaybolur (veya hover/seçimde açılır).
- **📡 Canlı Swarm Board, `@mention` Grafiği & Piksel Sinyaller:**
  - `brain/<id>/.system_generated/swarm/` verisinden canlı mesaj akışı, yönlü `@mention` etkileşim grafiği (`WhiteboardModal`) ve ofis içinde ajanlar arası kavisli piksel zarf/sinyal animasyonu.
- **📊 60 Dakikalık Analitik Paneli & Akıllı Bildirimler:**
  - Son 60 dakikalık aktivite zaman çizelgesi (5 dakikalık 12 dilim), tamamlanan görev sayıları ve model dağılımı (`AnalyticsModal`).
  - Hata/takılma durumunda opsiyonel 8-bit uyarı sesi ve tarayıcı bildirimi.
- **🔍 Kamera Takibi (Follow Cam), Zoom/Pan & PNG İndirme:**
  - Fare tekerleği ile yakınlaştırma, sürükleyerek gezme, çift tıkla sıfırlama, seçili ajanı takip eden **Follow Cam** ve tek tıkla kat görüntüsünü PNG olarak indirme.
- **📐 5 Mimari Ofis Planı, 5 Masa Stili & XP Masa Evrimi:**
  - `clover_desk`, `single_desk`, `bench_desk`, `u_pod_desk`, `twin_desk` ile 25 tema-plan kombinasyonu.
  - Ajan XP seviyesi arttıkça masa donanımı evrilir (Lv3+ çift monitör, Lv5+ bitki & kupa, Lv8+ altın klavye & kupa).
- **☕ Canlı Yaşam Döngüsü, Evcil Hayvanlar & Rastgele Olaylar:**
  - Masada kodlama, Toplantı Odası sunumu, kanepede dinlenme, 2 kişilik konsol oyunu, ofis evcil hayvanları, 8–9.5 dk pasiflikte asansörle mesai bitimi ve `PIZZA_PARTY`, `WATERCOOLER_GOSSIP`, `SPRINT_CELEBRATION`, `MASCOT_ZOOMIES`, `COFFEE_BREW` olayları.
- **🛡️ %100 Salt-Okunur (Read-Only) Güvenli Mimari:**
  - `~/.gemini/antigravity` dizinindeki hiçbir dosya veya oturum değiştirilmez; SQLite salt-okunur (`?mode=ro`) açılır.

---

### ⚡ Tek Komutla Çalıştırma (`npx`)

Kurulum veya derleme yapmadan doğrudan çalıştırın (Node.js `>= 22.5.0` gerekir):

```bash
npx antigravity-swarm-plaza
```

| Bayrak / Flag | Açıklama |
| :--- | :--- |
| `--demo` | Demo modu açık başlatır (örnek ajanlar ve canlı swarm mesajlarıyla) |
| `--port <n>` | Özel HTTP/WS portu belirler (varsayılan: `3210`) |
| `--no-open` | Tarayıcıyı otomatik açmaz |
| `--workspace <yol>` | Belirli bir çalışma alanı dizinini öne çıkarır |

### 🧩 Antigravity Eklentisi (Plugin)

Dashboard'u doğrudan Google Antigravity içinden skill olarak başlatmak için eklentiyi tek komutla kurabilirsiniz:

```bash
npx antigravity-swarm-plaza --install-plugin
```

Bu komut eklenti paketini `~/.gemini/config/plugins/antigravity-swarm-plaza/` dizinine kurar (`swarm-plaza` skill'i ile).

---

### 🚀 Kurulum ve Çalıştırma

#### Gereksinimler
- **Node.js `>= 22.5.0`** (Yerleşik `node:sqlite` desteği gereklidir, harici SQLite derleyicisi gerekmez).
- **npm `>= 10`**

#### 1) Kaynaktan Çalıştırma
```bash
git clone https://github.com/akinba/antigravity-swarm-plaza.git
cd antigravity-swarm-plaza
npm install
npm run build
npm start
```
Tarayıcınızda açın: **`http://localhost:3210`**

#### 2) GitHub Release Paketinden Çalıştırma
[Releases](https://github.com/akinba/antigravity-swarm-plaza/releases) sayfasından son `.zip` veya `.tar.gz` arşivini indirip açın:
```bash
npm install --omit=dev
npm start
```

#### Geliştirici Modu & Testler
```bash
npm run dev        # Sunucu + Vite hot-reload
npm run typecheck  # TypeScript tip kontrolü
npm test           # Sunucu ve istemci birim/entegrasyon testleri (37 test)
```

---

## 🇬🇧 English Documentation

### 🌟 Overview

**Antigravity Swarm Plaza** is a standalone, 2.5D retro pixel-art isometric dashboard that visualizes autonomous AI agents in Google Antigravity as living office workers inside a multi-story skyscraper.

- **Skyscraper & Elevator Navigation:** Every Antigravity project maps to its own floor (`K0` Lobby, `K1..KN` Projects, Penthouse Demo) with animated sliding steel elevator doors.
- **★ BOSS & 8 Model-Specific Outfits:** Coordinators appear as **★ BOSS** with a gold crown; `argon`, `hydrogen`, `flash`, `carbon`, `pro`, `claude`, `gpt`, and `other` models each wear distinct uniforms, colors, and accessories.
- **Uncluttered Overhead UI:** Name tags appear on hover/selection, and speech bubbles pop up for 4.5s on new messages (or on hover/selection), leaving only a clean status dot and active tool icon (`reading`, `writing`, `testing`, `searching`, `error`).
- **Live Swarm Board & `@mention` Graph:** Read-only swarm board feed, SVG `@mention` network graph, and arcing pixel envelope signals across the office floor.
- **60-Min Analytics, Follow Cam & PNG Export:** 60-minute activity timeline, model breakdown charts, wheel zoom/drag pan, Follow Cam, 8-bit/browser alert notifications, XP-based desk evolution, and one-click PNG snapshot download.
- **100% Read-Only Safety:** Strictly inspects `~/.gemini/antigravity` with read-only SQLite (`?mode=ro`) and file streams. Never mutates user data.

### ⚡ Quick Run (`npx`)

Run immediately without cloning or building (requires Node.js `>= 22.5.0`):

```bash
npx antigravity-swarm-plaza
```

| Flag | Description |
| :--- | :--- |
| `--demo` | Start with Demo Mode enabled (sample agents & live swarm feed) |
| `--port <n>` | Specify a custom HTTP/WS port (default: `3210`) |
| `--no-open` | Do not automatically open the browser |
| `--workspace <path>` | Highlight a specific workspace directory |

### 🧩 Antigravity Plugin

Install the bundled Antigravity plugin (`swarm-plaza` skill) with one command:

```bash
npx antigravity-swarm-plaza --install-plugin
```

This installs the plugin into `~/.gemini/config/plugins/antigravity-swarm-plaza/`.

### 🚀 Quick Start (From Source)

```bash
# Requires Node.js >= 22.5.0
git clone https://github.com/akinba/antigravity-swarm-plaza.git
cd antigravity-swarm-plaza
npm install
npm run build
npm start
```
Open **`http://localhost:3210`** in your browser (or download a prebuilt archive from [Releases](https://github.com/akinba/antigravity-swarm-plaza/releases)).

```bash
npm run dev        # Development mode (hot reload)
npm run typecheck  # TypeScript check
npm test           # Run all server & client tests
```

---

### 📄 License

MIT. Created for the Google Antigravity Multi-Agent Ecosystem.
