import './fonts/fonts.css';
import './battle/battle.css';
import './app.css';
import './screens/screens.css';
import './screens/mobile.css';
import './battle/portrait.css';
import './theme.css';
import './screens/art.css';
import './screens/menu27.css';
import './screens/flow27.css';
import './screens/char31.css';
import './screens/game30.css';
import './screens/lobby30.css';
import './screens/content30.css';
import './screens/result30.css';
import './battle/hud27.css';
import './battle/compact.css';
import './battle/sunforged-stage.css';
import './battle/mob-deck.css';
import './battle/sunforged-controls.css';
import './screens/sunforged-ui.css';
import './screens/lobby-a2.css';
import './screens/lobby-a2-fidelity.css';
import './screens/lobby-life.css';
import './screens/lobby-menu.css';
import './screens/a2-theme.css';
import './screens/a2-character-theme.css';
import './screens/a2-character-controls.css';
import './screens/a2-talents.css';
import './screens/a2-adventure-theme.css';
import './screens/a2-services-theme.css';
import './screens/a2-character-compact.css';
import './screens/a2-character-palettes.css';
import './screens/a2-topbar.css';
import './screens/adventure-departure.css';
import './screens/adventure-emphasis.css';
import './screens/party-refinement.css';
import './screens/guide-sheet.css';
import './screens/chal-entry.css';
import './screens/lock-plates.css';
import './battle/hit-feel.css';
import './battle/battle-polish.css';
import './screens/result-hall.css';
import './screens/party-hall.css';
import './battle/rest-guide.css';
import './screens/a2-character-paper.css';
import './screens/gear-detail.css';
import './screens/level-up.css';
import './screens/class-jobs.css';
import './battle/popovers.css';
import './screens/stamina.css';
import './screens/departure-hall.css';
import './screens/service-hall.css';
import './screens/guild-hall.css';
import './screens/modal-hall.css';
import './screens/member-traits.css';
import './screens/guide.css';
import './screens/legend.css';
import './screens/gear-d2.css';
import './battle/class-gauge.css';
import './battle/class-controls.css';
import './screens/talent-sheet.css';
import './screens/merchant.css';
import './screens/touch-floor.css';
import './screens/type-polish.css';
import './screens/menu-buttons.css';
import './screens/tap-fx.css';
import './screens/transition.css';
import './battle';
import './screens/title';
import './screens/lobby';
import './screens/content';
import './screens/entry';
import './screens/party';
import './screens/result';
import './screens/character';
import './screens/guild';
import './screens/shop';
import './screens/merchant';
import './screens/missions';
import './screens/tutorial';
import { enterFullscreen } from './platform/fullscreen';
import { commit, G, refreshDay, syncAds } from './game/state';
import { go } from './screens/kit';
import { pushSettings } from './screens/settings';
import { mountTabs } from './screens/tabs';
import { mountTapFx } from './screens/tap-fx';
import { mountScreenFx } from './screens/transition';
import { mountTapSlop } from './screens/tap-slop';
import { mountBack } from './screens/back';
import { mountUiSounds } from './screens/ui-sound';
import { applyArtVars, warmArt } from './art';
import { prepareVillage } from './screens/village';
import { initClock } from './platform/time';
import { mountServer } from './screens/server-notice';
import { mountAccount } from './screens/account';
import { mountI18n } from './i18n/dom';

applyArtVars();
mountI18n(); // 정적 글 (전투 · 정비)을 지금 언어로 (기획 121). 사전은 i18n 모듈이 읽힐 때 이미 읽음
mountTabs(document.getElementById('tabs')!);
const calmFx = () => !!G.save.settings.reducedEffects || matchMedia('(prefers-reduced-motion: reduce)').matches;
mountTapFx(calmFx); // 버튼 터치 연출 (2026-10-20 Lim)
mountScreenFx(calmFx); // 화면 전환 연출 (2026-10-24 Lim A안)
mountTapSlop(); // 손가락이 조금 움직인 탭도 누름 (2026-10-21 Lim)
mountBack(); // 안드로이드 뒤로가기로 앱이 닫히지 않게 (2026-10-22 Lim)
mountUiSounds();
await initClock(); // 게임 시각 (서버 시각 + 경과 시계, 기획 120 9-3): 리셋 · 저장보다 먼저
pushSettings();
commit(); // 저장 형식 확인용 (첫 실행이면 새로 만듦, 옛 저장은 새 형식으로)
refreshDay();
syncAds();
go('s-title');
mountServer(); // 서버 시각 · 강제 업데이트 · 점검 · 공지 (기획 120 9-5, 서버 주소가 없으면 아무것도 안 함)
mountAccount(); // 구글 계정 · 앱을 내릴 때 자동 백업 (기획 120 9-2, 로그인한 사람만)
void enterFullscreen();
// 메뉴 · 로비 · 조작판 그림을 미리 디코딩 (지금 직업 조작판만). 장소 · 보스 · 이펙트 그림은 그 화면에서 (2026-10-17 Lim 「처음 페이지 열 때 살짝 느림」)
prepareVillage(); // 로비 마을 (Pixi · 나무 · 집 · 구름 그림)도 타이틀에서 미리
const hero = G.save.hero;
warmArt(n => /^(a2-|icon-|tab-|emblem-|mark-|village-|adventure-|party-|equipment-|stat-|ui-(?!class-))/.test(n) || n.startsWith(`ui-class-${hero}-`));
