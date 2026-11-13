# Antigravity Swarm Plaza 🏢🎮

[![CI](https://github.com/akinba/antigravity-swarm-plaza/actions/workflows/ci.yml/badge.svg)](https://github.com/akinba/antigravity-swarm-plaza/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akinba/antigravity-swarm-plaza?include_prereleases)](https://github.com/akinba/antigravity-swarm-plaza/releases)

> Google Antigravity projelerindeki otonom ajanları bir plazanın katlarındaki gerçek ofis çalışanları gibi gösteren 2.5B retro izometrik oyunlaştırılmış gösterge paneli ve yerleşik IDE Yan Panel (Auxiliary Pane) eklentisi.
>
> *A 2.5D retro isometric gamified dashboard and native IDE Auxiliary Pane sidecar extension that visualizes Google Antigravity autonomous agents as living office workers across skyscraper floors.*

---

## 📸 Görsel Vitrin / Visual Showcase Gallery

| 🏢 Ana 2.5B İzometrik Ofis (Gündüz) / Main Office | 📱 IDE Yan Panel Kompakt Görünüm / Sidecar Compact | 🌙 Alternatif Kat Planı & Gece Teması / Night Mode |
| :---: | :---: | :---: |
| ![Main 2.5D Office](docs/screenshots/office-main.png) | ![Sidecar Compact](docs/screenshots/sidecar-compact.png) | ![Night Mode & Pizza Party](docs/screenshots/office-night-blueprint.png) |
| *Yönetici masası, çalışma öbekleri, asansör girişi ve evcil hayvanlar* | *< 760px Aux Pane kompakt araç çubuğu, asansör çekmecesi ve %100 ofis* | *Merkez Toplantı Adası, Gece modu aydınlatması ve Kat Pizza Partisi* |

| 🏙️ Plaza Kulesi Dış Görünüm / Plaza Tower Exterior | 🕸️ Swarm Panosu & `@mention` Ağı / Swarm Graph | 📊 60 Dakikalık Analitik & Telemetri / Analytics |
| :---: | :---: | :---: |
| ![Plaza Tower](docs/screenshots/plaza-tower.png) | ![Swarm Board Graph](docs/screenshots/swarm-board-graph.png) | ![Analytics Modal](docs/screenshots/analytics-modal.png) |
| *Şirket katları, aktif pencereler ve animasyonlu cam asansör* | *Canlı mesaj akışı ve yönlü `@mention` etkileşim ağı grafiği* | *60 dakikalık aktivite çubukları, görev tamamlama ve model dağılımı* |

---

## 🏛️ Mimari / Architecture

```mermaid
flowchart LR
  subgraph AGY["Google Antigravity (~/.gemini/antigravity)"]
    DB["conversation_summaries.db\n(?mode=ro)"]
    LOGS["logs/transcript.jsonl\n(Read-Only Stream)"]
    SWARM["swarm/board.jsonl\n(Multi-Agent Board)"]
  end

  subgraph CORE["Swarm Plaza Core Engine"]
    SCANNER["Read-Only DB & Brain Scanner"]
    GAME["Gamification & Zone Logic\n(XP, Model Outfits, Events, Go-Home)"]
    API["Express & WebSocket Server\n(127.0.0.1 Loopback)"]
  end

  subgraph CLIENT["Presentation Modes"]
    SIDECAR["Antigravity Auxiliary Side Pane\n(plugin:// Sidecar Extension)"]
    WEB["Standalone Browser\n(http://localhost:3210)"]
  end

  DB --> SCANNER
  LOGS --> SCANNER
  SWARM --> SCANNER
  SCANNER --> GAME
  GAME --> API
  API -->|"/preload.js + Token Rewrite"| SIDECAR
  API -->|"WebSocket /ws + Static Assets"| WEB
```

---

## 🇹🇷 Türkçe Dokümantasyon

### 🌟 Temel Yetenekler & Yenilikler (v1.2.0)

- **🧩 Yerleşik Antigravity Yan Panel Eklentisi (Sidecar Extension):**
  - Eklenti olarak kurulduğunda Antigravity IDE içindeki **Auxiliary Side Pane**'de tek tıkla (`sidecar://antigravity-swarm-plaza/swarm_plaza/`) açılır.
  - Antigravity tarafından atanan dinamik port (`ANTIGRAVITY_SIDECAR_WEB_PORT`) ve loopback güvenlik doğrulaması (`127.0.0.1` + `X-Sidecar-Token`) ile çalışır.
  - Electron `plugin://` protokolü altında beyaz ekran oluşmasını önleyen otomatik asset token yeniden yazımı (`rewriteHtmlWithSidecarToken`), `/preload.js` köprüsü ve 1500ms akıllı HTTP yoklama (polling) modu içerir.
  - **Kompakt Yan Panel Arayüzü (`< 760px`):** Genişlik daraldığında kat paneli kayar çekmeceye (`ASANSÖR ▾`) dönüşür, araç çubuğu `⋯` menüsüne toplanır ve ofis sahnesi tam genişlikte net kalır.
- **🏢 Plaza Kulesi & Sabit Asansör Girişi:**
  - Her Antigravity projesi gökdelende bağımsız bir şirket katıdır (`K0` Lobi, `K1..KN` Projeler ve Çatı Katı Demo Penthouse).
  - Tüm mimari planlarda sol duvarda sabit asansör girişi (`gx: 0, gy: 6..7`), yaklaşan ajanlara otomatik açılan fırçalanmış çelik sürgülü kapılar ve yumuşak iniş/çıkış animasyonları.
- **👔 BOSS & 8 Modele Özel Kıyafet / Renk Paleti:**
  - Koordinatör ajanlar tüm arayüzde **★ BOSS** olarak gösterilir ve yönetici masasında altın taçla yer alır.
  - 8 farklı model ailesi kendine özgü kıyafet, aksesuar ve renk paletine sahiptir: `argon` (Mor ceket + taç), `hydrogen` (Turkuaz hoodie + kulaklık), `flash` (Zümrüt/Sarı yarış ceketi + vizör), `carbon` (Kırmızı/Beyaz önlük + siber gözlük), `pro` (Lacivert/Altın takım + kravat), `claude` (Kiremit örgü kazak + bere), `gpt` (Petrol balıkçı yaka + kulaklık), `other` (İndigo polo + yaka kartı).
- **📐 5 Mimari Ofis Planı, 5 Masa Stili & Ofis Evcil Hayvanları:**
  - Ahşap ve cam bölme duvarlarla ayrılmış gerçekçi oda yerleşimleri (Yönetici Ofisi, Yazılım & QA Odası, Toplantı Odası, Sunucu Odası ve Dinlenme Salonu).
  - %100 kameraya dönük (`SE` / `SW`) oturma pozları, alçak masa tablaları (`10px`) ve köşe monitörler sayesinde ajanların yüzleri ve ifadeleri daima görünür kalır.
  - 5 tema paleti ile toplam 25 benzersiz düzen kombinasyonu (`🎲 DÜZEN`).
- **☕ Canlı Ajan Yaşam Döngüsü & Mesai Bitişi (`AGY_GO_HOME_MINUTES`):**
  - **Masada Seated Coding:** Ergonomik tekerlekli sandalyede klavyede yazma, havada süzülen kod glifleri (`</>`, `{}`).
  - **Toplantı Odası (War Room):** Aktif konuşan ajan elinde lazer çubukla sunum ekranında mimari akışları sunar (`presenting`), dinleyiciler konferans sandalyelerinde oturur (`meeting`).
  - **Koltukta Dinlenme & 2 Kişilik Konsol Oyunu:** Bekleyen ajanlar kanepede dinlenir (`lounging`), ikili eşleşerek retro TV'de konsol dövüş/yarış oyunu oynar (`gaming`).
  - **Eve Gidiş:** `8` dakika boyunca pasif kalan ajanlar asansöre yönelir (`going_home`), `9.5` dakika sonra asansöre binerek mesaiyi tamamlar (`offDutyCount`).
- **⚡ Rastgele Ofis Olayları (`⚡ OLAY` & 65s Otomatik Döngü):**
  - `PIZZA_PARTY` (masada sıcak pizza kutusu ve dilim kapma), `WATERCOOLER_GOSSIP` (su sebili başı dedikodusu), `SPRINT_CELEBRATION` (renkli piksel konfeti yağmuru), `MASCOT_ZOOMIES` (maskot turbo hızda koşar), `COFFEE_BREW` (taze espresso molası).
  - *Gerçek İş Bütünlüğü:* Aktif çalışan ajanlar (`working`) asla masalarından veya görevlerinden koparılmaz.
- **📡 Canlı Swarm Board, `@mention` Grafiği & 60dk Analitik:**
  - `brain/<id>/.system_generated/swarm/` verisinden canlı mesaj akışı, yönlü `@mention` etkileşim grafiği (`WhiteboardModal`) ve ofis içinde ajanlar arası kavisli piksel sinyal animasyonu.
  - Son 60 dakikalık aktivite zaman çizelgesi (5 dakikalık 12 dilim), tamamlanan görev sayıları ve model dağılımı (`AnalyticsModal`).
- **🛡️ %100 Salt-Okunur (Read-Only) Güvenli Mimari:**
  - `~/.gemini/antigravity` dizinindeki hiçbir dosya veya oturum değiştirilmez, silinmez veya kilitlenmez. SQLite salt-okunur (`?mode=ro`) açılır.

---

### 📐 Mimari Planlar & Evcil Hayvan Tablosu

| Plan No | Mimari Plan Adı | Masa Stili | Bölme Duvarlar | Ofis Evcil Hayvanı & Donanımı |
| :--- | :--- | :--- | :--- | :--- |
| **0** | **Klasik Köşe Stüdyo** | `clover_desk` (4'lü Yonca Pod) | Cam Bölmeler | Akvaryum (Yüzen balıklar & kabarcıklar) |
| **1** | **Merkez Toplantı Adası** | `single_desk` (Bağımsız Masalar) | Ahşap Bölmeler | Tekir Kedi (`tabby_cat`) & Rahat Minderler |
| **2** | **Açık L-Plan Lab** | `bench_desk` (Startup Sıra Masa) | Karma Bölmeler | Robot Süpürge (`robo_vac`) & Masa Tenisi |
| **3** | **Çift Kanat Kurumsal** | `u_pod_desk` (U Takım Adası) | Ofis Cam Bölmeleri | Ofis Köpeği (`office_dog` - Corgi) |
| **4** | **Yaratıcı Loft** | `twin_desk` (İkili Çalışma Masası) | Tuğla & Ahşap | Smokin Kedi (`tuxedo_cat`), Bonsai & Akvaryum |

---

### ⚡ Tek Komutla Çalıştırma (`npx`)

Kurulum veya derleme yapmadan doğrudan çalıştırın (Node.js `>= 22.5.0` gerekir):

```bash
npx antigravity-swarm-plaza
```

#### Komut Satırı Bayrakları (CLI Flags)

| Bayrak | Kısa | Açıklama |
| :--- | :--- | :--- |
| `--demo` | `-d` | Demo modu açık başlatır (örnek 5 model ajanı ve simüle swarm trafiği) |
| `--port <n>` | `-p <n>` | Özel HTTP/WS portu belirler (varsayılan: `3210` veya `$PORT`) |
| `--no-open` | | Tarayıcıyı başlangıçta otomatik açmaz |
| `--workspace <yol>` | `-w <yol>` | Belirli bir çalışma alanı dizinini aktif kat olarak öne çıkarır |
| `--install-plugin` | | Eklentiyi `~/.gemini/config/plugins/antigravity-swarm-plaza` dizinine kurar |
| `--help` | `-h` | Komut satırı yardımını gösterir |
| `--version` | `-v` | Sürüm numarasını yazdırır |

---

### 🧩 Antigravity Eklenti Kurulumu (IDE Sidecar)

Dashboard'u doğrudan Google Antigravity içinden bir Auxiliary Pane yan panel eklentisi ve skill olarak kullanmak için:

```bash
npx antigravity-swarm-plaza --install-plugin
```

Kurulum sonrasında Antigravity sohbetinde şu komutla paneli anında açabilirsiniz:
- `[Swarm Plaza](sidecar://antigravity-swarm-plaza/swarm_plaza/)`

---

### 🚀 Kaynaktan Geliştirme ve Test

```bash
# Depoyu klonlayın
git clone https://github.com/akinba/antigravity-swarm-plaza.git
cd antigravity-swarm-plaza

# Bağımlılıkları yükleyin
npm install

# Testleri çalıştırın (47 test / 21 test paketi)
npm test

# TypeScript tip kontrolü
npm run typecheck

# İstemci, sunucu ve sidecar paketini derleyin
npm run build

# Yerel sunucuyu başlatın
npm start
```

---

### ⚙️ Ortam Değişkenleri (Environment Variables)

| Değişken | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `PORT` | `3210` | Standalone web sunucusu ve WebSocket portu |
| `ANTIGRAVITY_SIDECAR_WEB_PORT` | | Antigravity tarafından yan panel için dinamik atanan port (önceliklidir) |
| `HOST` | `127.0.0.1` | Güvenlik amacıyla yalnızca yerel ağ döngüsüne (loopback) bağlanır |
| `AGY_DATA_DIR` | `~/.gemini/antigravity` | Antigravity ana veri dizini (Salt-okunur taranır) |
| `AGY_WORKSPACE` | `process.cwd()` | Etkin proje katını belirlemek için çalışma dizini |
| `AGY_GO_HOME_MINUTES` | `8` | Ajanların asansörle mesaiyi bitirme eşik süresi (dakika) |

---

## 🇬🇧 English Documentation

### 🌟 Overview & What's New (v1.2.0)

**Antigravity Swarm Plaza** is a standalone, 2.5D retro pixel-art isometric office dashboard and native IDE Auxiliary Pane sidecar extension for visualizing Google Antigravity autonomous multi-agent systems in real time.

- **Embedded Auxiliary Side Pane Extension:** Runs natively inside the Antigravity IDE via `sidecar://antigravity-swarm-plaza/swarm_plaza/` with automatic dynamic port detection (`ANTIGRAVITY_SIDECAR_WEB_PORT`), `127.0.0.1` loopback security, and Electron `plugin://` asset token rewriting with 1500ms polling fallback.
- **Responsive Compact Mode (`< 760px`):** Auto-adapts to narrow side panels with collapsible elevator drawer (`ASANSÖR ▾`), `⋯` secondary toolbar, and 100% full-width isometric canvas.
- **5 Architectural Blueprints & Desk Styles:** Real partitioned rooms with Clover Pods, Single Desks, Startup Benches, U-Pods, and Twin Desks. 100% camera-facing (`SE`/`SW`) seated typing and whiteboard presentations.
- **Live Agent Lifecycle & Go-Home Timer:** Seated keyboard coding with floating `</>` glyphs, War Room presentations with laser pointer stick, sofa lounging, 2-player paired console gaming, office pets, and realistic go-home lifecycles (`AGY_GO_HOME_MINUTES`).
- **Random Office Events:** Pizza parties, watercooler gossip, sprint confetti celebrations, and mascot zoomies without pulling active coders off their desks.
- **100% Read-Only Safety:** Inspects `~/.gemini/antigravity` via read-only SQLite (`?mode=ro`) and file streams. Never mutates, locks, or alters user data.

---

### ⚡ Quick Start

```bash
# Run instantly with npx (Node.js >= 22.5 required)
npx antigravity-swarm-plaza

# Install into Antigravity as a native sidecar extension
npx antigravity-swarm-plaza --install-plugin
```

Open **`http://localhost:3210`** in your browser, or click `[Swarm Plaza](sidecar://antigravity-swarm-plaza/swarm_plaza/)` inside Antigravity!

```bash
# Run development server with hot reload
npm run dev

# Run full test suite (47 tests / 21 test suites)
npm test

# Run TypeScript typecheck
npm run typecheck

# Build client, server and sidecar bundle
npm run build
```

---

### 📄 License

MIT. Created for the Google Antigravity Multi-Agent Ecosystem.
