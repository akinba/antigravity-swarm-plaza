# Antigravity Swarm Plaza 🏢🎮

> Google Antigravity projelerindeki otonom ajanları bir plazanın katlarındaki gerçek ofis çalışanları gibi gösteren 2.5B retro izometrik oyunlaştırılmış gösterge paneli.
>
> *A 2.5D retro isometric gamified dashboard that visualizes Google Antigravity autonomous agents as living office workers across multi-tenant skyscraper floors.*

---

## 🇹🇷 Türkçe Dokümantasyon

### 🌟 Özellikler

- **🏢 Plaza Kulesi & Asansör Kat Geçişi:**
  - Her Antigravity projesi gökdelende bağımsız bir şirket katı olarak temsil edilir (`K0` Giriş Lobisi, `K1..KN` Projeler ve Çatı Katı Demo Penthouse).
  - Tüm mimari planlarda sabit sol duvar asansör girişi (`gx: 0, gy: 6..7`), yaklaşan ajanlara otomatik açılan fırçalanmış çelik sürgülü kapılar ve yumuşak iniş/çıkış animasyonları.
- **📐 5 Mimari Ofis Planı & 5 Masa Stili (`🎲 DÜZEN`):**
  - Ahşap ve cam bölme duvarlarla ayrılmış gerçekçi oda yerleşimleri (Yönetici Ofisi, Yazılım & QA Odası, Toplantı Odası, Sunucu Odası ve Dinlenme Salonu).
  - 5 farklı masa ergonomisi: `clover_desk` (4'lü yonca pod), `single_desk` (bağımsız masalar), `bench_desk` (uzun startup sırası), `u_pod_desk` (U biçimli takım adası), `twin_desk` (çiftli çalışma masası).
  - 5 tema paleti ile toplam 25 benzersiz düzen kombinasyonu.
- **☕ Canlı Ajan Yaşam Döngüsü (%100 Kameraya Dönük Pozlar):**
  - **Masada Seated Coding:** Ergonomik tekerlekli sandalyede, alçak masa ve yan monitörlerle klavyede yazma, havada süzülen kod glifleri (`</>`, `{}`).
  - **Toplantı Odası (War Room):** Aktif konuşan ajan elinde lazer çubukla sunum ekranında mimari akışları sunar (`presenting`), dinleyiciler konferans sandalyelerinde oturur (`meeting`).
  - **Koltukta Dinlenme & 2 Kişilik Konsol Oyunu:** Bekleyen ajanlar kanepede dinlenir (`lounging`), ikili eşleşerek retro TV'de konsol dövüş/yarış oyunu oynar (`gaming`).
  - **Ofis Evcil Hayvanları:** Akvaryum (yüzen pikseller), tekir kedi, smokin kedi, robot süpürge (`robo_vac`) ve ofis köpeği (`office_dog`).
  - **Mesai Bitti / Eve Gidiş:** `8` dakika boyunca pasif kalan ajanlar asansöre yönelir (`going_home`), `9.5` dakika sonra asansöre binerek mesaiyi tamamlar (`offDutyCount`).
- **⚡ Rastgele Ofis Olayları (`⚡ OLAY` & 65s Otomatik Döngü):**
  - `PIZZA_PARTY` (masada sıcak pizza kutusu ve dilim kapma), `WATERCOOLER_GOSSIP` (su sebili başı dedikodusu), `SPRINT_CELEBRATION` (renkli piksel konfeti yağmuru), `MASCOT_ZOOMIES` (maskot turbo hızda koşar), `COFFEE_BREW` (taze espresso molası).
  - *Gerçek İş Bütünlüğü:* Aktif çalışan ajanlar (`working`) asla masalarından veya görevlerinden koparılmaz.
- **🛡️ %100 Salt-Okunur (Read-Only) Güvenli Mimari:**
  - `~/.gemini/antigravity` dizinindeki hiçbir dosya veya oturum kesinlikle değiştirilmez, kilitlenmez veya silinmez.
  - SQLite veritabanı (`conversation_summaries.db`) salt-okunur URI (`?mode=ro`) ile açılır (Node.js `>= 22.5` yerleşik `node:sqlite`).
  - Veri bulunmadığında veya keşif amacıyla tek tıkla etkileşimli Demo Modu devreye alınabilir.
- **🎨 Retro Atmosfer & Ses Efektleri:**
  - Türkçe / İngilizce anında dil değiştirici (`TR | EN`).
  - Dinamik Gece / Gündüz gökyüzü ve aydınlatması.
  - Web Audio API ile sıfır harici bağımlılıklı 8-bit retro ses efektleri (asansör çanı, seçim bip'i, pano bildirimi, olay jingle'ı, oyun kumandası bip'i).

---

### 🚀 Gereksinimler & Hızlı Başlangıç

#### Gereksinimler
- **Node.js `>= 22.5.0`** (Yerleşik `node:sqlite` desteği gereklidir, harici SQLite derleyicisi gerekmez).
- **npm `>= 10`**

#### Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükleyin
npm install

# İstemciyi derleyin
npm run build

# Üretim sunucusunu başlatın (Express + Dahili Vite İstemcisi)
npm start
```
Tarayıcınızda açın: **`http://localhost:3210`**

#### Geliştirici Modu (Hot Reload)

```bash
# Sunucu ve Vite istemcisini eşzamanlı çalıştırır
npm run dev
```

#### Testler ve Tip Kontrolü

```bash
# TypeScript tip kontrolü
npm run typecheck

# Sunucu ve entegrasyon testleri (Node Test Runner)
npm test
```

---

### ⚙️ Ortam Değişkenleri

Sunucu yapılandırması `src/server/config.ts` üzerinden aşağıdaki değişkenlerle özelleştirilebilir:

| Değişken | Varsayılan | Açıklama |
| :--- | :--- | :--- |
| `PORT` | `3210` | Web sunucusu ve WebSocket portu |
| `AGY_DATA_DIR` | `~/.gemini/antigravity` | Antigravity ana veri dizini (Salt-okunur taranır) |
| `AGY_WORKSPACE` | `process.cwd()` | Etkin proje katını belirlemek için çalışma dizini |
| `AGY_GO_HOME_MINUTES` | `8` | Ajanların asansörle mesaiyi bitirme eşik süresi (dakika) |

---

## 🇬🇧 English Documentation

### 🌟 Overview

**Antigravity Swarm Plaza** is a standalone, 2.5D retro pixel-art isometric dashboard that visualizes autonomous AI agents in Google Antigravity as living, breathing office workers inside a multi-story skyscraper.

- **Skyscraper & Elevator Navigation:** Every Antigravity project maps to its own company floor with an authentic steel elevator foyer (`gx: 0, gy: 6..7`) and animated sliding doors.
- **5 Architectural Blueprints & Desk Styles:** Real partitioned layouts with Clover Pods, Single Desks, Startup Benches, U-Pods, and Twin Desks.
- **Living Agent Lifecycle (100% Camera-Facing):** Seated keyboard typing with code glyphs, War Room whiteboard & presentation screen with pointer stick, sofa lounging, 2-player paired console gaming, office pets, and realistic go-home lifecycles after inactivity.
- **Random Office Events:** Pizza parties, watercooler chats, sprint celebrations with confetti, and mascot zoomies—without disrupting active coders.
- **100% Read-Only Safety:** Strictly inspects `~/.gemini/antigravity` with read-only SQLite (`?mode=ro`) and file streams. Never mutates, locks, or alters user data.
- **Bilingual TR/EN, Day/Night Atmosphere & 8-bit Chiptune SFX.**

### ⚡ Quick Start

```bash
# 1. Install dependencies (Node.js >= 22.5 required)
npm install

# 2. Build client bundle
npm run build

# 3. Start the standalone server
npm start
```
Open **`http://localhost:3210`** in your browser.

```bash
# Development mode with hot-reloading
npm run dev

# Run automated tests & typecheck
npm test
npm run typecheck
```

---

### 📄 License

MIT. Created for the Google Antigravity Multi-Agent Ecosystem.
