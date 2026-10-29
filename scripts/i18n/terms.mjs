// 용어 일관성 (2026-10-29 Lim 「로컬라이징 하면서 공통단어를 다르게 쓰지 않도록 주의해」, 기획 121 5장 용어 표):
//   한국어 열쇠에 용어가 들어 있으면 영어 · 일본어 번역에도 표의 말 (가운데 하나) 이 들어 있어야 한다. tests/i18n.test.ts가 검사.
//   node scripts/i18n/terms.mjs  → 어긋난 열쇠 목록.
//   ko: 열쇠에서 찾는 한국어 (앞뒤 조사 · 띄어쓰기 상관없이 부분 일치, '@ctx'가 붙으면 그 문맥 열쇠만) · en · ja: 허용하는 말 (영어는 대소문자 무시, 복수 · 활용은 앞부분 일치: Dungeon → Dungeons)
//   not: 이 글이 함께 있으면 다른 뜻이라 안 봄 (방어구 · 마을 정비). 긴 용어 (길드원) 가 맞으면 그 안의 짧은 용어 (길드) 는 안 봄.
//   표에 없는 용어를 새로 정하면 121 5장과 여기에 함께 더한다. 일부러 다르게 쓰는 열쇠 (짧은 칸 등) 는 EXCEPT에 까닭과 함께.
export const TERMS = [
  // 5-1 직업 · 역할 · 파티
  { ko: '힐러', en: ['Healer'], ja: ['ヒーラー'] },
  { ko: '사제', en: ['Priest'], ja: ['プリースト'] },
  { ko: '드루이드', en: ['Druid'], ja: ['ドルイド'] },
  { ko: '성기사', en: ['Paladin'], ja: ['パラディン'] },
  { ko: '주술사', en: ['Shaman'], ja: ['シャーマン'] },
  { ko: '수도사', en: ['Monk'], ja: ['モンク'] },
  { ko: '점성술사', en: ['Astrologian'], ja: ['占星術師'] },
  { ko: '결계사', en: ['Warder'], ja: ['結界師'] },
  { ko: '직업', en: ['Class'], ja: ['ジョブ'] },
  { ko: '탱커', en: ['Tank'], ja: ['タンク'] },
  { ko: '딜러', en: ['DPS'], ja: ['DPS'] },
  { ko: '근접', en: ['Melee'], ja: ['近接'] },
  { ko: '원거리', en: ['Ranged'], ja: ['遠隔'] },
  { ko: '파티', en: ['Party', 'Group Finder'], ja: ['パーティ'] },
  { ko: '파티원', en: ['Party Member'], ja: ['パーティメンバー'] },
  { ko: '공개모집', en: ['Group Finder'], ja: ['パーティ募集'] },
  { ko: '길드파티', en: ['Guild Party', 'Guild Sortie'], ja: ['ギルドパーティ', 'ギルド出撃'] },
  { ko: '편성', en: ['Party Setup', 'Setup', 'Suggested Party'], ja: ['編成'] },
  { ko: '파티 편성', en: ['Party Setup'], ja: ['パーティ編成'] },
  { ko: '출전', en: ['Sortie'], ja: ['出撃'] },
  { ko: '출발', en: ['Depart'], ja: ['出発'] },
  { ko: '출전할 곳', en: ['Destination'], ja: ['出撃先'] },
  { ko: '다시 도전', en: ['Retry'], ja: ['再挑戦'] },
  { ko: '성격', en: ['Personality', 'Personalities'], ja: ['性格'] },
  { ko: '길드원', en: ['Guild Member', 'Member'], ja: ['ギルドメンバー', 'メンバー'] }, // 길드 화면 안에서는 Member · メンバー로 줄여도 됨
  { ko: '길드', en: ['Guild'], ja: ['ギルド'] },
  { ko: '명성', en: ['Renown'], ja: ['名声'] },
  { ko: '모집 공고', en: ['Recruitment Post', 'Post'], ja: ['募集掲示', '掲示'] },
  { ko: '지원자', en: ['Applicant'], ja: ['応募者'] },
  { ko: '영입', en: ['Recruit', 'Hire'], ja: ['加入', '勧誘'] },
  { ko: '후원', en: ['Sponsor'], ja: ['支援'] },
  { ko: '부탁', en: ['Request'], ja: ['依頼'] },
  { ko: '원정', en: ['Expedition'], ja: ['遠征'] },
  { ko: '내보내기', en: ['Dismiss'], ja: ['除名'] },
  // 5-2 콘텐츠 · 난이도 · 진행
  { ko: '탐험', en: ['Venture'], ja: ['探索'] },
  { ko: '던전', en: ['Dungeon'], ja: ['ダンジョン'] },
  { ko: '레이드', en: ['Raid'], ja: ['レイド'] },
  { ko: '주간 도전', en: ['Weekly Challenge', 'Weekly'], ja: ['週間チャレンジ', '週間'] },
  { ko: '어픽스', en: ['Affix'], ja: ['アフィックス'] },
  { ko: '구간', en: ['Stage'], ja: ['区間'] },
  { ko: '장소', en: ['Area'], ja: ['エリア'], not: ['{p} 장소'] }, // {p} = 장소 이름
  { ko: '지역', en: ['Region'], ja: ['地域'] },
  { ko: '난이도', en: ['Difficulty', 'Difficulties'], ja: ['難易度'] },
  { ko: '쉬움', en: ['Easy'], ja: ['イージー'] },
  { ko: '어려움', en: ['Hard'], ja: ['ハード'] },
  { ko: '악몽', en: ['Nightmare'], ja: ['ナイトメア'] },
  { ko: '권장 레벨', en: ['Recommended Lv', 'Rec. Lv'], ja: ['推奨レベル', '推奨Lv'] },
  { ko: '길잡이', en: ['Guide'], ja: ['ガイド'] },
  { ko: '클리어', en: ['Clear'], ja: ['クリア'] },
  { ko: '전멸', en: ['Wipe'], ja: ['全滅'], not: ['탱커 전멸'] }, // 탱커만 쓰러진 것은 the tanks fell
  { ko: '포기', en: ['Abandon'], ja: ['撤退'] },
  { ko: '보상', en: ['Reward', 'Loot'], ja: ['報酬'], not: ['보상형'] }, // 보상형 광고 = Rewarded Ad · リワード広告
  { ko: '경험치', en: ['XP', 'Experience'], ja: ['経験値'] },
  { ko: '레벨 업', en: ['Level Up'], ja: ['レベルアップ'] },
  { ko: '휴식', en: ['Rest', 'Refill'], ja: ['休息'] }, // 로비 「휴식 충전」 소켓 = Refill
  { ko: '골드', en: ['Gold'], ja: ['ゴールド'], not: ['골드 지원'] }, // 골드 지원 = 후원 (Sponsor · 支援), 한국어만 두 말
  { ko: '임무', en: ['Quest'], ja: ['クエスト'] },
  { ko: '일일', en: ['Daily', 'Dailies'], ja: ['デイリー', '毎日', '日替わり'] },
  { ko: '주간', en: ['Weekly', 'Weeklies', 'Week'], ja: ['週間', 'ウィークリー', '今週', '週'] },
  { ko: '완료 상자', en: ['Completion Chest'], ja: ['達成報酬'] },
  { ko: '월요일 상자', en: ['Weekly Chest'], ja: ['週間報酬'] },
  { ko: '상점', en: ['Shop'], ja: ['ショップ'] },
  { ko: '행상인', en: ['Peddler'], ja: ['行商人'] },
  { ko: '미확인', en: ['Unidentified'], ja: ['未鑑定'] },
  { ko: '감정', en: ['Identify', 'Identified', 'Unidentified'], ja: ['鑑定'] },
  { ko: '광고 제거', en: ['Remove Ads', 'Ad-free', 'No Ads'], ja: ['広告削除', '広告なし'] },
  { ko: '설정', en: ['Settings', 'Setting'], ja: ['設定'], not: ['설정 뒤'] },
  { ko: '공지', en: ['Notice'], ja: ['お知らせ'] },
  { ko: '계정', en: ['Account'], ja: ['アカウント'] },
  { ko: '튜토리얼', en: ['Tutorial'], ja: ['チュートリアル'] },
  // 5-3 전투
  { ko: '마나', en: ['Mana'], ja: ['マナ'] },
  { ko: '피해', en: ['Damag', 'Dmg', 'DoT'], ja: ['ダメージ', '被ダメ', '被弾'] }, // damaging · 被弾 (맞으면) 도 같은 말
  { ko: '치유', en: ['Heal', 'HoT'], ja: ['回復'], not: ['순간 치유', '치유의 빛'] }, // 스킬 이름 · 그림 설명은 이름 사전
  { ko: '지속 치유', en: ['HoT', 'heal over time', 'heals over time', 'over time'], ja: ['継続回復'] },
  { ko: '보호막', en: ['Shield'], ja: ['バリア'] },
  { ko: '해제', en: ['Dispel', 'Unequip', 'Remove'], ja: ['ディスペル', '解除', '外す'] },
  { ko: '취소', en: ['Cancel'], ja: ['キャンセル', '取り消', '取消'] }, // 문장 안에서는 取り消す도 같은 말
  { ko: '질병', en: ['Disease'], ja: ['病気'] },
  { ko: '저주', en: ['Curse'], ja: ['呪い'] },
  { ko: '물리', en: ['Physical'], ja: ['物理'] },
  { ko: '기절', en: ['Stun'], ja: ['スタン'] },
  { ko: '강타', en: ['Tankbuster', 'Buster'], ja: ['タンクバスター', 'バスター'] },
  { ko: '장판', en: ['AoE'], ja: ['範囲攻撃', '範囲'] },
  { ko: '예고', en: ['Telegraph'], ja: ['予兆'] },
  { ko: '광폭화', en: ['Enrage'], ja: ['時間切れ'] },
  { ko: '쫄', en: ['Add'], ja: ['雑魚'] },
  { ko: '어그로', en: ['Threat', 'Aggro'], ja: ['ヘイト'] },
  { ko: '위협', en: ['Threat'], ja: ['ヘイト'] },
  { ko: '도발', en: ['Taunt'], ja: ['挑発'] },
  { ko: '끊기', en: ['Interrupt'], ja: ['中断'] },
  { ko: '시전', en: ['Cast'], ja: ['詠唱'] },
  { ko: '재사용 대기', en: ['Cooldown'], ja: ['リキャスト'], not: ['공통 재사용 대기'] }, // 공통 재사용 대기 = GCD · グローバルクールダウン (FF14 JP)
  { ko: '생존기', en: ['Defensive'], ja: ['防御スキル'] },
  { ko: '치명타', en: ['Critical', 'Crit'], ja: ['クリティカル'] },
  { ko: '회피', en: ['Dodge', 'Evasion'], ja: ['回避'] },
  { ko: '평타', en: ['Auto-attack', 'Auto Attack'], ja: ['オートアタック'] },
  { ko: '기믹', en: ['Mechanic'], ja: ['ギミック'] },
  { ko: '공략', en: ['Guide'], ja: ['攻略'] },
  { ko: '정비', en: ['Regroup'], ja: ['休憩'], not: ['마을 정비'] }, // 마을 정비 (로비) = Tend the Village · 村の手入れ
  { ko: '일시정지', en: ['Pause'], ja: ['一時停止'] },
  { ko: '전투 기록', en: ['Combat Log'], ja: ['戦闘ログ'] },
  { ko: '전투', en: ['Battle', 'Combat', 'Fight'], ja: ['戦闘', 'バトル'], not: ['전투 결과'] }, // 전투 결과 = Results · リザルト (결과 표)
  { ko: '감옥', en: ['Prison'], ja: ['牢獄'] },
  // 5-4 캐릭터 · 장비 · 특성
  { ko: '캐릭터', en: ['Character'], ja: ['キャラクター', 'キャラ'] },
  { ko: '특성', en: ['Talent'], ja: ['特性'] },
  { ko: '스킬', en: ['Skill'], ja: ['スキル'], not: ['치유 스킬의 회복량'] }, // healing done (WoW)
  { ko: '장비', en: ['Gear', 'Equip'], ja: ['装備'] }, // 착용 장비 = equipped
  { ko: '부위', en: ['Slot'], ja: ['部位'] },
  { ko: '등급', en: ['Rarity', 'Rarities'], ja: ['レアリティ'], not: ['등급 {g}'] }, // 결과 등급 S · A = Rank · 評価
  { ko: '희귀', en: ['Rare'], ja: ['レア'] },
  { ko: '전설', en: ['Legendary'], ja: ['レジェンダリー'] },
  { ko: '아이템 레벨', en: ['Item Level', 'iLv'], ja: ['アイテムレベル', 'iLv'] },
  { ko: '특수능력', en: ['Special Effect', 'Special'], ja: ['特殊効果'] },
  { ko: '고유 능력', en: ['Unique Effect', 'Unique'], ja: ['固有効果'] },
  { ko: '장착', en: ['Equip'], ja: ['装備'] },
  { ko: '판매', en: ['Sell', 'Sold', 'Sale'], ja: ['売却'] },
  { ko: '가방', en: ['Bag'], ja: ['バッグ'] },
  { ko: '장비 점수', en: ['Gear Score'], ja: ['装備スコア'] },
  { ko: '능력치', en: ['Stat'], ja: ['能力値'] },
  { ko: '맷집', en: ['Toughness'], ja: ['頑強'] },
  { ko: '방어', en: ['Defense', 'Defensive'], ja: ['防御'], not: ['방어구'] }, // 방어구 = Armor · 防具
  { ko: '발놀림', en: ['Footwork'], ja: ['足さばき'] },
  { ko: '위치 잡기', en: ['Positioning'], ja: ['位置取り'] },
  { ko: '협동', en: ['Teamwork'], ja: ['協調'] },
  { ko: '기술 숙련', en: ['Mastery'], ja: ['技量'] }, // 능력치 묶음 「기술」 = Technique · 技術 (#540)
  { ko: '반응', en: ['Reaction', 'React'], ja: ['反応'] },
  { ko: '침착', en: ['Composure'], ja: ['冷静'] },
  { ko: '판단', en: ['Judgment'], ja: ['判断'] },
  { ko: '집중', en: ['Focus'], ja: ['集中'], not: ['정신 집중'] }, // 정신 집중 = 채널링 (channel · チャネリング)
  { ko: '학습력', en: ['Learning'], ja: ['学習力'] },
  { ko: '꾸준함', en: ['Consistency'], ja: ['安定性'] },
  // 5-5 공통 UI
    { ko: '닫기', en: ['Close'], ja: ['閉じる'] },
  { ko: '받기', en: ['Claim'], ja: ['受け取', '受取'] },
  { ko: '나가기', en: ['Leave'], ja: ['退出'] },
  { ko: '잠금', en: ['Lock'], ja: ['ロック'] },
  { ko: '준비 중@content', en: ['Coming Soon'], ja: ['準備中'] }, // 장소 「준비 중」만. 편성의 준비 중 = Not Ready
  { ko: '언어', en: ['Language'], ja: ['言語'] },
  { ko: '보유', en: ['Owned', 'Have'], ja: ['所持'] },
  { ko: '부족', en: ['Not enough', 'short', 'out of'], ja: ['不足'] }, // {n} gold short · out of mana
];

/** 일부러 표와 다르게 쓰는 열쇠: 열쇠 → 까닭 (짧은 칸 · 문맥상 다른 뜻). 사전 열쇠 그대로 */
export const EXCEPT = {
  '{n} 부탁 · {p} 장소 보기': '{p}가 장소 이름',
  '주변 아군 보호와 지속 치유': 'heals nearby allies over time (문장을 나눔)',
  '치유의 빛이 모험길로 이어지는, 인물 없는 신전 풍경': '타이틀 그림 설명, 癒しの光 (시적 표현)',
  '스토어 연결 전 (Play Console·RevenueCat 설정 뒤)': '개발 빌드 글, 설정 = setup',
  '아직 준비 중입니다.': '편성 준비 (Not ready), 장소 준비 중@content와 다른 뜻',
  '💓 심장이 크게 뜀: 시전 · 집중 중인 힐이 끊기고 시전 스킬이 {s} 잠김': '집중 = 채널링 (channel), 능력치 집중 (Focus) 아님',
};

const hasEn = (text, forms) => forms.some(f => text.toLowerCase().includes(f.toLowerCase()));
const hasJa = (text, forms) => forms.some(f => text.includes(f));
/** 사전 하나를 검사해 어긋난 것 [{ key, term, text }] */
export function checkTerms(dict, lang) {
  const out = [];
  for (const [key, text] of Object.entries(dict)) {
    if (key in EXCEPT) continue;
    const base = key.replace(/@\w+$/, '');
    const hit = TERMS.filter(t => (t.ko.includes('@') ? key === t.ko || key.startsWith(t.ko) : base.includes(t.ko)) && !(t.not ?? []).some(n => base.includes(n)));
    for (const term of hit) {
      if (hit.some(o => o !== term && o.ko.includes(term.ko))) continue; // 긴 용어 (길드원 · 파티 편성) 가 맞으면 그 안의 짧은 용어는 안 봄
      const ok = lang === 'en' ? hasEn(text, term.en) : hasJa(text, term.ja);
      if (!ok) out.push({ key, term: term.ko, text });
    }
  }
  return out;
}
