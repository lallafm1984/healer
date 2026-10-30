/** 엔진의 한국어 실패 사유는 유지하고, 화면에서만 이름·문장 틀을 번역한다. */
import { lang, nickOf, t } from '../i18n';

export function actionReason(reason: string): string {
  if (lang() === 'ko') return reason;
  let m: RegExpExecArray | null;
  if ((m = /^신성한 힘 부족 \(([^/]+)\/([^)]+)\)$/.exec(reason)))
    return t('신성한 힘 부족 ({n}/{max})', { n: m[1], max: m[2] });
  if ((m = /^닿지 않음: (.+)은\(는\) 하늘에 떠 있음$/.exec(reason)))
    return t('닿지 않음: {n}은(는) 하늘에 떠 있음', { n: nickOf(m[1]) });
  if ((m = /^(.+)은\(는\) 쓰러짐$/.exec(reason)))
    return t('{n}은(는) 쓰러짐', { n: nickOf(m[1]) });
  if ((m = /^(.+): (.+)로 못 지움$/.exec(reason)))
    return t('{n}: {s}로 못 지움', { n: t(m[1]), s: t(m[2]) });
  if ((m = /^(.+): 단일 힐만 들어감$/.exec(reason)))
    return t('{n}: 단일 힐만 들어감', { n: t(m[1]) });
  if ((m = /^(.+): Lv (\d+)에 배움$/.exec(reason)))
    return t('{s}: Lv {n}에 배움', { s: t(m[1]), n: m[2] });
  if ((m = /^(.+) 재사용 대기 (\d+)초$/.exec(reason)))
    return t('{s} 재사용 대기 {n}초', { s: t(m[1]), n: m[2] });
  if ((m = /^(.+) 잠김 (\d+)초 \(진동\)$/.exec(reason)))
    return t('{s} 잠김 {n}초 (진동)', { s: t(m[1]), n: m[2] });
  if ((m = /^(.+): 고르지 않은 특성$/.exec(reason)))
    return t('{s}: 고르지 않은 특성', { s: t(m[1]) });
  if ((m = /^(.+): 전투당 1회$/.exec(reason)))
    return t('{s}: 전투당 1회', { s: t(m[1]) });
  if ((m = /^(.+) 효과 중$/.exec(reason)))
    return t('{s} 효과 중', { s: t(m[1]) });
  if ((m = /^(.+)로 지울 디버프 없음$/.exec(reason)))
    return t('{s}로 지울 디버프 없음', { s: t(m[1]) });
  return t(reason);
}
