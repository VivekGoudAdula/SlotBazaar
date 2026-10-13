# SlotBazaar — Wallet Registry

This file tracks every wallet address used in SlotBazaar development.
**NEVER record private keys here or anywhere in the repo.**

| Address | Role | Purpose | Notable Tx Hash |
|---------|------|---------|-----------------|
| `0x53491aA366E086C19da948669b340317eE6eA6e9` | seed-wallet / phase-0 | Creates synthetic slot entities for Phase 0 testing | `0xe8bca88098bb0525dd4c865f28d757e383f04a44b2ff01fbbb2a1025cd069ed2` |

---

## Phase 0 Entities

### 1. Hello-Slot Entity (Primary Slot)

| Field | Value |
|-------|-------|
| Entity key | `0xae9bcc84c5060776a107ccc0aedeb6b496ee5608e8f3e7cd51cd87001638918d` |
| Tx hash | `0xe8bca88098bb0525dd4c865f28d757e383f04a44b2ff01fbbb2a1025cd069ed2` |
| Explorer | https://data.arkiv.network/?q=0xe8bca88098bb0525dd4c865f28d757e383f04a44b2ff01fbbb2a1025cd069ed2&chain=tiramisu |
| Expires at block | `489834` |
| Created | 2026-10-12 IST |
| Type | `project=slotbazaar, entity_type=slot, category=machine, cluster=surat` |

### 2. Expiry-Test Entity (Short-lived 10 min)

| Field | Value |
|-------|-------|
| Entity key | `0x40c9380d0ec3a4f3273544209436833fc1005bd7e61f5a37d755cabb8a0d3780` |
| Tx hash | `0x6ba82dbc4c391f9c202b307a57ae21547f53b791814ba6e081ea55939a3bd5fb` |
| Explorer | https://data.arkiv.network/?q=0x6ba82dbc4c391f9c202b307a57ae21547f53b791814ba6e081ea55939a3bd5fb&chain=tiramisu |
| Expires at block | `484782` (CONFIRMED EXPIRED) |
| Created | 2026-10-12 IST (~20:55 IST) |
| Type | `project=slotbazaar, entity_type=expiry_test, synthetic=true` |

---

## Phase 1 Entities & Wallets

### Wallets

| Address | Role | Purpose | Notable Tx Hash |
|---------|------|---------|-----------------|
| `0x53491aA366E086C19da948669b340317eE6eA6e9` | Primary Seller Wallet | Creates slots and seller completions | `0xcabe8699e565c9bcec217c8d9b78a637764f22e0309c2f98227d0c4a239ff94d` |
| `0x2fEA91303BB18B3Cb91742b834bd6672e22bD19b` | Ephemeral Buyer Wallet | Books slot and creates buyer completion | `0xb82617d5e8637983c33920a8784e97125f926391fea40023f972f82e5118e665` |

### Entities

| Entity | Key | Tx Hash | Role / Type |
|--------|-----|---------|-------------|
| Slot A | `0xb88001059d23f8b1c42b653fb8df229038ce78cbca70e3ec592330e9e71021d3` | `0xcabe8699e565c9bcec217c8d9b78a637764f22e0309c2f98227d0c4a239ff94d` | `category=machine, cluster=surat` |
| Slot B | `0x979336bfb2aeda98fa12034fce0637eeb86bbd40a9713192db4c06f85f73d236` | `0x74efc4847d8fa2c9b6eb1f73301ad2f7c3d4ce1c304948d475af73b65aeca28d` | `category=transport, cluster=mumbai` |
| Slot C | `0xc7afe2e8309c58b51ef8af189d39ecf362e72cf1294cc02d39cde79745a4a28d` | `0x43a0a4ef66259f6cf8f838619d0dd962464fc6e94802efb293f92d53c18046d9` | `category=freelance, cluster=bengaluru` |
| Booking A | `0x35f7c0cb6b97e1e0e0b0e8d4d6919ee16a3cce096dbbe1db745e3fb0e153a0dc` | `0xb82617d5e8637983c33920a8784e97125f926391fea40023f972f82e5118e665` | Booked by Ephemeral Buyer |
| Completion (Seller) | `0xe28b740c41fdedf29c2737b6cc160845e0e03a623d215c86837cee0aa107ffe6` | `0x0b98c1d92ceb2683f8a4c5f02a2b77f15e675250bd0badf3e1fc9fcf13d0d2df` | `role=seller` |
| Completion (Buyer) | `0x084a5da908bd64c4b93ef1f1012edb7976caecba35a0b272939ddc16509f1f88` | `0x506eecd36162d2ad4f04c6c1ff785b092f43eed3d37dd362810292123b5c0b61` | `role=buyer` |

---

> Keys live only in `.env` (git-ignored).  
> All transactions are on the **Tiramisu testnet** (chain ID `7738577`).  
> Explorer: https://data.arkiv.network/?chain=tiramisu

---

## Phase 2B Entities & Cost Measurements

### Wallet

| Address | Role | Purpose |
|---------|------|---------|
| `0x53491aA366E086C19da948669b340317eE6eA6e9` | Seed wallet | Phase 2B: live seed (30 slots) + cost measurement |

### Cost Measurement Entities (2026-10-13)

| Label | Entity Key | Tx Hash | GLM Spent |
|-------|-----------|---------|-----------|
| 3h slot | `0xa33d2b2de27b035d5c3cb4a58ec3f078f7ab9a22657420572ea85efd3368692b` | `0x321e34489f4186e108982c1657e508aabef5a9d18cbb73a088a40d68ea8db9f0` | 0.000141824 GLM |
| 24h slot | `0xe72bcfd9507e5e6ba524b0daf302997b9af3e9ea27edd19b7dae2304a5f0aa41` | `0xde1b0b34c853aff3b799cfcc6ae716755a046a8df434ff1625922d36783d2cd1` | 0.000141840 GLM |

**Estimated 40-slot seed cost: ~0.005673 GLM**

### Phase 2B Live Seed (batch: seed-2026-10-13, 30 slots, all synthetic=true)

| # | Cluster | Category | Dur | Entity Key | Tx Hash |
|---|---------|----------|-----|-----------|---------|
| 1 | mumbai | machine | 6m | `0x0cd5c397af109774f5e63d65dc8c760ef6476447746ef10ae84a9fc0dfbcca0a` | `0x3aac15b500d90446107e6f4c3ca16af443533b493d5b7ae168bda787b75f9a57` |
| 2 | delhi | transport | 12m | `0x740bceffaef0ea0fda960127e1559614559c4d38dce8b191190c9116790779cf` | `0x7b21117a61064ddc9a5faa8c4c5797588d0311ed6eae85d5a1122f8ce9d435bd` |
| 3 | bangalore | freelance | 30m | `0x0b5570e16dab04d679abea2d9d4ad03b3a337124c04d9ba34d70a0ce6c1ce391` | `0xbed2dea4564893c3d4330e8fcddfa352fafcfa8061b8de89c2822d5aab477d48` |
| 4 | chennai | machine | 45m | `0x6a60036a2cbc6294f38c02f38aaddfd35698c8e3e90f6c4e4f1a25e1c8dfa0d4` | `0xcd6f2ebe32488a9ea28280b776ead2b9f1735122b1ab6779cc530fcfc0915dbc` |
| 5 | kolkata | transport | 1h | `0x47cb249b1a6feb66d0d1206ae9e8ca46f51e9583fa5266b846605f15e4507e8a` | `0xb5ac039c9faed17dce7cb1786c8ff0a99f61efd4b9c8b73db3f28ee2de90a5ea` |
| 6 | hyderabad | freelance | 4h | `0xe7e7b02399951697c67c9f93ebd80894ceb92e06b582d2a793d8bf09397862ed` | `0x5d06818ba00c8c6202368ddb66baca543ced2eee834724509987588cfcba0680` |
| 7 | ahmedabad | machine | 2h | `0xb3e6251bb121d9bf01e0039e6ac109cad25f3349e98b0b3929c10853d5ee525e` | `0x17765477293ab667ca78396a297735c4d6e3b842ae81efd982d98424b52789df` |
| 8 | jaipur | transport | 5h | `0xf1b89cb116782dd5ea7c5fe41899291ff49243b9750c4797541eff85b380dcde` | `0xa91dcae7c995ca3b26722bb8b115060d5c2f0170cc4efadfe2853d882c6e2c6e` |
| 9 | surat | freelance | 1h | `0xf72c9f8bab27e410693dcb548a82a95d4e10ba6e1f2390f990f2242b75b347c6` | `0x379a784408fc312061410ba1f0db1340c014de95482b99488fe1e10ed89266f8` |
| 10 | lucknow | machine | 4h | `0x8102fe92126f40a1d1ca0655d3634a03d9e85fe1d159743ab6498a732343d479` | `0x1dc8e38dd43e18b03f806825f3b25f19bb4a873d2813b1acb46317a8c33bc0ec` |
| 11 | mumbai | machine | 4h | `0x2a0d46495808dd047e8f2dad5a86b1f73539cd10d12f19a7675d9f43973e001c` | `0xa5599ab331193530e16f16a24ff4d349b60a3c4b5b4634147d9a559d816b599d` |
| 12 | delhi | transport | 3h | `0xe25c1e704349798e70cb59f5cb8d4dcf34bc6b1b3576f7c8dacb61b364421f54` | `0x1dc89eccce7bbf9699975d0ee2313d9916becddbbc386e9c503ac451a61c0793` |
| 13 | bangalore | freelance | 2h | `0x42cccf35bf2895ccf7917c1e4b218a4023d263f6c8d36fbcf1341012c811f32a` | `0xa49515cee90b92b74beba1a2fac49d9c6a4cf9230c3c8dec8550fff55af5b2ea` |
| 14 | chennai | machine | 1h | `0xf63221ced5417ca5c6701bda0844a180e02f8118a8f624a7ce289ea18d87ae0f` | `0x28e83ec18fdf00fc3c92e8fb7f5d6b6cb2254dab1c81ded7ac850daee38f30ab` |
| 15 | kolkata | transport | 5h | `0x08f4ac728568a1e7e84b5e3ad8003a7a15532fdc0dd6f3a149546f55d5e5e39c` | `0xd3d0e664e1657ccc0ab23ec95e5b9fe0c822b3879261e05786ef7ec9e12270be` |
| 16 | hyderabad | freelance | 1h | `0x7949c761b5ed6ddd5333a5d68c550be9642defb9152778328f821d09f569a645` | `0x52f006fec68431ea947ce043e25ca03512a575290e0a024433aaefb69b1b6745` |
| 17 | ahmedabad | machine | 2h | `0xf903130860baaf2886966f59a472b77a18a634a0eda6d17f814d03ee96712bfc` | `0xd4950234ece5065ffcd27bf84d73c5ff8341fdccda97093e1bad083141061e55` |
| 18 | jaipur | transport | 1h | `0xdd4a9c87d2b8c9f51fa85c5dbd8379bba72820b8c39926c3bc4708de26ce739a` | `0xb0f898995f8184558a8283ea574384fe4bf4a80065acc863dd0e18b178b18736` |
| 19 | surat | freelance | 2h | `0x662d65afa757d1758a25be118059006d02cb2787c2050b9b2062a2402b1d4041` | `0x3bf035cc09dafbe9810996cb1eb73ea88345838250b8706ee8ad99d43d3606c9` |
| 20 | lucknow | machine | 7h | `0x4598beb0e72b1d992a0b396f75fc2ea60196a024e973140b951c7b5f555366ca` | `0x6686941ee5a580503683b7f0dbec21c5367d83964108dbe637c2eff707caadd4` |
| 21 | mumbai | machine | 5h | `0x7d7c415d0e2c1ef0d17bbf5365e5f0f0e7a781af72ead2eec510857348461b6c` | `0x957793d99a318ab4d18ce900dadc8eb42dd87eedf8bf25363e36a267df67f7e6` |
| 22 | delhi | transport | 5h | `0x86dfde9aab648395617ac85c752e0328b104394f2d9904258cd8ce5480fd71c5` | `0x329583be36e2a1fa9f4b97e62f2134d0256ffc7fe3d27d9d9fd9218553459a3a` |
| 23 | bangalore | freelance | 5h | `0x52f45db5adaf48739345009a400934c74f45a4d9b2c8cd9d4dc9810ddeaede06` | `0xb5c7063747f744fbc584d52b0808c292e2e3e051707cf2474d5999665f3d00e4` |
| 24 | chennai | machine | 3h | `0x8ad01092f3ee663ccd294f4d5c1be244952d558a8485eee28293a8a2aa42fdce` | `0xb344daaddc38ae9ae1426958cbe7c914a35898bed7b4f526bd47768c7e104a35` |
| 25 | kolkata | transport | 7h | `0x2c18e5939dcf386e0e6098f6f5148510146bd8fb59f0fabaad1dd3c334948b15` | `0xe994e2418224b4e0450a0736ca1431d1af01a7a4b32e4a7d2b614a78548773df` |
| 26 | hyderabad | freelance | 4h | `0xfc4ebdc44368bfc1a295b03beae65e7968cc0110a045eaf1beea6c48f62dd04d` | `0x7a44df1bcddfb450b6d764cda713288233d162658b81d29c87e9bfb099ea174f` |
| 27 | ahmedabad | machine | 4h | `0xc9256a03ed4e7f81748e4310e22b8dedde12105a61e2e2e1e552ca1bd60de2e2` | `0xfce57bee7360256b3df58eba816c22fb1cc048394da9c1c548be3dfeb289c298` |
| 28 | jaipur | transport | 3h | `0xea0855f022200684a9698b6f0235e0f55a088d56bfe703e9aa15a62cc3eb6917` | `0x2290d3cb87420101eaf129b61ee130a17ef3c21f6a60ee514af8ce2f00370990` |
| 29 | surat | freelance | 7h | `0x336ba685d712cedea4cb501dda7fa4711be42c572b944776aa82391a16edcda2` | `0x5fee15a9fa4a811b617058fbbaa01350a0b2e454e9132d0d3b4543ea4497d217` |
| 30 | lucknow | machine | 4h | `0x33360ec932d999c460db688111d0c36e3e65e7c12a7153c1d17a18d1164adbf7` | `0x1973651004052409eb88e19989cc4293361c7b7681e3072cb7e8e4d6e9096f6c` |
