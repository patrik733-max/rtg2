# Changelog

All notable changes to this project are documented in this file.

## [0.1.27](https://github.com/realbestia1/erdb/compare/v0.1.26...v0.1.27) - 2026-04-01

- finalize dedicated API docs flow and bump package version to 0.1.27
  Kept the new standalone `/docs` page as the single place for API documentation, linked the homepage to it, removed the old duplicated API docs content from the main page UI, and clarified `realimdb:` usage for addons that actually source series or episode metadata from IMDb IDs.

## [0.1.26](https://github.com/realbestia1/erdb/compare/v0.1.25...v0.1.26) - 2026-04-01

- add dedicated API docs page and bump package version to 0.1.26
  Added a standalone `/docs` page for the ERDB public API surface, linked it from the homepage, documented renderer/proxy/helper endpoints with real query behavior, and clarified that `realimdb:` should be used for addons that actually source series or episode metadata from IMDb IDs.

## [0.1.25](https://github.com/realbestia1/erdb/compare/v0.1.24...v0.1.25) - 2026-03-31

- align anime rating provider logos and bump package version to 0.1.25 ([92dbe86](https://github.com/realbestia1/erdb/commit/92dbe8698914b612ac1ee8dfaea4e33528e16ea6))
  Updated the anime rating provider badges to use cleaner and more accurate provider assets, with special fixes for MyAnimeList, AniList, and Kitsu rendering. This includes centering and scaling adjustments for MAL, switching AniList to its official icon asset, and replacing the Kitsu badge with the exact favicon asset used by the official Kitsu web app. Also bumped the package version from 0.1.24 to 0.1.25.
- update ([671b47e](https://github.com/realbestia1/erdb/commit/671b47ef0a437bedfb1f57377361cfca09f57e48))

## [0.1.24](https://github.com/realbestia1/erdb/compare/v0.1.23...v0.1.24) - 2026-03-31

- Bump to v0.1.24 and add configurable logo rating limits ([02885e0](https://github.com/realbestia1/erdb/commit/02885e0e093ff053ec086fe8e1f5255df965ca86))
  - bump package version to 0.1.24
  - add logoRatingsMax so logo renders can cap the maximum number of rating badges
  - expose logoRatingsMax across the renderer, UI, config string, proxy config, and AiOMetadata patterns
  - preserve empty rating params so disabling all providers correctly bypasses image rendering instead of falling back to all ratings
  - update .github README and AI integration prompt to document the new logoRatingsMax behavior

## [0.1.23](https://github.com/realbestia1/erdb/compare/v0.1.22...v0.1.23) - 2026-03-31

- Bump to v0.1.23 and refine logo badge rendering ([0b41bf0](https://github.com/realbestia1/erdb/commit/0b41bf0e243d44db83574b18e1c60014c49a3a6f))
- Update release-from-package.yml ([7926f81](https://github.com/realbestia1/erdb/commit/7926f81823d4f31e39ccafaa063aa94dc00941ff))

## [0.1.22](https://github.com/realbestia1/erdb/compare/v0.1.21...v0.1.22) - 2026-03-31

- refine logo rating rendering ([28c1c2c](https://github.com/realbestia1/erdb/commit/28c1c2c18705d8d72c7c5fbd6f8e4255afcdf921))

## [0.1.21](https://github.com/realbestia1/erdb/compare/v0.1.20...v0.1.21) - 2026-03-31

- switch AiOMetadata non-thumbnail patterns to IMDb IDs ([7a4436b](https://github.com/realbestia1/erdb/commit/7a4436b07684697751a7ed947cdb5260e4751e47))

## [0.1.20](https://github.com/realbestia1/erdb/compare/v0.1.19...v0.1.20) - 2026-03-31

- Bump to v0.1.20 and improve TMDB logo/image rendering ([60dfda6](https://github.com/realbestia1/erdb/commit/60dfda61399d77ef87863fdb80a2c153f79f2ca5))
- Update docker-image.yml ([831909f](https://github.com/realbestia1/erdb/commit/831909ffaabf9a00b6df3bf2b031a315b1055f0b))

## [0.1.19](https://github.com/realbestia1/erdb/compare/v0.1.18...v0.1.19) - 2026-03-31

- Fix npm run build failure caused by AiOMetadata TVDB thumbnail type check ([5a65003](https://github.com/realbestia1/erdb/commit/5a65003fe8112d5ce0c16492944c28d7ee51f4e4))

## [0.1.18](https://github.com/realbestia1/erdb/compare/v0.1.17...v0.1.18) - 2026-03-31

- Add TVDB-aware AiOMetadata thumbnail mapping and expose TVDB in proxy UI ([c1013b8](https://github.com/realbestia1/erdb/commit/c1013b80c9cc76a9689720e30705ede392173a1f))

## [0.1.17](https://github.com/realbestia1/erdb/compare/v0.1.16...v0.1.17) - 2026-03-31

- rename proxy metadata selector label and bump to v0.1.17 ([3901517](https://github.com/realbestia1/erdb/commit/3901517d02c537ea1fe862bbc65f12a6b247d3aa))
- . ([adf1263](https://github.com/realbestia1/erdb/commit/adf1263976c179c137e9a111af61d918b79481f6))
- Update docker-image.yml ([01b2113](https://github.com/realbestia1/erdb/commit/01b2113b6530130b121ce74a846837222017e300))

## [0.1.16](https://github.com/realbestia1/erdb/compare/v0.1.15...v0.1.16) - 2026-03-31

- simplify proxy metadata selector copy and bump to v0.1.16 ([1505a3e](https://github.com/realbestia1/erdb/commit/1505a3e6ce1d9c345b3927329fec2741b3fd10c7))

## [0.1.15](https://github.com/realbestia1/erdb/compare/v0.1.14...v0.1.15) - 2026-03-31

- Update README.md ([e502d73](https://github.com/realbestia1/erdb/commit/e502d73a7dd6e01310001c867def6594e57909ab))
- Update README.md ([e7fa349](https://github.com/realbestia1/erdb/commit/e7fa34903fd92f44d7d0a95bf5a77bf6941aab55))
- Update README.md ([818b22e](https://github.com/realbestia1/erdb/commit/818b22e85015ac86e8dc80ca7ea7b85e2c9521da))
- Update README.md ([55f2074](https://github.com/realbestia1/erdb/commit/55f20748b851df504dcc2ffbc626b45ee6b74ff1))
- . ([bd32aaa](https://github.com/realbestia1/erdb/commit/bd32aaaef5c391ae0cbcd5b342b94aca8e6069e6))
- Update README.md ([5de6f55](https://github.com/realbestia1/erdb/commit/5de6f55ee95ccc6dbc8e514ab6f514955312ac02))

## [0.1.14](https://github.com/realbestia1/erdb/compare/v0.1.13...v0.1.14) - 2026-03-31

- Prepare automated package-based releases for v0.1.14 ([5d04734](https://github.com/realbestia1/erdb/commit/5d047343fd62de396b308a90faeb177bd5a59ad7))

## [0.1.13](https://github.com/realbestia1/erdb/releases/tag/v0.1.13) - 2026-03-31

- Fix preview image caching so ratings refresh correctly when MDBList or SIMKL keys are added after TMDB ([bbea5f5](https://github.com/realbestia1/erdb/commit/bbea5f5205862b1974909c44eb12663b62dc4a13))
- Improve language dropdown labels for regional variants ([120e3b0](https://github.com/realbestia1/erdb/commit/120e3b031946d50cddf79fde86a569ed302da020))
- Fix logo vertical badge bleed and persist thumbnail badge settings ([377cd60](https://github.com/realbestia1/erdb/commit/377cd60ea320433cee32fbe54bab65a9cbd6eaf1))
- Fix logo badge layout inheriting backdrop vertical setting ([49365b2](https://github.com/realbestia1/erdb/commit/49365b2e56d204ec9b207e71a4fff3ee5cafbf6b))
- Fix Kitsu thumbnail episode IDs in addon proxy ([d427d02](https://github.com/realbestia1/erdb/commit/d427d026d59abbb078b15ba675531b0d98306310))
- update animemapping url ([d0e4d45](https://github.com/realbestia1/erdb/commit/d0e4d451bb6b209f61ab26ca8a6ff4394b263c72))
- feat(api): decouple thumbnail and backdrop vertical badge content configurations ([577e6eb](https://github.com/realbestia1/erdb/commit/577e6eb2f728e395479b9bba9268b6b5b6282a11))
- Add per-layout vertical badge styling, improve poster/backdrop badge rendering, simplify backdrop layout options, and preserve compatibility with legacy backdrop configs. ([a5ed6ca](https://github.com/realbestia1/erdb/commit/a5ed6ca4168e6d2504cc011570cab3448960def6))
- Add colored default borders to glass rating pills and quality badges, and align quality badge border thickness with the main rating style. ([b79eaa7](https://github.com/realbestia1/erdb/commit/b79eaa7dc4f76027001f9a732046aab95753d2b2))
- Align proxy episode synopsis translations with the same TMDb episode resolution used for thumbnails, including Cinemeta and AiOMetadata when IMDb is selected. ([ddcc2c9](https://github.com/realbestia1/erdb/commit/ddcc2c93ddb5ac8ef0b15fc0a30a2844acce48ed))
- Improve navbar responsiveness by fixing the mobile layout and centering the version/GitHub badges on desktop. ([1787ad0](https://github.com/realbestia1/erdb/commit/1787ad0f66b3fb432c9be2bcd3c284a704a0812e))
- Fix mobile navbar layout and make rating providers single-column on mobile. ([c1fb24b](https://github.com/realbestia1/erdb/commit/c1fb24ba638a8f359dbcbb1124e6b76d93221c5a))
- Simplify AIOMetadata proxy provider selection and improve version visibility in the panel. ([0880384](https://github.com/realbestia1/erdb/commit/0880384d6cb37b766fa2eeb718394c6362808b6d))
- Add current and latest version status to the panel using local and GitHub package.json values. ([b7f5854](https://github.com/realbestia1/erdb/commit/b7f5854c178a138228734d5573211fd5206662e6))
- Add tvdb and realimdb support, improve automatic IMDb episode dataset sync, and refine AiOMetadata/Cinemeta proxy handling for more reliable episode thumbnails. ([4d066d8](https://github.com/realbestia1/erdb/commit/4d066d8f1669a7f6da6787e037cc4fd6a0d4ff37))
- Add tvdb and realimdb episode support, improve IMDb dataset auto-sync, and refine AiOMetadata/Cinemeta proxy handling for correct thumbnail mapping. ([f0f0721](https://github.com/realbestia1/erdb/commit/f0f0721215186fb2da5d25557d1e67386e7e1c90))
- tvdb support ([071987d](https://github.com/realbestia1/erdb/commit/071987d9763da2eafd6ac13333a6c253daaa4d56))
- Persist homepage preview settings in localStorage ([06e88de](https://github.com/realbestia1/erdb/commit/06e88de868d1d34278582fb919df82d60a7e333e))
- update preview ([24bf1fa](https://github.com/realbestia1/erdb/commit/24bf1fa307f2495687ec1f55bc18f13ef0f4f456))
- Fix TMDB episode thumbnail resolution for IMDb TV inputs ([9d5a60b](https://github.com/realbestia1/erdb/commit/9d5a60bf6e9366ad000edff1769e611f1f016ab5))
- Use TMDB-first aiometadata patterns ([dc839dc](https://github.com/realbestia1/erdb/commit/dc839dc0ed85768ae6bf66c5790ae8bdd614f3e3))
- Fix thumbnail and backdrop rating preferences being unintentionally synced ([b9eeb58](https://github.com/realbestia1/erdb/commit/b9eeb585daeb5c98a6a7e79bf472a47e94dab1f5))
- Create LICENSE ([c009ab4](https://github.com/realbestia1/erdb/commit/c009ab4f86a99cea5ac5b692c8393ccaa766f2db))
- Delete LICENSE ([ed46587](https://github.com/realbestia1/erdb/commit/ed4658786d56142338a4b249512087ec4117ce7d))
- Update route.tsx ([de2a9e9](https://github.com/realbestia1/erdb/commit/de2a9e93d268e8b496f14c7b49caf5451e288615))
- Fix Quality Badges for Series ([466dfbf](https://github.com/realbestia1/erdb/commit/466dfbff6551cdfb5f5c92df706f54668e63e1fc))
- . ([65be710](https://github.com/realbestia1/erdb/commit/65be710093dd67face74e4fb538a9d76aaa8f2c0))
- Update route.tsx ([fea665c](https://github.com/realbestia1/erdb/commit/fea665c122b1a642d15ebbc1aae3e175851bb05f))
- . ([ba63c1e](https://github.com/realbestia1/erdb/commit/ba63c1e77aec14ba038a5368719011074d473f19))
- . ([a8c81cc](https://github.com/realbestia1/erdb/commit/a8c81cc9f50967e66f493396e39d73709ed17f17))
- + thumbnails ([16fedc0](https://github.com/realbestia1/erdb/commit/16fedc0765adc3301ac79e3817d1aedab7501bc9))
- Update ratingPreferences.ts ([5885cac](https://github.com/realbestia1/erdb/commit/5885caca7ed844fc3ad2e064c4a1849a7c345ba3))
- Update route.tsx ([04695ab](https://github.com/realbestia1/erdb/commit/04695ab6193b3a97f8729e10aed566f8469db185))
- Update ratingPreferences.ts ([dcea449](https://github.com/realbestia1/erdb/commit/dcea449f8e41703f893cf6c9e87f688d65e97c0e))
- Rename README.md to .github/README.md ([03f25ae](https://github.com/realbestia1/erdb/commit/03f25aec9b6ffeb6ae0eb80f3db27c0e3fa781ee))
- Update docker-image.yml ([93c6440](https://github.com/realbestia1/erdb/commit/93c6440fc526effdaf85c05706a9c522e90a61c5))
- . ([c93d636](https://github.com/realbestia1/erdb/commit/c93d636d775264d10f95ddcf71774d901f45949b))
- Update start-server.js ([72f1b66](https://github.com/realbestia1/erdb/commit/72f1b663169f75e4159c103ee882d35594b1d924))
- Update docker-image.yml ([136a31d](https://github.com/realbestia1/erdb/commit/136a31dbf46049f63dd3a53f395730a57a9b4de5))
- Update home-page-view.tsx ([27407ff](https://github.com/realbestia1/erdb/commit/27407ff1ee1d17667bb769dc1f5cbdc427201fc2))
- . ([db087b4](https://github.com/realbestia1/erdb/commit/db087b4b608d98288407aab76226be13b05c32e0))
- Update docker-image.yml ([7a284ee](https://github.com/realbestia1/erdb/commit/7a284ee5dbe42ff39359d1ab62e0f08ffa23649b))
- Update route.ts ([092d513](https://github.com/realbestia1/erdb/commit/092d51314ac1552dc7fcad710b7d7c26c417727f))
- Update route.ts ([148fd4f](https://github.com/realbestia1/erdb/commit/148fd4fd264d209ca843a11018d3e44b6be24cb3))
- Update route.ts ([0623f53](https://github.com/realbestia1/erdb/commit/0623f534a76573c2d990934bc1d69383b2e7062e))
- Update route.ts ([c7e7b0e](https://github.com/realbestia1/erdb/commit/c7e7b0e1fa0216e9a55a777e2ca44dcf1bba9fbb))
- add smart multi-id resolver and aiometadata URL pattern generator ([61d1916](https://github.com/realbestia1/erdb/commit/61d1916218fcf5e7a28db1a1facbfa17b59ea439))
- Delete Caddyfile ([aa813c2](https://github.com/realbestia1/erdb/commit/aa813c254f4376e6602ce8934496e7ea2e290db8))
- . ([713d30a](https://github.com/realbestia1/erdb/commit/713d30a1343130b88a44df6975dc229e2a1ee211))
- Update docker-compose.yml ([33b44ec](https://github.com/realbestia1/erdb/commit/33b44eca1fc21424b49d9bcb0761c9c4b97de6e6))
- Update README.md ([88aa7ae](https://github.com/realbestia1/erdb/commit/88aa7ae93205aba7cd8126f3ff3581b90355b476))
- enable multi-process runtime and simplify Docker deployment ([64f22d9](https://github.com/realbestia1/erdb/commit/64f22d9000eeec95e490f4498b8e08dd379ca114))
- Update rating-provider-sortable-list.tsx ([ffecd04](https://github.com/realbestia1/erdb/commit/ffecd04fb2757250275026159f530887b242923f))
- Update objectStorage.ts ([fd6d107](https://github.com/realbestia1/erdb/commit/fd6d1079d13f18c7d31b3cef47dc7ce72e4b0606))
- new provider (Simkl) ([ff7cf28](https://github.com/realbestia1/erdb/commit/ff7cf2890715f46944ef1a34de63f5ec3754fb37))
- update Metacritics icon ([db89b1b](https://github.com/realbestia1/erdb/commit/db89b1bfb4db0fc37de0800795bc70445b94a2e1))
- Update route.ts ([43d716b](https://github.com/realbestia1/erdb/commit/43d716b5cddf9a72c3e2955f9a4f711174a25561))
- Update route.ts ([6b533ea](https://github.com/realbestia1/erdb/commit/6b533ea95b8947df52328403cc69747bb67158af))
- Update route.ts ([e878b5d](https://github.com/realbestia1/erdb/commit/e878b5d71ff3bca309bc2c8829e496215a55e21e))
- Update route.ts ([ca060b6](https://github.com/realbestia1/erdb/commit/ca060b6f64eb407d9e1ce4b2b0ea7e3d17129ffb))
- . ([48d27ef](https://github.com/realbestia1/erdb/commit/48d27ef6598603d4b85f2e113e97d132fbe141e4))
- Providers reorder ([7068fb1](https://github.com/realbestia1/erdb/commit/7068fb1d7229853fd0914a562895cb39a8d843b1))
- fix anilist ([307f6e8](https://github.com/realbestia1/erdb/commit/307f6e8cf24e8fc87a7019d7c309cad9a85e7c4a))
- . ([b41a4ec](https://github.com/realbestia1/erdb/commit/b41a4ec79cd0ed053a70524e7b48dc85769563a1))
- Update addonProxy.ts ([f983673](https://github.com/realbestia1/erdb/commit/f98367371d10274d700405e8941c96fa27e66327))
- Update README.md ([8bd6187](https://github.com/realbestia1/erdb/commit/8bd6187c01a32a2ad54ec3a68ad65a201786aa15))
- Delete .github/workflows directory ([fcd8068](https://github.com/realbestia1/erdb/commit/fcd806816ebf72b3e424628d9b5cb6adc56f8ecc))
- Update docker-build.yml ([0134e41](https://github.com/realbestia1/erdb/commit/0134e41a13ec59b8754bf7f85ef9fc284a5a5ebd))
- Delete release.yml ([fe384a7](https://github.com/realbestia1/erdb/commit/fe384a7b8a4e0f98f6a94fc675de5109a81bf6dc))
- Update release.yml ([606ac04](https://github.com/realbestia1/erdb/commit/606ac044214e891cb9b86269fca4e58c93f4c6b1))
- . ([4c6d80e](https://github.com/realbestia1/erdb/commit/4c6d80eb82922c2f556705dfec9a94877ae755a1))
- Update route.tsx ([26c01e9](https://github.com/realbestia1/erdb/commit/26c01e9646aaa2ef3bdabd258b8a665401a0783a))
- Normalize ratings to a 0-10 scale and improve anime/backdrop badge behavior ([533961a](https://github.com/realbestia1/erdb/commit/533961ab5db7e0cef78452d8d60f2a3c4980ab62))
- Update route.tsx ([6646464](https://github.com/realbestia1/erdb/commit/664646419d093e9d1a3f24d1afb9e2111d357e63))
- . ([a44e2a9](https://github.com/realbestia1/erdb/commit/a44e2a980044a3ecdb00f48a2c87b81e8a26b131))
- . ([49350b0](https://github.com/realbestia1/erdb/commit/49350b08ddb607e246914b179cc861325e0e1dcd))
- Update page.tsx ([0ccbbfb](https://github.com/realbestia1/erdb/commit/0ccbbfbc7496008f02a8df3130ff4029c1b38c25))
- . ([85e90ef](https://github.com/realbestia1/erdb/commit/85e90ef2c2f7f4808ba2cda72c39c7cc07ab1961))
- Update page.tsx ([657f8d6](https://github.com/realbestia1/erdb/commit/657f8d60cdf2a264adde86508ebc0da0675757fb))
- Add show/hide toggles for config and proxy ([b3027f3](https://github.com/realbestia1/erdb/commit/b3027f336a7ec7025a31e55a31c5e989f0df40b9))
- Add posterQualityBadgesPosition option ([40683e1](https://github.com/realbestia1/erdb/commit/40683e13581c7919a7f92222edc4ca092aadcbd7))
- Add posterQualityBadgesPosition support ([7fcc55b](https://github.com/realbestia1/erdb/commit/7fcc55bf9b5c373a8af53544c85d9bed0d04b6f9))
- Handle 3-badge top row in left-right layout ([a13ce21](https://github.com/realbestia1/erdb/commit/a13ce21fd82ecac9f583f318f153026910b3719d))
- Redesign homepage UI; add fonts & smooth scroll ([e7d96c6](https://github.com/realbestia1/erdb/commit/e7d96c61907c37e82b7d466eb1b665bedf4155a7))
- Update page.tsx ([1099058](https://github.com/realbestia1/erdb/commit/10990586e8086e940db8afe4ae1c35c8c7f34fc0))
- Translate catalog metas concurrently ([be2c397](https://github.com/realbestia1/erdb/commit/be2c397ba845259314c10ac4dfb808fb0d781ae5))
- Add translateMeta option and TMDB translation ([2097296](https://github.com/realbestia1/erdb/commit/2097296239a6cf1708265a6bea98bdb6b3c5a3a1))
- Add config export/import and refactor proxy UI ([4d1c9bb](https://github.com/realbestia1/erdb/commit/4d1c9bbb78c6a62cc60adf2f2cf2139a61dc10a7))
- Create LICENSE ([5727613](https://github.com/realbestia1/erdb/commit/5727613824f8446a5b8195b86dae19c27bcf31e9))
- Bump renderer cache; set ratings to bottom ([890b968](https://github.com/realbestia1/erdb/commit/890b9683f7842c3620ebdc0288b9a9612be770dd))
- Update route.tsx ([f8f8264](https://github.com/realbestia1/erdb/commit/f8f826439b29f7d9f17ed7da05c169b2f602bc44))
- Update route.tsx ([4245714](https://github.com/realbestia1/erdb/commit/42457146e8c30060ea5d49ccfa18775488848472))
- Update page.tsx ([2789c1c](https://github.com/realbestia1/erdb/commit/2789c1cd5506ea686ac210d076a5e08998834032))
- Update route.tsx ([3340655](https://github.com/realbestia1/erdb/commit/3340655040803c393610bdda2d1fc63a35975dea))
- Update route.tsx ([ea5d5fb](https://github.com/realbestia1/erdb/commit/ea5d5fbd8ec7492e688ee41bf00faf546c3d2145))
- Render poster title/logo overlays & bump cache ([051677f](https://github.com/realbestia1/erdb/commit/051677f1f7eda893ad33d27d614be6f4c6f618e8))
- Handle square style stroke width in badge ([8839ed6](https://github.com/realbestia1/erdb/commit/8839ed6f7c316ccaa7bd26a0d2cf80ac749ebda2))
- Add Torrentio stream quality badges & rendering ([154693b](https://github.com/realbestia1/erdb/commit/154693ba6cbd673efac1aa9ec34eaffb95d9f963))
- Update README.md ([b1f2c45](https://github.com/realbestia1/erdb/commit/b1f2c45c66f3beb2a175fdbb3f9bf4127e1e2181))
- Update README to remove Dockerfile.hf note ([ade27ed](https://github.com/realbestia1/erdb/commit/ade27ed8732a12f061bc3a7448951a8a6c6a4d14))
- Fix typo in HuggingFace Guide section ([d69d2ab](https://github.com/realbestia1/erdb/commit/d69d2ab70d848faea7612fca8d60319a64873f68))
- Update README.md ([c47148b](https://github.com/realbestia1/erdb/commit/c47148bb550905ae1c2f548b0183ca0fcc71409d))
- Update README.md ([b239b2b](https://github.com/realbestia1/erdb/commit/b239b2bdfc7788041d46ff14c754fb86a33344f7))
- Update Dockerfile ([f76b650](https://github.com/realbestia1/erdb/commit/f76b650c55de420ebeca6eb84c90115d9da477a2))
- Update Dockerfile.hf ([ed61221](https://github.com/realbestia1/erdb/commit/ed612212c1c63ab729e48d6b8cd5a480ef5dfdd4))
- Update Dockerfile.hf ([f3e3100](https://github.com/realbestia1/erdb/commit/f3e31001ab6fcb8457f51c4809ebee6ce103a224))
- Update route.tsx ([9d5ea22](https://github.com/realbestia1/erdb/commit/9d5ea2249bca728ceab807f2b7d947dd6687e268))
- . ([c79fcd9](https://github.com/realbestia1/erdb/commit/c79fcd9739d551ec28e9ec2285e8d415049c3862))
- Update route.tsx ([43e80c3](https://github.com/realbestia1/erdb/commit/43e80c3502349efed1553fc5b503e6faca5338e2))
- Update route.tsx ([51c0a40](https://github.com/realbestia1/erdb/commit/51c0a40fa1c7fd1b709a3280d687cbc0794e07ca))
- Update route.tsx ([68d2c5d](https://github.com/realbestia1/erdb/commit/68d2c5dd18cfdce0de229bede0004505fdac1717))
- . ([03af745](https://github.com/realbestia1/erdb/commit/03af7450d10d750e35c8f9b11ce647ac5197f3f5))
- . ([e33e863](https://github.com/realbestia1/erdb/commit/e33e8630323c1d190eb8d04e55951cabc03eb9e0))
- Update route.ts ([9c7acfd](https://github.com/realbestia1/erdb/commit/9c7acfd567ac0b6d682834eb04eac5b86524e12d))
- Update page.tsx ([e4262e8](https://github.com/realbestia1/erdb/commit/e4262e804542cb740c8ea47789327b2c8f81768e))
- Update README.md ([cb51c67](https://github.com/realbestia1/erdb/commit/cb51c67bfb569e79ad2beaf38b12418beb6f9ded))
- Delete for unsupported addons.mp4 ([291974e](https://github.com/realbestia1/erdb/commit/291974e17a2b6bb65a086a43f2d924c0124dd252))
- Delete for supported addons.mp4 ([bbf9565](https://github.com/realbestia1/erdb/commit/bbf9565764e3e525cc2b3617083593d2c68ff2d1))
- Add files via upload ([93885fd](https://github.com/realbestia1/erdb/commit/93885fdfb98efa216c7d51621f5b7a966b0536a6))
- Update Dockerfile ([a7aead2](https://github.com/realbestia1/erdb/commit/a7aead2767d9fa415b0c5d9f0d790fc915b37818))
- . ([a4ba38c](https://github.com/realbestia1/erdb/commit/a4ba38c599f50c2dec82148479a582cce510ef2c))
- . ([1d1b1e8](https://github.com/realbestia1/erdb/commit/1d1b1e877ff045f68a1ae3121871ba9001d1ca55))
- Update addonProxy.ts ([fa63fe6](https://github.com/realbestia1/erdb/commit/fa63fe62209d35caaecd7f7bca1a90e8624defe5))
- Update page.tsx ([c52628a](https://github.com/realbestia1/erdb/commit/c52628aba19181583aa4086b6ad84d2ec7168428))
- . ([ae84d80](https://github.com/realbestia1/erdb/commit/ae84d80f5b22a2d836dc5084a042a1e19c52a20b))
- HuggingFace Dockerfile ([85d938c](https://github.com/realbestia1/erdb/commit/85d938ca6e10a7482d42c50b0fe0e24e706255d4))
- Update Dockerfile ([63bd0f5](https://github.com/realbestia1/erdb/commit/63bd0f5ee4b6fb5b8b37ef69d6a70b39750de854))
- . ([84008ea](https://github.com/realbestia1/erdb/commit/84008ea91c6afac24439f61d6250cceee32cc041))
- . ([e3d4306](https://github.com/realbestia1/erdb/commit/e3d43066ef6aa353c574b366d825e4fdea116267))
- Update README.md ([724a1e9](https://github.com/realbestia1/erdb/commit/724a1e966a04bfe1bca25e854e5536f059614e5d))
- proxy any addon ([fa680c4](https://github.com/realbestia1/erdb/commit/fa680c48afef531fc02b826c95a2393bf1694bca))
- Update page.tsx ([dd52a5e](https://github.com/realbestia1/erdb/commit/dd52a5ee643219aa3b66b2387d64282d4126f537))
- Update README.md ([90bb391](https://github.com/realbestia1/erdb/commit/90bb391fd9509333d57e6d4a73a51b5897910ede))
- Update page.tsx ([abb37a4](https://github.com/realbestia1/erdb/commit/abb37a45a933dbab05696f65d0a051201fb15d09))
- Update route.tsx ([3ae181c](https://github.com/realbestia1/erdb/commit/3ae181cdc32310165c707f775991566f2efc5dba))
- Update route.tsx ([6a98ab1](https://github.com/realbestia1/erdb/commit/6a98ab1f57dc3e9d0a1583638827cc50ff853697))
- . ([1c4ca74](https://github.com/realbestia1/erdb/commit/1c4ca7437ed10f1bbe33ba866fa0844c22c21ae0))
- Update route.tsx ([fe832a5](https://github.com/realbestia1/erdb/commit/fe832a5211657f7fa18815ab0fde3593e52257af))
- Update route.tsx ([34741e7](https://github.com/realbestia1/erdb/commit/34741e76ba12ef4415a0b74642771823bbaa84a6))
- Update route.tsx ([3632ac7](https://github.com/realbestia1/erdb/commit/3632ac79d36d92cfaf4f05058d98363acd052c1c))
- Update README.md ([b36b4cd](https://github.com/realbestia1/erdb/commit/b36b4cdbaacc2c1dc928aca8dfe57526f1a38ba4))
- Update route.tsx ([80617d3](https://github.com/realbestia1/erdb/commit/80617d33525d97c991b11c3e58f9ff1438d2f42a))
- Update route.tsx ([e84fddb](https://github.com/realbestia1/erdb/commit/e84fddb40e0f84e9d5ba39aa7431b8a3bb093c16))
- Update docker-compose.yml ([bc93059](https://github.com/realbestia1/erdb/commit/bc93059a37235f39e683bf740bac9cbdcf64f359))
- Update README.md ([98b6605](https://github.com/realbestia1/erdb/commit/98b660588e9995276c9175e985ac784fd4996e09))
- . ([9a8098d](https://github.com/realbestia1/erdb/commit/9a8098d23c08103a261ee98559fb7167e8b54d1d))
- Update README.md ([e5bc6f9](https://github.com/realbestia1/erdb/commit/e5bc6f968f2675546d273fa2fa0c4032b8410505))
- Update README.md ([d49d4cf](https://github.com/realbestia1/erdb/commit/d49d4cfbd245d38b797273048649746490cb331e))
- Update README.md ([3bce9ee](https://github.com/realbestia1/erdb/commit/3bce9eea3ce2a818b1f7c88868a82d5e6f34a28a))
- Update README.md ([53c6609](https://github.com/realbestia1/erdb/commit/53c660919c9bd633e188134c075bb11d85d4bbe2))
- Initial commit ([c690a44](https://github.com/realbestia1/erdb/commit/c690a44ac2258228b3c4d8a1dc7f2b053cd2d8be))
