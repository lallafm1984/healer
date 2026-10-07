import './legacy/proto.css';
import './app.css';
import './legacy/engineShim';
import './legacy/protoUi.js';
import { enterFullscreen } from './platform/fullscreen';
import { load, save } from './platform/storage';
import { mountTabs } from './screens/tabs';

const $ = (id: string) => document.getElementById(id)!;

mountTabs($('tabs'), $('tabPage'), $('menu'));
save(load()); // 저장 형식 확인용 (첫 실행이면 새로 만듦)
void enterFullscreen();
