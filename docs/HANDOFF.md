# Antigravity Swarm Plaza — Proje Devir ve Durum Raporu (Handoff)

> **Tarih**: 15 Kasım 2026  
> **Son Commit**: `c905d73` (`feat(graphics): modernized 2.5D coffee machine, water cooler with carboy, and sci-fi hologram pedestal`)  
> **Repository**: [https://github.com/akinba/antigravity-swarm-plaza](https://github.com/akinba/antigravity-swarm-plaza)  
> **Branch**: `main` (origin/main ile senkronize)  
> **Test Durumu**: **27 test paketi, 100/100 test PASS (%100 başarı)**  
> **TypeScript**: **0 hata (`tsc --noEmit`)**  

---

## 1. Proje Genel Bakışı

**Antigravity Swarm Plaza**, Google Antigravity ve Gemini çoklu ajan sistemleri (Swarm) için geliştirilmiş, 2.5D retro piksel izometrik bir ofis yönetim ve görselleştirme panosudur. Hem bağımsız bir yerel web uygulaması (`http://localhost:3210`) hem de Antigravity IDE içinde yerel bir Auxiliary Pane (Sidecar eklentisi: `sidecar://antigravity-swarm-plaza/swarm_plaza/`) olarak çalışır.

### Temel Özellikler
- **Gerçek Zamanlı Salt-Okunur Antigravity Entegrasyonu**: Antigravity veritabanı (`conversation_summaries.db`) ve oturum dosyalarını (`presence/*.lock`, `subagents/*.json`, `swarm/board.jsonl`, `logs/transcript.jsonl`) salt-okunur (`?mode=ro`) okur; ana sisteme hiçbir veri yazmaz.
- **2:1 İzometrik Retro Piksel Motoru**: HTML5 Canvas üzerinde özel 2.5D derinlik sıralaması (`isoMath.ts`, `officePropsSprites.ts`, `pixelSprites.ts`), dinamik A* koridor navigasyonu, model üniformaları (`argon`, `hydrogen`, `flash`, `carbon`, `claude`), erkek/kadın karakter oran dengesi ve 8 yönlü hareket animasyonları.
- **5 Kat Planı (Blueprints BP0–BP4) & Kat Rastgeleliği (`layoutSeed`)**:
  - `BP0`: Classic Corner Studio (2x2 yonca masa kümesi, akvaryum)
  - `BP1`: Central War-Room Hub (Ayrık masalar, Tekir kedi)
  - `BP2`: Open L-Wing Lab (Uzun startup sırası, robot süpürge)
  - `BP3`: Twin-Wing Corporate (U masalar, KD Kitaplık/Okuma köşesi, ofis köpeği)
  - `BP4`: Creative Rooftop Loft (3 yapraklı yonca, bonsai, smokin kedi)
- **Toplantı Odası (War Room) & Mini Toplantılar**: 8 yönlü toplantı masaları, etrafında oturan toplantı sandalyeleri, kart oyunu (`CARD_GAME`) etkinliği ve Yönetici Odası (Executive Boss Suite) mini toplantıları.
- **Gündüz / Gece Döngüsü & Işık Efektleri**: Çalışma masalarında açılı ofis lambaları, dinlenme salonunda zemin abajurları, sıcak radyal ışık yayılımı, TopHud üzerinde tek tıkla `☀️/🌙` geçişi ve `localStorage` kalıcı tema saklama.
- **Modüler Kanepeler**: 2 kişilik ve 3 kişilik dikişsiz birleşen modüler oturma grupları, 6 farklı döşeme kumaşı rengi (`charcoal`, `teal`, `navy`, `emerald`, `wine`, `ochre`).
- **Gelişmiş Mola & Dinlenme Deneyimi**:
  - Sakin yürüyüş hızı (`BREAK_WALK_SPEED_TILES_PER_SEC = 2.25` tiles/sec; normal iş hızı `3.2`).
  - +%25 uzatılmış dinlenme süreleri (`LOUNGE_ROTATION_MS = 22_500 ms`).
  - İki aşamalı çakışmasız koltuk rezervasyonu (`claimFreeBreakSlot`): Dinlenmeye giden ajan, hedef koltuk doluysa sırasıyla boştaki diğer koltuk/slotlara yönelir ve asla üst üste binmez.
  - 3 yeni dinlenme aktivitesi: Kitap köşesinde okuma (`reading`), atari kabininde oyun (`arcade`), otomattan soğuk kutu içecek alma (`vending`).
- **Modernize Edilmiş 2.5D İzometrik Prop'lar**:
  - **`arcade_cabinet`**: Alt kaideye tam oturan eğimli konsol önlüğü (artık havada durmuyor), çift joystick + 6 RGB buton, CRT uzay oyunu ekranı, neon T-molding ve retro ışıklı marquee.
  - **`3d_printer`**: Kapalı modern CoreXY alüminyum gövde, şeffaf füme akrilik kapak, PEI ısıtmalı tabla, hareketli karbon nozul ve üstte döner turuncu PLA makara + PTFE tüpü.
  - **`snack_vending`**: Soğutmalı cam vitrin, 4 aydınlatmalı rafta kutu içecekler ve atıştırmalıklar, dokunmatik ekran + temassız NFC ödeme paneli.
  - **`bookshelf` & `library_table`**: 4 raflı genişletilmiş ceviz kütüphane dolabı, dik ve eğik renkli ansiklopediler, pirinç kitap destekleri, açık ciltler ve yeşil banker lambası.
  - **`coffee_machine`**: Koyu ceviz alt dolap, fırçalanmış çelik espresso makinesi, yarı saydam çekirdek haznesi, krom portafiltre, fincan ve yükselen sıcak buhar.
  - **`water_cooler`**: İnci gümüşü gövde, sıcak/soğuk çift mandal, bardaklık tüpü ve üstte omuzlu/boğumlu 19L şeffaf mavi damacana (su seviyesi ve kabarcıklar).
  - **`prop_hologram`**: Kademeli teknolojik projektör kaidesi, havalandırma panjurları, optik lens, konik tarama çizgili ışık hüzmesi ve içinde süzülen 3D wireframe küre + yörünge halkası + veri uyduları.

---

## 2. Mimari ve Dosya Haritası

```
Swarm-Dasboard/
├── dist/                              # Derlenmiş üretim paketleri (client & CJS sidecar)
├── docs/
│   ├── CONVERSATION_LOG.md            # Tüm kullanıcı-asistan konuşma geçmişi (136 tur)
│   └── HANDOFF.md                     # Bu devir ve durum raporu
├── plugin/                            # Antigravity sidecar eklenti paketi
│   ├── package.json
│   ├── sidecar.json                   # Sidecar manifestosu (sidecar://antigravity-swarm-plaza)
│   └── sidecars/swarm_plaza/dist/     # Derlenmiş server.cjs ve statik istemci varlıkları
├── src/
│   ├── client/
│   │   ├── audio/retroSynth.ts        # 8-bit Web Audio ses sentezleyici
│   │   ├── components/
│   │   │   ├── AgentRpgModal.tsx      # Çalışan detay kartı & canlı düşünce akışı
│   │   │   ├── ElevatorPanel.tsx      # Asansör & kat seçim paneli
│   │   │   ├── SettingsModal.tsx      # Ayarlar (dil, ses, dpr, antialiasing)
│   │   │   ├── TopHud.tsx             # Üst HUD: XP, Eco, Kota, Gündüz/Gece butonu, Reroll
│   │   │   ├── WhiteboardModal.tsx    # Swarm Beyaz Tahta (mesajlaşma & canlı takip)
│   │   │   └── WorkflowDiagramSvg.tsx # Kat planı teknik şeması
│   │   ├── engine/
│   │   │   ├── isoMath.ts             # 2:1 izometrik koordinat dönüşümleri & kamera
│   │   │   ├── OfficeCanvas.tsx       # Ana 2.5D ofis sahnesi, ajan hareketi & çizim
│   │   │   ├── officeLayouts.ts       # 5 kat blueprint'i, mobilya yerleşimi, kanepeler & lambalar
│   │   │   ├── officePropsSprites.ts  # Tüm eşya/prop çizimleri (arcade, 3D printer, kahve, lamba vb.)
│   │   │   ├── pathfinding.ts         # A* en kısa yol koridor bulucu & yön fasetleri
│   │   │   ├── pixelSprites.ts        # Karakter çizimleri, saç/kıyafet/cinsiyet & animasyon pozları
│   │   │   └── PlazaTowerCanvas.tsx   # Dış gökdelen/plaza görünümü
│   │   └── i18n/translations.ts       # TR/EN çift dilli arayüz ve sunucu metin sözlüğü
│   ├── server/
│   │   ├── brainScanner.ts            # .gemini/antigravity çalışma alanı ve log tarayıcı
│   │   ├── dbReader.ts                # SQLite conversation_summaries.db okuyucu
│   │   ├── demoSimulator.ts           # Demo Penthouse yapay çalışan simülatörü & döngüleri
│   │   ├── gamification.ts            # Seviye, XP, Eco puanı, mola etkinlikleri döngüsü
│   │   ├── index.ts                   # Express sunucusu & WebSocket yayını
│   │   ├── officeEvents.ts            # Sosyal etkinlikler (Pizza, Star Wars, Card Game vb.)
│   │   └── officeInteractions.ts      # Zor görev kutlaması, kahve ikramı, mini toplantılar
│   ├── shared/types.ts                # İstemci-sunucu ortak TypeScript tipleri
│   ├── cli.ts                         # Komut satırı arayüzü (--port, --demo, --install-plugin)
│   └── sidecarEntry.ts                # Antigravity Sidecar sunucu giriş noktası
└── tests/
    ├── client/                        # İstemci birim testleri (i18n, isoMath, layouts, pathfinding, sprites)
    └── server/                        # Sunucu birim testleri (core, db, simulator, quota)
```

---

## 3. Çalıştırma ve Geliştirme Komutları

Yeni bir oturumda veya başka bir geliştirme makinesinde devam ederken şu komutlar sırayla kullanılabilir:

```bash
# 1. Bağımlılıkları yükleme (gerekirse)
npm install

# 2. TypeScript tip kontrolü (0 hata olmalı)
npm.cmd run typecheck

# 3. Test paketlerini çalıştırma (100/100 geçmeli)
npm.cmd test

# 4. İstemci ve Sidecar derlemesi (Vite + esbuild bundle)
npm.cmd run build

# 5. Güncellenmiş sidecar eklentisini Antigravity'ye yükleme
node dist/cli.js --install-plugin

# 6. Yerel demo modunda başlatma (tarayıcıda test için)
node dist/cli.js --demo --port 3210
```

---

## 4. Son Doğrulama ve Commit Bilgisi

| Alan | Durum |
| :--- | :--- |
| **Son Commit** | `c905d73` (`origin/main` ile eşit) |
| **Birim Testler** | 27 paket, 100/100 test PASS |
| **Tip Güvencesi** | `tsc --noEmit` hatasız (0 hata) |
| **Sidecar Kurulumu** | `~/.gemini/config/plugins/antigravity-swarm-plaza` güncellendi |
| **Kişisel Veri Koruması** | Git geçmişinde hiçbir yerel dosya yolu (`C:\Users\...`) yer almaz |

---

## 5. Sıradaki Olası Adımlar (Roadmap)

1. **Özel Kat Editörü**: Kullanıcının kendi blueprint'ini tanımlamasına veya eşya yerleşimini özelleştirmesine olanak tanıyan görsel karo arayüzü.
2. **Ses Efektleri Çeşitlendirmesi**: Atari salonu, kahve makinesi ve kitap sayfası çevirme sesleri için opsiyonel 8-bit retro ses tonları.
3. **Çoklu Kat Eşzamanlı Simülasyonu**: Asansör panelinden tüm katların aynı anda arka planda hafifletilmiş metriklerle takip edilmesi.
