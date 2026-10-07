import './legacy/proto.css';
import './app.css';
import './screens/screens.css';
import './legacy/engineShim';
import './legacy/protoUi.js';
import './screens/title';
import './screens/lobby';
import './screens/content';
import './screens/entry';
import './screens/party';
import './screens/result';
import './screens/character';
import './screens/tutorial';
import { enterFullscreen } from './platform/fullscreen';
import { commit } from './game/state';
import { go } from './screens/kit';
import { pushSettings } from './screens/settings';
import { mountTabs } from './screens/tabs';

mountTabs(document.getElementById('tabs')!);
pushSettings();
commit(); // 저장 형식 확인용 (첫 실행이면 새로 만듦, 옛 저장은 새 형식으로)
go('s-title');
void enterFullscreen();
