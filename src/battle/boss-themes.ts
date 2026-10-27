/**
 * 보스 기술 → 떨어질 때 소리 (2026-10-21 Lim 「보스 기술 - 보스별로 스킬의 특성을 이용하여 개별적으로 효과음을 만들자」).
 * 키 = <대본>:<기술 key>, 값 = boss-<특성>-<방식> (특성: 기술 이름 · 보스를 보고 고름, 방식: 강타 hit · 광역 wave · 장판 ground).
 * 소리 문장은 scripts/sfx/boss.mjs. 표에 없는 기술 (새로 더한 기술)은 공통 착탄 (battle/combat-sound.ts impactSound)
 */
export const BOSS_SKILL_SOUND: Record<string, string> = {
  "baseurak74:scroll": 'boss-projectile-hit', // 두루마리 미라 사서 바스락 탐험판 · 신기루 두루마리 (111)
  "hwiparam82:snatch": 'boss-wind-hit', // 하피 교관 휘파람 탐험판 · 발톱 낚아채기 (111)
  "baseurak:scroll": 'boss-projectile-hit', // 두루마리 미라 사서 바스락 · 신기루 두루마리 (111)
  "mimic:thorns": 'boss-metal-wave', // 보물 상자 덥석이 · 가시 돋친 상자 (111)
  "beonjjeok:thorns": 'boss-metal-wave', // 코볼트 대장 번쩍이 · 가시 금화 갑옷 (111)
  "orben:drip": 'boss-frost-wave', // 대마도사 오르벤 · 서리 바람 (111)
  "abysslord:drip": 'boss-shadow-wave', // 심연의 군주 · 심연의 숨 (111)
  "butler13:tray": 'boss-metal-hit', // 집사 유령 · 쟁반 던지기 (111)
  "guardian23:buster": 'boss-earth-hit', // 신전 수호상 · 돌 주먹 (111)
  "crab36:wave": 'boss-water-wave', // 집게발 갑판장 · 거품 파도 (111 탐험 50% 구간)
  "peg38:hook": 'boss-metal-hit', // 밀수꾼 두목 외눈 페그 · 갈고리 당기기 (111 탐험 50% 구간)
  "goldbeard44:roar": 'boss-sound-wave', // 해적 선장 금빛수염 · 해적의 함성 (111 탐험 50% 구간)
  "polpol54:aoe": 'boss-wind-wave', // 밀가루 요정 폴폴 · 밀가루 바람 (111 탐험 50% 구간)
  "jigeul66:aoe": 'boss-fire-wave', // 용암 거북 지글이 · 용암 분출 (111 탐험 50% 구간)
  "knights68:pull": 'boss-water-hit', // 물그림자 기사 셋 · 깊은 물로 (111 탐험 50% 구간)
  "baseurak74:shelf1": 'boss-earth-ground', // 두루마리 미라 사서 바스락 · 책장 무너짐 (111 탐험 50% 구간)
  "hwirik:express": 'boss-wind-hit', // 하피 우체부 휘리릭 · 속달 돌풍 (111 탐험 50% 구간)
  "hoeori86:wall": 'boss-wind-ground', // 바람 정령 회오리 · 바람 장벽 (111 탐험 50% 구간)
  "boksul84:buster": 'boss-blunt-hit', // 번개 양 복슬이 · 머리 박치기 (111 탐험 50% 구간)
  "pongpong88:buster": 'boss-projectile-hit', // 실험 조교 퐁퐁이 · 플라스크 던지기 (111 탐험 50% 구간)
  "swit90:buster": 'boss-blunt-hit', // 사서 유령 쉿 · 두꺼운 장부 (111 탐험 50% 구간)
  "serena92:buster": 'boss-blunt-hit', // 유령 악단장 세레나 · 지휘봉 내려치기 (111 탐험 50% 구간)
  "nokseul96:buster": 'boss-metal-hit', // 그림자 대여상 녹슬음 · 저울추 (111 탐험 50% 구간)
  "lastecho97:buster": 'boss-holy-hit', // 마지막 메아리 · 빛 손바닥 (111 탐험 50% 구간)
  "abyssheart:beat": 'boss-shadow-wave', // 심연의 심장 · 크게 뛰기
  "abyssheart:buster": 'boss-nature-hit', // 심연의 심장 · 뿌리 채찍
  "abyssheart:fast0": 'boss-shadow-ground', // 심연의 심장 · 빨라지는 박동
  "abyssheart:fast1": 'boss-shadow-ground', // 심연의 심장 · 빨라지는 박동
  "abyssheart:fast2": 'boss-shadow-ground', // 심연의 심장 · 빨라지는 박동
  "abyssheart:pulse0": 'boss-shadow-ground', // 심연의 심장 · 퍼지는 박동
  "abyssheart:pulse1": 'boss-shadow-ground', // 심연의 심장 · 퍼지는 박동
  "abyssheart:pulse2": 'boss-shadow-ground', // 심연의 심장 · 퍼지는 박동
  "abyssheart:surge": 'boss-water-ground', // 심연의 심장 · 해일 박자
  "abyssheart:tide": 'boss-water-ground', // 심연의 심장 · 어둠물 박자
  "abyssheart:wedge0": 'boss-lightning-hit', // 심연의 심장 · 번개 쐐기
  "abyssheart:wedge1": 'boss-lightning-hit', // 심연의 심장 · 번개 쐐기
  "abyssheart:wedge2": 'boss-lightning-hit', // 심연의 심장 · 번개 쐐기
  "abysslord:buster": 'boss-shadow-hit', // 심연의 군주 · 심연의 손길
  "abysslord:collapse": 'boss-earth-ground', // 심연의 군주 · 첨탑 붕괴
  "abysslord:wave": 'boss-shadow-wave', // 심연의 군주 · 그림자 파동
  "abysslord:wave3": 'boss-shadow-wave', // 심연의 군주 · 그림자 파동
  "amanita:buster": 'boss-blunt-hit', // 버섯 여왕 아마니타 · 여왕의 홀
  "amanita:waltz": 'boss-poison-wave', // 버섯 여왕 아마니타 · 포자 왈츠
  "bamgeuneul:buster": 'boss-earth-hit', // 미궁의 주인 밤그늘 · 벽 손아귀
  "bamgeuneul:squeeze": 'boss-earth-wave', // 미궁의 주인 밤그늘 · 미궁 수축
  "banjjak:buster": 'boss-earth-hit', // 수정 거인 반짝돌 · 수정 주먹
  "banjjak:prism": 'boss-holy-hit', // 수정 거인 반짝돌 · 프리즘 빛
  "banjjak:quake": 'boss-earth-wave', // 수정 거인 반짝돌 · 땅 울림
  "banjjak99:buster": 'boss-earth-hit', // 수정 거인 반짝돌 · 수정 주먹
  "banjjak99:prism": 'boss-holy-hit', // 수정 거인 반짝돌 · 프리즘 빛
  "baseurak:buster": 'boss-blunt-hit', // 두루마리 미라 사서 바스락 · 두루마리 내려치기
  "baseurak:dust": 'boss-wind-wave', // 두루마리 미라 사서 바스락 · 먼지 바람
  "baseurak:shelf0": 'boss-earth-ground', // 두루마리 미라 사서 바스락 · 책장 무너짐
  "baseurak:shelf1": 'boss-earth-ground', // 두루마리 미라 사서 바스락 · 책장 무너짐
  "baseurak74:buster": 'boss-blunt-hit', // 두루마리 미라 사서 바스락 · 두루마리 내려치기
  "baseurak74:dust": 'boss-wind-wave', // 두루마리 미라 사서 바스락 · 먼지 바람
  "baseurak74:shelf0": 'boss-earth-ground', // 두루마리 미라 사서 바스락 · 책장 무너짐
  "belmore:buster": 'boss-blade-hit', // 장원 주인 벨모어 경 · 지팡이 칼
  "beonjjeok:buster": 'boss-blunt-hit', // 코볼트 대장 번쩍이 · 왕관 박치기
  "beonjjeok:greed1": 'boss-metal-hit', // 코볼트 대장 번쩍이 · 내 거야!
  "beonjjeok:greed1m": 'boss-metal-hit', // 코볼트 대장 번쩍이 · 내 거야!
  "beonjjeok:greed2": 'boss-metal-hit', // 코볼트 대장 번쩍이 · 내 거야!
  "beonjjeok:greed2m": 'boss-metal-hit', // 코볼트 대장 번쩍이 · 내 거야!
  "beonjjeok:rain": 'boss-metal-wave', // 코볼트 대장 번쩍이 · 보물 비
  "bichumi:hush": 'boss-sound-wave', // 거울 사서 비추미 · 조용히!
  "bichumi:shelf": 'boss-arcane-hit', // 거울 사서 비추미 · 거울 책장
  "bitgallae:buster": 'boss-blade-hit', // 수정 마녀 빛갈래 · 수정 손톱
  "bitgallae:fork": 'boss-lightning-hit', // 수정 마녀 빛갈래 · 갈래 번개
  "bitgallae:greed": 'boss-earth-hit', // 수정 마녀 빛갈래 · 수정 욕심
  "bitgallae:prism": 'boss-holy-wave', // 수정 마녀 빛갈래 · 프리즘 폭발
  "boksul:bolt": 'boss-lightning-hit', // 번개 양 복슬이 · 번개 털
  "boksul:buster": 'boss-blunt-hit', // 번개 양 복슬이 · 머리 박치기
  "boksul:fluff": 'boss-lightning-wave', // 번개 양 복슬이 · 구름 털 뭉치
  "boksul84:bolt": 'boss-lightning-hit', // 번개 양 복슬이 · 번개 털
  "boksul84:fluff": 'boss-lightning-wave', // 번개 양 복슬이 · 구름 털 뭉치
  "bulttung:buster": 'boss-beast-hit', // 사춘기 용 불퉁이 · 꼬리 철썩
  "bulttung:fire0": 'boss-fire-ground', // 사춘기 용 불퉁이 · 줄 불길
  "bulttung:fire1": 'boss-fire-ground', // 사춘기 용 불퉁이 · 줄 불길
  "bulttung:fire2": 'boss-fire-ground', // 사춘기 용 불퉁이 · 줄 불길
  "bulttung:greed1": 'boss-beast-hit', // 사춘기 용 불퉁이 · 반짝이 내놔!
  "bulttung:greed1m": 'boss-beast-hit', // 사춘기 용 불퉁이 · 반짝이 내놔!
  "bulttung:greed2": 'boss-beast-hit', // 사춘기 용 불퉁이 · 반짝이 내놔!
  "bulttung:greed2m": 'boss-beast-hit', // 사춘기 용 불퉁이 · 반짝이 내놔!
  "bungbung:buster": 'boss-blade-hit', // 꿀벌 근위대장 붕붕 · 창 찌르기
  "bungbung:wind": 'boss-wind-wave', // 꿀벌 근위대장 붕붕 · 날갯짓 바람
  "buri:box": 'boss-metal-wave', // 우체국장 하피 부리부리 · 우편함 받침
  "buri:boxm": 'boss-metal-wave', // 우체국장 하피 부리부리 · 우편함 받침
  "buri:buster": 'boss-blunt-hit', // 우체국장 하피 부리부리 · 도장 찍기
  "buri:padlift": 'boss-wind-hit', // 우체국장 하피 부리부리 · 받침 위 반송
  "buri:return": 'boss-wind-hit', // 우체국장 하피 부리부리 · 반송 돌풍
  "buri:storm": 'boss-wind-wave', // 우체국장 하피 부리부리 · 편지 폭풍
  "butler:bow": 'boss-shadow-ground', // 집사 유령 · 등 뒤 인사
  "butler:buster": 'boss-metal-hit', // 집사 유령 · 은쟁반
  "butler:candle": 'boss-fire-ground', // 집사 유령 · 촛불
  "butler13:buster": 'boss-metal-hit', // 집사 유령 · 은쟁반
  "carrier:aoe": 'boss-poison-wave', // 역병 운반자 · 초록 물 쏟기
  "carrier:buster": 'boss-blunt-hit', // 역병 운반자 · 물통 내려치기
  "chalrang:buster": 'boss-blade-hit', // 해파리 기사 찰랑 · 진주 창
  "chalrang:omen0": 'boss-water-ground', // 해파리 기사 찰랑 · 해파리 점괘
  "chalrang:omen1": 'boss-water-ground', // 해파리 기사 찰랑 · 해파리 점괘
  "chalrang:zap": 'boss-lightning-hit', // 해파리 기사 찰랑 · 찌릿 쏘기
  "cheolbeok:aoe": 'boss-earth-wave', // 진흙 정령 철벅이 · 진흙 덮치기
  "cheolbeok:buster": 'boss-earth-hit', // 진흙 정령 철벅이 · 진흙 주먹
  "cheolbeok:puddle": 'boss-earth-ground', // 진흙 정령 철벅이 · 진흙 웅덩이
  "chilheuk:bolt": 'boss-lightning-hit', // 심연 기사단장 칠흑 · 신기루 번개
  "chilheuk:buster": 'boss-blade-hit', // 심연 기사단장 칠흑 · 대검 내려치기
  "chilheuk:charge": 'boss-blunt-wave', // 심연 기사단장 칠흑 · 전군 돌격
  "chilheuk:glass": 'boss-arcane-wave', // 심연 기사단장 칠흑 · 모래 군기
  "chilheuk:march": 'boss-blunt-wave', // 심연 기사단장 칠흑 · 광폭 진군
  "chilheuk:orderbolt": 'boss-lightning-hit', // 심연 기사단장 칠흑 · 차례 번개
  "chingching:aoe": 'boss-nature-wave', // 온실지기 덩굴 골렘 칭칭이 · 꽃가루 바람
  "chingching:buster": 'boss-nature-hit', // 온실지기 덩굴 골렘 칭칭이 · 줄기 후려치기
  "choir:baton": 'boss-blunt-hit', // 유령 성가대 · 지휘봉
  "choir:crescendo": 'boss-sound-ground', // 유령 성가대 · 크레센도
  "choir:forte": 'boss-sound-wave', // 유령 성가대 · 포르테
  "chulleong:buster": 'boss-water-hit', // 두레박 정령 출렁이 · 두레박 내려치기
  "chulleong:quake": 'boss-water-wave', // 두레박 정령 출렁이 · 우물 울림
  "chulleong:splash0": 'boss-water-ground', // 두레박 정령 출렁이 · 물보라
  "chulleong:splash1": 'boss-water-ground', // 두레박 정령 출렁이 · 물보라
  "chulleong:splash2": 'boss-water-ground', // 두레박 정령 출렁이 · 물보라
  "chulleong:splash3": 'boss-water-ground', // 두레박 정령 출렁이 · 물보라
  "collector:aoe": 'boss-fire-wave', // 뼈다귀 수집가 · 등불 흔들기
  "collector:buster": 'boss-metal-hit', // 뼈다귀 수집가 · 갈고리 내려치기
  "collector:pull": 'boss-metal-hit', // 뼈다귀 수집가 · 갈고리 끌기
  "collector3:aoe": 'boss-fire-wave', // 뼈다귀 수집가 · 등불 흔들기
  "collector3:pull": 'boss-metal-hit', // 뼈다귀 수집가 · 갈고리 끌기
  "cook:buster": 'boss-blunt-hit', // 해적 요리사 왕솥 · 국자 내려치기
  "cook:soup": 'boss-water-ground', // 해적 요리사 왕솥 · 끓어 넘치는 수프
  "crab:buster": 'boss-beast-hit', // 집게발 갑판장 · 집게 조이기
  "crab:wave": 'boss-water-wave', // 집게발 갑판장 · 거품 파도
  "crab36:buster": 'boss-beast-hit', // 집게발 갑판장 · 집게 조이기
  "crystal:buster": 'boss-sound-hit', // 금 간 공명 수정 · 금 간 울림
  "crystal:quake": 'boss-sound-wave', // 금 간 공명 수정 · 수정 진동
  "dandani:charge": 'boss-blunt-hit', // 용 비늘 경비대장 단단이 · 비늘 방패 돌진
  "dandani:fire0": 'boss-fire-ground', // 용 비늘 경비대장 단단이 · 줄 불길
  "dandani:fire0b": 'boss-fire-ground', // 용 비늘 경비대장 단단이 · 줄 불길
  "dandani:fire1": 'boss-fire-ground', // 용 비늘 경비대장 단단이 · 줄 불길
  "dandani:fire1b": 'boss-fire-ground', // 용 비늘 경비대장 단단이 · 줄 불길
  "dandani:fire2": 'boss-fire-ground', // 용 비늘 경비대장 단단이 · 줄 불길
  "dandani:fire2b": 'boss-fire-ground', // 용 비늘 경비대장 단단이 · 줄 불길
  "degul:buster": 'boss-beast-hit', // 시간지기 풍뎅이 데굴이 · 뿔 박치기
  "degul:glass": 'boss-arcane-wave', // 시간지기 풍뎅이 데굴이 · 모래시계 뒤집기
  "degul:roll": 'boss-blunt-wave', // 시간지기 풍뎅이 데굴이 · 데굴데굴
  "degul:roll2": 'boss-blunt-wave', // 시간지기 풍뎅이 데굴이 · 데굴데굴
  "degul:rollm": 'boss-blunt-wave', // 시간지기 풍뎅이 데굴이 · 데굴데굴
  "degul:rollm2": 'boss-blunt-wave', // 시간지기 풍뎅이 데굴이 · 데굴데굴
  "deolkeong:cart": 'boss-metal-ground', // 코볼트 수레꾼 덜컹이 · 보물 수레
  "deolkeong:cartm": 'boss-metal-ground', // 코볼트 수레꾼 덜컹이 · 보물 수레
  "deolkeong:coin": 'boss-metal-hit', // 코볼트 수레꾼 덜컹이 · 금화 던지기
  "doeul:arrow": 'boss-projectile-hit', // 심연의 메아리 되울림 · 메아리 화살
  "doeul:buster": 'boss-shadow-hit', // 심연의 메아리 되울림 · 그림자 손바닥
  "doeul:deep": 'boss-water-wave', // 심연의 메아리 되울림 · 심연의 물결
  "doeul:glass": 'boss-sound-wave', // 심연의 메아리 되울림 · 거꾸로 메아리
  "doeul:wave": 'boss-sound-wave', // 심연의 메아리 되울림 · 메아리 파도
  "doeul:wave2": 'boss-sound-wave', // 심연의 메아리 되울림 · 메아리 파도
  "dolgae:buster": 'boss-wind-hit', // 풍차지기 하피 돌개 · 날개 후려치기
  "dolgae:gust": 'boss-wind-hit', // 풍차지기 하피 돌개 · 돌개바람
  "dolgae:gust2": 'boss-wind-hit', // 풍차지기 하피 돌개 · 돌개바람
  "dolgae:mill": 'boss-lightning-hit', // 풍차지기 하피 돌개 · 방아 번개
  "dooldool:buster": 'boss-metal-hit', // 붕대 집사 둘둘이 · 다리미 내려치기
  "dooldool:glass": 'boss-arcane-wave', // 붕대 집사 둘둘이 · 집사의 모래시계
  "dooldool:glassm": 'boss-arcane-wave', // 붕대 집사 둘둘이 · 집사의 모래시계
  "dooldool:hush": 'boss-sound-wave', // 붕대 집사 둘둘이 · 조용히!
  "dungdung:buster": 'boss-sound-hit', // 천둥 북 거인 둥둥이 · 북채 내려치기
  "dungdung:drum": 'boss-sound-wave', // 천둥 북 거인 둥둥이 · 천둥 북
  "dungdung:roll": 'boss-lightning-hit', // 천둥 북 거인 둥둥이 · 번개 북소리
  "dwijuk:buster": 'boss-blunt-hit', // 엉뚱 교장 뒤죽박죽 · 지팡이 딱밤
  "dwijuk:chalk": 'boss-projectile-wave', // 엉뚱 교장 뒤죽박죽 · 분필 폭풍
  "dwijuk:levit": 'boss-arcane-hit', // 엉뚱 교장 뒤죽박죽 · 공중 부양 수업
  "dwijuk:levit2": 'boss-arcane-hit', // 엉뚱 교장 뒤죽박죽 · 공중 부양 수업
  "eodugi:beat": 'boss-shadow-wave', // 그림자 장군 어둑이 · 심연의 고동
  "eodugi:bolt": 'boss-lightning-hit', // 그림자 장군 어둑이 · 그림자 번개
  "eodugi:buster": 'boss-blade-hit', // 그림자 장군 어둑이 · 그림자 창
  "eodugi:glass": 'boss-arcane-wave', // 그림자 장군 어둑이 · 그림자 모래시계
  "eodugi:gust": 'boss-wind-hit', // 그림자 장군 어둑이 · 그림자 돌풍
  "eodugi:wave": 'boss-water-wave', // 그림자 장군 어둑이 · 그림자 파도
  "eodugi:wave2": 'boss-water-wave', // 그림자 장군 어둑이 · 그림자 파도
  "eomgyeok:buster": 'boss-blunt-hit', // 사감 마도사 엄격이 · 지휘봉 딱
  "eomgyeok:homework": 'boss-blast-wave', // 사감 마도사 엄격이 · 숙제 폭탄
  "eomgyeok:hush": 'boss-sound-wave', // 사감 마도사 엄격이 · 조용히!
  "eonggeum:bog0": 'boss-earth-ground', // 보물고 거북 엉금이 · 모래 늪
  "eonggeum:bog1": 'boss-earth-ground', // 보물고 거북 엉금이 · 모래 늪
  "eonggeum:ram": 'boss-blunt-hit', // 보물고 거북 엉금이 · 등껍질 박치기
  "eonggeum:ramm": 'boss-blunt-hit', // 보물고 거북 엉금이 · 등껍질 박치기
  "eonggeum:ramm2": 'boss-blunt-hit', // 보물고 거북 엉금이 · 등껍질 박치기
  "eongkim:buster": 'boss-nature-hit', // 뿌리 수호자 얽힘 · 뿌리 휘두르기
  "eongkim:shake": 'boss-nature-wave', // 뿌리 수호자 얽힘 · 다리 흔들기
  "frostgolem:buster": 'boss-blunt-hit', // 마력 골렘 · 룬 주먹
  "frostgolem:core": 'boss-arcane-wave', // 마력 골렘 · 수정 핵 과열
  "frostgolem:quake": 'boss-arcane-wave', // 마력 골렘 · 룬 진동
  "frostgolem:quake2": 'boss-arcane-wave', // 마력 골렘 · 룬 진동
  "gaegul:buster": 'boss-water-hit', // 개구리 사공 개굴 · 물갈퀴 철썩
  "gaegul:croak": 'boss-sound-wave', // 개구리 사공 개굴 · 개굴개굴 합창
  "gaegul:splash": 'boss-water-ground', // 개구리 사공 개굴 · 연잎 물보라
  "gaegul:tongue": 'boss-beast-hit', // 개구리 사공 개굴 · 혀 낚아채기
  "gaegul:tongue2": 'boss-beast-hit', // 개구리 사공 개굴 · 혀 낚아채기
  "garnet:breath0": 'boss-fire-ground', // 붉은 용 큰언니 가넷 · 불꽃 숨결
  "garnet:breath0b": 'boss-fire-ground', // 붉은 용 큰언니 가넷 · 불꽃 숨결
  "garnet:breath1": 'boss-fire-ground', // 붉은 용 큰언니 가넷 · 불꽃 숨결
  "garnet:breath1b": 'boss-fire-ground', // 붉은 용 큰언니 가넷 · 불꽃 숨결
  "garnet:breath2": 'boss-fire-ground', // 붉은 용 큰언니 가넷 · 불꽃 숨결
  "garnet:breath2b": 'boss-fire-ground', // 붉은 용 큰언니 가넷 · 불꽃 숨결
  "garnet:buster": 'boss-beast-hit', // 붉은 용 큰언니 가넷 · 발톱 할퀴기
  "garnet:greed": 'boss-beast-hit', // 붉은 용 큰언니 가넷 · 내 보석이야!
  "garnet:wing": 'boss-wind-hit', // 붉은 용 큰언니 가넷 · 날개 바람
  "gawison:buster": 'boss-blade-hit', // 정원사 유령 가위손 · 큰 가위 싹둑
  "gawison:prune0": 'boss-blade-ground', // 정원사 유령 가위손 · 가지치기
  "gawison:prune1": 'boss-blade-ground', // 정원사 유령 가위손 · 가지치기
  "gawison:prune2": 'boss-blade-ground', // 정원사 유령 가위손 · 가지치기
  "gawison94:buster": 'boss-blade-hit', // 정원사 유령 가위손 · 큰 가위 싹둑
  "geomeun:buster": 'boss-water-hit', // 어둠물 여왕 검은물결 · 물의 채찍
  "geomeun:rain": 'boss-water-wave', // 어둠물 여왕 검은물결 · 검은 비
  "geomeun:surge": 'boss-water-ground', // 어둠물 여왕 검은물결 · 해일
  "geomeun:tide": 'boss-water-ground', // 어둠물 여왕 검은물결 · 소용돌이 밀물
  "geopum:boil": 'boss-poison-wave', // 약품 수도사 거품이 · 끓어오름
  "geopum:buster": 'boss-blunt-hit', // 약품 수도사 거품이 · 약병 내려치기
  "geopum46:boil": 'boss-poison-wave', // 약품 수도사 거품이 · 끓어오름
  "geopum46:buster": 'boss-blunt-hit', // 약품 수도사 거품이 · 약병 내려치기
  "geumeum:buster": 'boss-blunt-hit', // 미궁 파수꾼 그믐 · 문지기 강타
  "geumeum:spear": 'boss-blade-wave', // 미궁 파수꾼 그믐 · 그림자 창
  "geuneul:buster": 'boss-blade-hit', // 해시계 관리인 유령 그늘지기 · 그림자 낫질
  "geuneul:glass": 'boss-arcane-wave', // 해시계 관리인 유령 그늘지기 · 거꾸로 해시계
  "geuneul:shade": 'boss-shadow-wave', // 해시계 관리인 유령 그늘지기 · 그늘 광역
  "gipeun:beat": 'boss-sound-wave', // 심연 수도원장 깊은잠 · 심장 박동
  "gipeun:buster": 'boss-blunt-hit', // 심연 수도원장 깊은잠 · 지팡이 내려치기
  "gipeun:deep0": 'boss-water-ground', // 심연 수도원장 깊은잠 · 깊은 물 장판
  "gipeun:deep1": 'boss-water-ground', // 심연 수도원장 깊은잠 · 깊은 물 장판
  "gipeun:deep2": 'boss-water-ground', // 심연 수도원장 깊은잠 · 깊은 물 장판
  "gitpen:buster": 'boss-blade-hit', // 모래 서기관 깃펜 · 깃펜 찌르기
  "gitpen:ink": 'boss-water-wave', // 모래 서기관 깃펜 · 잉크 쏟기
  "gitpen:quill": 'boss-arcane-hit', // 모래 서기관 깃펜 · 신기루 깃펜
  "gitpen:rewind": 'boss-arcane-wave', // 모래 서기관 깃펜 · 되감는 모래
  "gitpen78:buster": 'boss-blade-hit', // 모래 서기관 깃펜 · 깃펜 찌르기
  "gitpen78:ink": 'boss-water-wave', // 모래 서기관 깃펜 · 잉크 쏟기
  "gitpen78:quill": 'boss-arcane-ground', // 모래 서기관 깃펜 · 신기루 깃펜
  "gitpen78:rewind": 'boss-arcane-wave', // 모래 서기관 깃펜 · 되감는 모래
  "goldbeard:buster": 'boss-blade-hit', // 해적 선장 금빛수염 · 금도끼
  "goldbeard:cannon0": 'boss-metal-ground', // 해적 선장 금빛수염 · 보물 지도 포격
  "goldbeard:cannon1": 'boss-metal-ground', // 해적 선장 금빛수염 · 보물 지도 포격
  "goldbeard:cannon2": 'boss-metal-ground', // 해적 선장 금빛수염 · 보물 지도 포격
  "goldbeard:goldrain": 'boss-metal-wave', // 해적 선장 금빛수염 · 금화 비
  "goldbeard:roar": 'boss-sound-wave', // 해적 선장 금빛수염 · 해적의 함성
  "goldbeard44:buster": 'boss-blade-hit', // 해적 선장 금빛수염 · 금도끼
  "golem18:buster": 'boss-blunt-hit', // 마력 골렘 · 룬 주먹
  "golem18:quake": 'boss-arcane-wave', // 마력 골렘 · 룬 진동
  "guardian:buster": 'boss-earth-hit', // 신전 수호상 · 돌 주먹
  "guardian:gleam": 'boss-earth-wave', // 신전 수호상 · 수정 반짝임
  "gulgul:bolt": 'boss-lightning-hit', // 수정 두더지 굴굴이 · 수정 번개
  "gulgul:buster": 'boss-blade-hit', // 수정 두더지 굴굴이 · 곡괭이 찍기
  "gulgul:dig0": 'boss-earth-ground', // 수정 두더지 굴굴이 · 땅파기
  "gulgul:dig1": 'boss-earth-ground', // 수정 두더지 굴굴이 · 땅파기
  "gulgul:dig2": 'boss-earth-ground', // 수정 두더지 굴굴이 · 땅파기
  "gunner:broadside0": 'boss-metal-ground', // 포수장 쾅쾅 · 옆구리 포격
  "gunner:broadside0b": 'boss-metal-ground', // 포수장 쾅쾅 · 옆구리 포격
  "gunner:broadside1": 'boss-metal-ground', // 포수장 쾅쾅 · 옆구리 포격
  "gunner:broadside1b": 'boss-metal-ground', // 포수장 쾅쾅 · 옆구리 포격
  "gunner:broadside2": 'boss-metal-ground', // 포수장 쾅쾅 · 옆구리 포격
  "gunner:broadside2b": 'boss-metal-ground', // 포수장 쾅쾅 · 옆구리 포격
  "gunner:buster": 'boss-metal-hit', // 포수장 쾅쾅 · 꽂을대 찌르기
  "gurit:buster": 'boss-blade-hit', // 광산 감독관 구릿빛 · 채찍질
  "gurit:cart0": 'boss-metal-ground', // 광산 감독관 구릿빛 · 광차 돌진
  "gurit:cart0b": 'boss-metal-ground', // 광산 감독관 구릿빛 · 광차 돌진
  "gurit:cart1": 'boss-metal-ground', // 광산 감독관 구릿빛 · 광차 돌진
  "gurit:cart1b": 'boss-metal-ground', // 광산 감독관 구릿빛 · 광차 돌진
  "gurit:cart2": 'boss-metal-ground', // 광산 감독관 구릿빛 · 광차 돌진
  "gurit:cart2b": 'boss-metal-ground', // 광산 감독관 구릿빛 · 광차 돌진
  "hapum:bigyawn": 'boss-sound-wave', // 모래 왕 하품호텝 · 천 년 하품
  "hapum:buster": 'boss-blunt-hit', // 모래 왕 하품호텝 · 왕홀 내려치기
  "hapum:busterm": 'boss-blunt-hit', // 모래 왕 하품호텝 · 왕홀 내려치기
  "hapum:glass": 'boss-arcane-wave', // 모래 왕 하품호텝 · 왕의 모래시계
  "hapum:storm": 'boss-wind-ground', // 모래 왕 하품호텝 · 신기루 모래 폭풍
  "hatter:aoe": 'boss-arcane-wave', // 모자 장수 해롱 · 자리 바꿔!
  "hatter:buster": 'boss-blunt-hit', // 모자 장수 해롱 · 지팡이 휘두르기
  "hatter:quake": 'boss-arcane-wave', // 모자 장수 해롱 · 늦었다, 늦었어!
  "heartshard100:beat": 'boss-shadow-wave', // 심장 조각 · 크게 뛰기
  "heartshard100:pulse0": 'boss-shadow-ground', // 심장 조각 · 퍼지는 박동
  "heartshard100:pulse1": 'boss-shadow-ground', // 심장 조각 · 퍼지는 박동
  "heartshard100:pulse2": 'boss-shadow-ground', // 심장 조각 · 퍼지는 박동
  "heartshard100:tide": 'boss-water-ground', // 심장 조각 · 어둠물 박자
  "heukbaek:buster": 'boss-blade-hit', // 심연 쌍둥이 기사 흑 · 백 · 쌍검 내려치기
  "heukbaek:pulse0": 'boss-shadow-ground', // 심연 쌍둥이 기사 흑 · 백 · 퍼지는 박동
  "heukbaek:pulse1": 'boss-shadow-ground', // 심연 쌍둥이 기사 흑 · 백 · 퍼지는 박동
  "heukbaek:pulse2": 'boss-shadow-ground', // 심연 쌍둥이 기사 흑 · 백 · 퍼지는 박동
  "heumul:quake": 'boss-water-wave', // 해파리 정원사 흐물이 · 물방울 진동
  "heumul72:quake": 'boss-water-wave', // 해파리 정원사 흐물이 · 물방울 진동
  "hoeori:bolt": 'boss-lightning-hit', // 바람 정령 회오리 · 연쇄 번개
  "hoeori:buster": 'boss-wind-hit', // 바람 정령 회오리 · 돌풍 주먹
  "hoeori:wall": 'boss-wind-ground', // 바람 정령 회오리 · 바람 장벽
  "hoeori:whirl": 'boss-wind-hit', // 바람 정령 회오리 · 회오리
  "hoeori86:bolt": 'boss-lightning-hit', // 바람 정령 회오리 · 연쇄 번개
  "hoeori86:buster": 'boss-wind-hit', // 바람 정령 회오리 · 돌풍 주먹
  "hoeori86:whirl": 'boss-wind-hit', // 바람 정령 회오리 · 회오리
  "hokdol:buster": 'boss-projectile-hit', // 향신료 낙타 상인 혹돌이 · 낙타 침 퉤
  "hokdol:pile": 'boss-arcane-ground', // 향신료 낙타 상인 혹돌이 · 신기루 짐더미
  "huggeun:spark": 'boss-fire-wave', // 풀무 골렘 후끈이 · 불티
  "huu:beat": 'boss-sound-wave', // 심장의 숨 후우 · 심장 박동
  "huu:buster": 'boss-wind-hit', // 심장의 숨 후우 · 숨결 손바닥
  "huu:exhale": 'boss-wind-wave', // 심장의 숨 후우 · 큰 날숨
  "huu:exhalem": 'boss-wind-wave', // 심장의 숨 후우 · 큰 날숨
  "huu:inhale": 'boss-wind-hit', // 심장의 숨 후우 · 깊은 들숨
  "hwalhwal:aoe": 'boss-sound-wave', // 불도마뱀 조련사 활활 · 조련사 호령
  "hwalhwal:breath0": 'boss-fire-ground', // 불도마뱀 조련사 활활 · 불꽃 숨
  "hwalhwal:breath1": 'boss-fire-ground', // 불도마뱀 조련사 활활 · 불꽃 숨
  "hwalhwal:breath2": 'boss-fire-ground', // 불도마뱀 조련사 활활 · 불꽃 숨
  "hwalhwal:buster": 'boss-fire-hit', // 불도마뱀 조련사 활활 · 불 채찍
  "hwigami:bolt": 'boss-lightning-hit', // 심연 장어왕 휘감이 · 전기 비늘
  "hwigami:buster": 'boss-beast-hit', // 심연 장어왕 휘감이 · 이빨
  "hwigami:drag": 'boss-beast-hit', // 심연 장어왕 휘감이 · 휘감기
  "hwigami:tide": 'boss-water-ground', // 심연 장어왕 휘감이 · 물길 밀물
  "hwiparam:buster": 'boss-beast-hit', // 하피 교관 휘파람 · 발톱 할퀴기
  "hwiparam:dive0": 'boss-wind-ground', // 하피 교관 휘파람 · 급강하
  "hwiparam:dive1": 'boss-wind-ground', // 하피 교관 휘파람 · 급강하
  "hwiparam:dive2": 'boss-wind-ground', // 하피 교관 휘파람 · 급강하
  "hwiparam:lift": 'boss-wind-hit', // 하피 교관 휘파람 · 띄워 올리기
  "hwiparam82:buster": 'boss-beast-hit', // 하피 교관 휘파람 · 발톱 할퀴기
  "hwiparam82:lift": 'boss-wind-hit', // 하피 교관 휘파람 · 띄워 올리기
  "hwirik:gust": 'boss-wind-hit', // 하피 우체부 휘리릭 · 돌풍
  "hwirik83:buster": 'boss-beast-hit', // 하피 우체부 휘리릭 · 부리 쪼기
  "hwirik83:express": 'boss-wind-hit', // 하피 우체부 휘리릭 · 속달 돌풍
  "hydra:acid": 'boss-poison-ground', // 늪의 어머니 히드라 · 산성 토사
  "hydra:buster": 'boss-beast-hit', // 늪의 어머니 히드라 · 물어뜯기
  "hydra:sink": 'boss-earth-ground', // 늪의 어머니 히드라 · 늪에 잠김
  "hydra:spew": 'boss-poison-wave', // 늪의 어머니 히드라 · 독안개 분출
  "icia:aoe": 'boss-frost-wave', // 서리 연구원 아이시아 · 서리 폭발
  "icia:buster": 'boss-frost-hit', // 서리 연구원 아이시아 · 얼음 송곳
  "janmul:big": 'boss-water-ground', // 어둠물 뱃사공 잔물결 · 큰 밀물
  "janmul:buster": 'boss-blunt-hit', // 어둠물 뱃사공 잔물결 · 노 내려치기
  "janmul:row": 'boss-water-wave', // 어둠물 뱃사공 잔물결 · 노 젓는 소리
  "janmul:tide": 'boss-water-ground', // 어둠물 뱃사공 잔물결 · 물결 밀물
  "jigeul:aoe": 'boss-fire-wave', // 용암 거북 지글이 · 용암 분출
  "jigeul:buster": 'boss-blunt-hit', // 용암 거북 지글이 · 박치기
  "jigeul:shell1": 'boss-fire-wave', // 용암 거북 지글이 · 등껍질 반격
  "jigeul:shell1m": 'boss-fire-wave', // 용암 거북 지글이 · 등껍질 반격
  "jigeul:shell2": 'boss-fire-wave', // 용암 거북 지글이 · 등껍질 반격
  "jigeul:shell2m": 'boss-fire-wave', // 용암 거북 지글이 · 등껍질 반격
  "jigeul66:buster": 'boss-blunt-hit', // 용암 거북 지글이 · 박치기
  "jigeul66:shell": 'boss-fire-wave', // 용암 거북 지글이 · 등껍질 반격
  "jiji:aoe": 'boss-frost-wave', // 견습생 쌍둥이 지지 · 직직 · 쌍둥이 얼음비
  "jiji42:aoe": 'boss-frost-wave', // 견습생 쌍둥이 지지 · 직직 · 쌍둥이 얼음비
  "jilpung:buster": 'boss-blade-hit', // 그림자 기병대장 질풍 · 창 찌르기
  "jilpung:charge0": 'boss-beast-ground', // 그림자 기병대장 질풍 · 기병 돌격
  "jilpung:charge0b": 'boss-beast-ground', // 그림자 기병대장 질풍 · 기병 돌격
  "jilpung:charge1": 'boss-beast-ground', // 그림자 기병대장 질풍 · 기병 돌격
  "jilpung:charge1b": 'boss-beast-ground', // 그림자 기병대장 질풍 · 기병 돌격
  "jilpung:charge2": 'boss-beast-ground', // 그림자 기병대장 질풍 · 기병 돌격
  "jilpung:charge2b": 'boss-beast-ground', // 그림자 기병대장 질풍 · 기병 돌격
  "jilpung:hoof": 'boss-beast-wave', // 그림자 기병대장 질풍 · 말발굽 진동
  "jipdan:buster": 'boss-blade-hit', // 허수아비 기사 짚단 · 낫 내려치기
  "jipdan:crows": 'boss-beast-hit', // 허수아비 기사 짚단 · 까마귀 떼
  "jipdan:scythe0": 'boss-blade-ground', // 허수아비 기사 짚단 · 낫 휘두르기
  "jipdan:scythe1": 'boss-blade-ground', // 허수아비 기사 짚단 · 낫 휘두르기
  "jipdan30:aoe": 'boss-wind-wave', // 허수아비 기사 짚단 · 짚단 회오리
  "jipdan30:buster": 'boss-blade-hit', // 허수아비 기사 짚단 · 낫 내려치기
  "jjaekkak:big": 'boss-arcane-wave', // 모래시계 사제 째깍이 · 큰 모래시계
  "jjaekkak:hurry": 'boss-arcane-wave', // 모래시계 사제 째깍이 · 시간 재촉
  "jjaekkak:hurry2": 'boss-arcane-wave', // 모래시계 사제 째깍이 · 시간 재촉
  "jjaekkak:small": 'boss-arcane-wave', // 모래시계 사제 째깍이 · 작은 모래시계
  "kalnal:buster": 'boss-blade-hit', // 그림자 훈련교관 칼날 · 곧은 검 내려치기
  "kalnal:march0": 'boss-shadow-ground', // 그림자 훈련교관 칼날 · 그림자 행진
  "kalnal:march1": 'boss-shadow-ground', // 그림자 훈련교관 칼날 · 그림자 행진
  "kalnal:march2": 'boss-shadow-ground', // 그림자 훈련교관 칼날 · 그림자 행진
  "kalnal98:buster": 'boss-blade-hit', // 그림자 훈련교관 칼날 · 곧은 검 내려치기
  "kara:aoe": 'boss-projectile-wave', // 늪 사냥꾼 카라 · 갈대 화살 비
  "kara:buster": 'boss-blade-hit', // 늪 사냥꾼 카라 · 창 찌르기
  "kara:trap0": 'boss-metal-ground', // 늪 사냥꾼 카라 · 덫 놓기
  "kara:trap1": 'boss-metal-ground', // 늪 사냥꾼 카라 · 덫 놓기
  "kara15:aoe": 'boss-projectile-wave', // 늪 사냥꾼 카라 · 갈대 화살 비
  "kara15:buster": 'boss-blade-hit', // 늪 사냥꾼 카라 · 창 찌르기
  "keeper:buster": 'boss-blunt-hit', // 신전지기 유령 · 빗자루 휘두르기
  "keeper:pads": 'boss-holy-wave', // 신전지기 유령 · 제단 발판
  "keeper:roof": 'boss-earth-ground', // 신전지기 유령 · 천장 무너짐
  "keeper28:pads": 'boss-holy-wave', // 신전지기 유령 · 제단 발판
  "kkongkkong:buster": 'boss-projectile-hit', // 소포 요정 꽁꽁이 · 소포 상자 던지기
  "kkongkkong:parcel": 'boss-projectile-hit', // 소포 요정 꽁꽁이 · 소포 부치기
  "kkongkkong:wrap0": 'boss-wind-ground', // 소포 요정 꽁꽁이 · 바람 포장지
  "kkongkkong:wrap1": 'boss-wind-ground', // 소포 요정 꽁꽁이 · 바람 포장지
  "kkongkkong:wrap2": 'boss-wind-ground', // 소포 요정 꽁꽁이 · 바람 포장지
  "kkubeok:spear": 'boss-blade-hit', // 졸린 모래 병정 꾸벅 · 끄덕 · 신기루 창
  "knights:pull": 'boss-water-hit', // 물그림자 기사 셋 · 깊은 물로
  "knights:wave": 'boss-blade-ground', // 물그림자 기사 셋 · 물결 베기
  "knights68:wave": 'boss-blade-wave', // 물그림자 기사 셋 · 물결 베기
  "kobold60:buster": 'boss-blade-hit', // 코볼트 보물 지킴이 꼬질 · 곡괭이 내려치기
  "kongkong:beat": 'boss-earth-wave', // 곡괭이 골렘 콩콩이 · 곡괭이 박자
  "kongkong:beatm": 'boss-earth-wave', // 곡괭이 골렘 콩콩이 · 곡괭이 박자
  "kongkong:buster": 'boss-blade-hit', // 곡괭이 골렘 콩콩이 · 곡괭이 내려찍기
  "kongkong:chips": 'boss-earth-hit', // 곡괭이 골렘 콩콩이 · 돌 부스러기
  "kongkong5:aoe": 'boss-earth-wave', // 곡괭이 골렘 콩콩이 · 돌 부스러기
  "kongkong5:beat": 'boss-earth-wave', // 곡괭이 골렘 콩콩이 · 곡괭이 박자
  "kongkong5:buster": 'boss-blade-hit', // 곡괭이 골렘 콩콩이 · 곡괭이 내려찍기
  "kungkung:beat": 'boss-sound-wave', // 심장의 뿌리 쿵쿵 · 심장 박동
  "kungkung:buster": 'boss-nature-hit', // 심장의 뿌리 쿵쿵 · 뿌리 채찍
  "kwangkwang:buster": 'boss-blunt-hit', // 그림자 망치 거인 쾅쾅이 · 망치 내려치기
  "kwangkwang:hammer": 'boss-lightning-hit', // 그림자 망치 거인 쾅쾅이 · 망치 번개
  "kwangkwang:hook": 'boss-shadow-hit', // 그림자 망치 거인 쾅쾅이 · 그림자 갈고리
  "lady:aoe": 'boss-shadow-wave', // 초상화 속 귀부인 · 초상화의 눈
  "lastecho:buster": 'boss-holy-hit', // 마지막 메아리 · 빛 손바닥
  "lastecho:busterecho": 'boss-holy-hit', // 마지막 메아리 · 메아리: 빛 손바닥
  "lastecho:echo0": 'boss-shadow-ground', // 마지막 메아리 · 메아리: 퍼지는 박동
  "lastecho:echo1": 'boss-shadow-ground', // 마지막 메아리 · 메아리: 퍼지는 박동
  "lastecho:echo2": 'boss-shadow-ground', // 마지막 메아리 · 메아리: 퍼지는 박동
  "lastecho:pulse0": 'boss-shadow-ground', // 마지막 메아리 · 퍼지는 박동
  "lastecho:pulse1": 'boss-shadow-ground', // 마지막 메아리 · 퍼지는 박동
  "lastecho:pulse2": 'boss-shadow-ground', // 마지막 메아리 · 퍼지는 박동
  "lastecho:tide": 'boss-water-ground', // 마지막 메아리 · 어둠물 밀물
  "lastecho:tide2": 'boss-water-ground', // 마지막 메아리 · 어둠물 밀물
  "lastecho97:echo0": 'boss-shadow-ground', // 마지막 메아리 · 메아리: 퍼지는 박동
  "lastecho97:echo1": 'boss-shadow-ground', // 마지막 메아리 · 메아리: 퍼지는 박동
  "lastecho97:echo2": 'boss-shadow-ground', // 마지막 메아리 · 메아리: 퍼지는 박동
  "lastecho97:pulse0": 'boss-shadow-ground', // 마지막 메아리 · 퍼지는 박동
  "lastecho97:pulse1": 'boss-shadow-ground', // 마지막 메아리 · 퍼지는 박동
  "lastecho97:pulse2": 'boss-shadow-ground', // 마지막 메아리 · 퍼지는 박동
  "lastecho97:tide": 'boss-water-ground', // 마지막 메아리 · 어둠물 밀물
  "lastshade:buster": 'boss-blade-hit', // 마지막 그림자 · 그림자 칼날
  "lastshade:tide": 'boss-shadow-ground', // 마지막 그림자 · 마지막 박동
  "lastshade:tide2": 'boss-shadow-ground', // 마지막 그림자 · 다시 뛰어라
  "lavender:bottle": 'boss-projectile-hit', // 향수 조향사 라벤더 · 향수병 던지기
  "lavender:buster": 'boss-nature-hit', // 향수 조향사 라벤더 · 향수 분무
  "lavender:cloud0": 'boss-nature-ground', // 향수 조향사 라벤더 · 향기 구름
  "lavender20:aoe": 'boss-nature-wave', // 향수 조향사 라벤더 · 꽃향기 바람
  "lavender20:bottle": 'boss-projectile-hit', // 향수 조향사 라벤더 · 향수병 던지기
  "librarian:buster": 'boss-blunt-hit', // 서고 사서 · 두꺼운 사전
  "librarian40:buster": 'boss-blunt-hit', // 서고 사서 · 두꺼운 사전
  "mage:storm": 'boss-arcane-ground', // 불안정한 마법사 · 폭주
  "mage:storm2": 'boss-arcane-ground', // 불안정한 마법사 · 폭주
  "malchor:aoe": 'boss-poison-wave', // 역병 사제 말코어 · 교단의 기도
  "malchor:pulse": 'boss-poison-wave', // 역병 사제 말코어 · 병든 맥박
  "malchor:smoke": 'boss-poison-ground', // 역병 사제 말코어 · 향로 연기
  "malmijal:buster": 'boss-blade-hit', // 산호 정원사 말미잘 · 산호 갈퀴
  "malmijal:spine": 'boss-nature-hit', // 산호 정원사 말미잘 · 산호 가시
  "malmijal70:buster": 'boss-blade-hit', // 산호 정원사 말미잘 · 산호 갈퀴
  "malmijal70:spine": 'boss-nature-hit', // 산호 정원사 말미잘 · 산호 가시
  "malos:aoe": 'boss-poison-wave', // 역병 대사제 말로스 · 대사제의 기도
  "malos:buster": 'boss-poison-hit', // 역병 대사제 말로스 · 역병 지팡이
  "malos50:aoe": 'boss-poison-wave', // 역병 대사제 말로스 · 대사제의 기도
  "mimic:buster": 'boss-blunt-hit', // 보물 상자 덥석이 · 뚜껑 쾅
  "mimic:gulp": 'boss-beast-hit', // 보물 상자 덥석이 · 덥석!
  "mimic:gulp2": 'boss-beast-hit', // 보물 상자 덥석이 · 덥석!
  "mimic:rain": 'boss-metal-wave', // 보물 상자 덥석이 · 금화 비
  "molly:aoe": 'boss-nature-wave', // 약초꾼 수도사 몰리 · 약초 가루 뿌리기
  "molly:buster": 'boss-blunt-hit', // 약초꾼 수도사 몰리 · 지팡이 강타
  "molly10:aoe": 'boss-nature-wave', // 약초꾼 수도사 몰리 · 약초 가루 뿌리기
  "molly10:buster": 'boss-blunt-hit', // 약초꾼 수도사 몰리 · 지팡이 강타
  "monggeul:buster": 'boss-blunt-hit', // 케이크 골렘 몽글이 · 케이크 덮치기
  "monggeul:layer": 'boss-blunt-wave', // 케이크 골렘 몽글이 · 층 쌓기
  "monggeul:sugar": 'boss-earth-ground', // 케이크 골렘 몽글이 · 설탕 장판
  "monggeul:sugarm0": 'boss-earth-ground', // 케이크 골렘 몽글이 · 설탕 장판
  "monggeul:sugarm1": 'boss-earth-ground', // 케이크 골렘 몽글이 · 설탕 장판
  "monggeul:sugarm2": 'boss-earth-ground', // 케이크 골렘 몽글이 · 설탕 장판
  "morak:buster": 'boss-blunt-hit', // 포자 정원사 모락 할멈 · 삽 내려치기
  "morak:storm": 'boss-poison-wave', // 포자 정원사 모락 할멈 · 포자 폭풍
  "morel:buster": 'boss-blade-hit', // 부선장 갈고리 모렐 · 갈고리 베기
  "morel:pull": 'boss-metal-hit', // 부선장 갈고리 모렐 · 갈고리 낚기
  "morel:song": 'boss-sound-wave', // 부선장 갈고리 모렐 · 해적의 노래
  "morel:wave": 'boss-water-ground', // 부선장 갈고리 모렐 · 큰 파도
  "mungge:buster": 'boss-blunt-hit', // 이끼 골렘 뭉게 · 이끼 주먹
  "mungge:rain": 'boss-nature-wave', // 이끼 골렘 뭉게 · 이끼 비
  "mungsil:buster": 'boss-blunt-hit', // 온천지기 코볼트 뭉실 · 수건 휘두르기
  "mungsil:steam": 'boss-fire-wave', // 온천지기 코볼트 뭉실 · 뜨거운 김
  "mungsil64:buster": 'boss-blunt-hit', // 온천지기 코볼트 뭉실 · 수건 휘두르기
  "mungsil64:steam": 'boss-fire-wave', // 온천지기 코볼트 뭉실 · 뜨거운 김
  "nadal:aoe": 'boss-earth-wave', // 곡물창고 수호상 낟알 · 곡물창고 울림
  "nadal:grain0": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal:grain1": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal:grain2": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal:grain20": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal:grain21": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal:grain22": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal:grain23": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal:sack": 'boss-blunt-hit', // 곡물창고 수호상 낟알 · 무거운 자루
  "nadal34:grain0": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal34:grain1": 'boss-earth-ground', // 곡물창고 수호상 낟알 · 낟알 쏟아짐
  "nadal34:sack": 'boss-blunt-hit', // 곡물창고 수호상 낟알 · 무거운 자루
  "nokseul:buster": 'boss-metal-hit', // 그림자 대여상 녹슬음 · 저울추
  "nokseul:tide": 'boss-water-ground', // 그림자 대여상 녹슬음 · 어둠물 장부
  "nokseul96:tide": 'boss-water-ground', // 그림자 대여상 녹슬음 · 어둠물 장부
  "nyanx:buster": 'boss-beast-hit', // 수수께끼 고양이 냥크스 · 앞발
  "nyanx:tail": 'boss-beast-wave', // 수수께끼 고양이 냥크스 · 신기루 꼬리
  "octo:buster": 'boss-beast-hit', // 문어 꾸물이 · 촉수 후려치기
  "octo:wave": 'boss-water-wave', // 문어 꾸물이 · 먹물 파도
  "orben:buster": 'boss-frost-hit', // 대마도사 오르벤 · 서리 화살
  "orben:ring": 'boss-frost-ground', // 대마도사 오르벤 · 서리 고리
  "orben:ring2": 'boss-frost-ground', // 대마도사 오르벤 · 서리 고리
  "orben:row1": 'boss-frost-ground', // 대마도사 오르벤 · 눈보라 세 줄
  "orben:row2": 'boss-frost-ground', // 대마도사 오르벤 · 눈보라 세 줄
  "orben:row3": 'boss-frost-ground', // 대마도사 오르벤 · 눈보라 세 줄
  "ormal:buster": 'boss-shadow-hit', // 문지기 그림자 오르말 · 그림자 지팡이
  "ormal:greed1": 'boss-shadow-hit', // 문지기 그림자 오르말 · 조각 욕심
  "ormal:greed3": 'boss-shadow-hit', // 문지기 그림자 오르말 · 조각 욕심
  "ormal:wave": 'boss-water-wave', // 문지기 그림자 오르말 · 심연의 물결
  "pado:aoe": 'boss-water-wave', // 동굴 해마 기사 파도 · 소용돌이
  "pado:buster": 'boss-blade-hit', // 동굴 해마 기사 파도 · 산호 창
  "pado:tide": 'boss-water-ground', // 동굴 해마 기사 파도 · 밀물
  "pado:tidem": 'boss-water-ground', // 동굴 해마 기사 파도 · 밀물
  "parrot:buster": 'boss-beast-hit', // 앵무새 대장 깍깍 · 부리 쪼기
  "parrot:flap": 'boss-wind-wave', // 앵무새 대장 깍깍 · 날갯짓
  "peg:buster": 'boss-blade-hit', // 밀수꾼 두목 외눈 페그 · 외눈 칼질
  "peg:hook": 'boss-metal-hit', // 밀수꾼 두목 외눈 페그 · 갈고리 당기기
  "peg38:buster": 'boss-blade-hit', // 밀수꾼 두목 외눈 페그 · 외눈 칼질
  "peoleok:buster": 'boss-blunt-hit', // 날아다니는 책 펄럭이 · 표지 덮치기
  "peoleok:paper": 'boss-blade-hit', // 날아다니는 책 펄럭이 · 종이 베기
  "pililli:band": 'boss-sound-wave', // 요정 악단장 삘릴리 · 신나는 합주
  "pililli:buster": 'boss-sound-hit', // 요정 악단장 삘릴리 · 박자 맞춰 때리기
  "pingping:blade0": 'boss-wind-ground', // 바람개비 정령 핑핑이 · 바람 칼날
  "pingping:blade1": 'boss-wind-ground', // 바람개비 정령 핑핑이 · 바람 칼날
  "pingping:blade2": 'boss-wind-ground', // 바람개비 정령 핑핑이 · 바람 칼날
  "pingping:blade3": 'boss-wind-ground', // 바람개비 정령 핑핑이 · 바람 칼날
  "pingping:buster": 'boss-wind-hit', // 바람개비 정령 핑핑이 · 날개 베기
  "pingping:whirl": 'boss-wind-hit', // 바람개비 정령 핑핑이 · 회오리
  "plague:aoe": 'boss-poison-wave', // 역병 군주 · 역병 파동
  "plague:storm": 'boss-poison-ground', // 역병 군주 · 역병 폭풍
  "pokshin:pillow": 'boss-arcane-ground', // 베개 골렘 폭신이 · 신기루 베개
  "pokshin:pillowm": 'boss-arcane-ground', // 베개 골렘 폭신이 · 신기루 베개
  "pokshin:snore": 'boss-sound-wave', // 베개 골렘 폭신이 · 코골이
  "pokshin76:pillow": 'boss-arcane-ground', // 베개 골렘 폭신이 · 신기루 베개
  "pokshin76:snore": 'boss-sound-wave', // 베개 골렘 폭신이 · 코골이
  "poljjak:buster": 'boss-blade-hit', // 개구리 근위대장 폴짝 · 창 내지르기
  "poljjak:leap0": 'boss-beast-ground', // 개구리 근위대장 폴짝 · 크게 뛰기
  "poljjak:leap1": 'boss-beast-ground', // 개구리 근위대장 폴짝 · 크게 뛰기
  "poljjak:leapm0": 'boss-beast-ground', // 개구리 근위대장 폴짝 · 크게 뛰기
  "poljjak:leapm1": 'boss-beast-ground', // 개구리 근위대장 폴짝 · 크게 뛰기
  "poljjak:leapm2": 'boss-beast-ground', // 개구리 근위대장 폴짝 · 크게 뛰기
  "poljjak:tongue": 'boss-beast-hit', // 개구리 근위대장 폴짝 · 혀 끌어당김
  "poljjak58:buster": 'boss-blade-hit', // 개구리 근위대장 폴짝 · 창 내지르기
  "poljjak58:leap0": 'boss-beast-ground', // 개구리 근위대장 폴짝 · 크게 뛰기
  "polpol:aoe": 'boss-wind-wave', // 밀가루 요정 폴폴 · 밀가루 바람
  "polpol:buster": 'boss-blunt-hit', // 밀가루 요정 폴폴 · 밀대 휘두르기
  "polpol:dough": 'boss-projectile-hit', // 밀가루 요정 폴폴 · 반죽 던지기
  "polpol54:buster": 'boss-blunt-hit', // 밀가루 요정 폴폴 · 밀대 휘두르기
  "polpol54:dough": 'boss-projectile-hit', // 밀가루 요정 폴폴 · 반죽 던지기
  "ponga:buster": 'boss-blunt-hit', // 축제 대장 퐁가 · 갓 박치기
  "ponga:cloud": 'boss-poison-ground', // 축제 대장 퐁가 · 퐁! 포자 구름
  "pongpong:bolt": 'boss-lightning-hit', // 실험 조교 퐁퐁이 · 실습 번개
  "pongpong:buster": 'boss-projectile-hit', // 실험 조교 퐁퐁이 · 플라스크 던지기
  "pongpong88:bolt": 'boss-lightning-hit', // 실험 조교 퐁퐁이 · 실습 번개
  "ppodeuk:buster": 'boss-blunt-hit', // 눈사람 조수 뽀득이 · 몸통 박치기
  "ppodeuk:roll0": 'boss-frost-ground', // 눈사람 조수 뽀득이 · 눈덩이 굴리기
  "ppodeuk:roll1": 'boss-frost-ground', // 눈사람 조수 뽀득이 · 눈덩이 굴리기
  "ppodeuk:roll2": 'boss-frost-ground', // 눈사람 조수 뽀득이 · 눈덩이 굴리기
  "ppodeuk25:buster": 'boss-blunt-hit', // 눈사람 조수 뽀득이 · 몸통 박치기
  "ppodeuk25:roll0": 'boss-frost-ground', // 눈사람 조수 뽀득이 · 눈덩이 굴리기
  "ppodeuk25:roll1": 'boss-frost-ground', // 눈사람 조수 뽀득이 · 눈덩이 굴리기
  "ppodeuk25:roll2": 'boss-frost-ground', // 눈사람 조수 뽀득이 · 눈덩이 굴리기
  "ppyong:buster": 'boss-arcane-hit', // 요정 마술사 뿅뿅 · 지팡이 뿅
  "ppyong:vanish": 'boss-arcane-wave', // 요정 마술사 뿅뿅 · 사라지는 마술
  "priestess:buster": 'boss-nature-hit', // 백합 여사제 · 백합 지팡이
  "priestess:storm": 'boss-nature-wave', // 백합 여사제 · 꽃잎 폭풍
  "priestess48:storm": 'boss-nature-wave', // 백합 여사제 · 꽃잎 폭풍
  "puseok:buster": 'boss-blunt-hit', // 이끼 수호자 푸석이 · 이끼 주먹
  "queen56:buster": 'boss-blunt-hit', // 버섯 여왕 아마니타 · 여왕의 홀
  "ratking:buster": 'boss-beast-hit', // 수로 쥐왕 · 꼬리 채찍
  "revlord:blade": 'boss-blade-hit', // 되살아난 심연의 군주 · 신기루 칼날
  "revlord:bladem": 'boss-blade-hit', // 되살아난 심연의 군주 · 신기루 칼날
  "revlord:buster": 'boss-blade-hit', // 되살아난 심연의 군주 · 심연의 칼
  "revlord:glass": 'boss-arcane-wave', // 되살아난 심연의 군주 · 군주의 모래시계
  "revlord:glassm": 'boss-arcane-wave', // 되살아난 심연의 군주 · 군주의 모래시계
  "revlord:gold": 'boss-metal-hit', // 되살아난 심연의 군주 · 금빛 욕심
  "revlord:goldm": 'boss-metal-hit', // 되살아난 심연의 군주 · 금빛 욕심
  "revlord:lift": 'boss-wind-hit', // 되살아난 심연의 군주 · 폭풍 띄우기
  "revlord:liftm": 'boss-wind-hit', // 되살아난 심연의 군주 · 폭풍 띄우기
  "revlord:pile": 'boss-metal-wave', // 되살아난 심연의 군주 · 무너지는 보물
  "revlord:pilem": 'boss-metal-wave', // 되살아난 심연의 군주 · 무너지는 보물
  "revlord:speech": 'boss-sound-wave', // 되살아난 심연의 군주 · 긴 연설
  "rosalin:buster": 'boss-blunt-hit', // 대공비 유령 로살린 · 장미 홀 내려치기
  "rosalin:petal": 'boss-nature-wave', // 대공비 유령 로살린 · 꽃잎 회오리
  "rosalin:petal2": 'boss-nature-wave', // 대공비 유령 로살린 · 꽃잎 회오리
  "rosalin:petalw": 'boss-nature-ground', // 대공비 유령 로살린 · 꽃잎 회오리
  "rosalin:petalw2": 'boss-nature-ground', // 대공비 유령 로살린 · 꽃잎 회오리
  "rosalin:petalw3": 'boss-nature-ground', // 대공비 유령 로살린 · 꽃잎 회오리
  "rosalin:tide": 'boss-water-ground', // 대공비 유령 로살린 · 어둠물 밀물
  "rosalin:tide2": 'boss-water-ground', // 대공비 유령 로살린 · 어둠물 밀물
  "rose:aoe": 'boss-nature-wave', // 공방 주인 마담 로즈 · 꽃잎 폭풍
  "rose:thorn": 'boss-nature-hit', // 공방 주인 마담 로즈 · 장미 가시
  "rubina:ash": 'boss-fire-wave', // 어미 용 루비나 · 화산재 비
  "rubina:breath0": 'boss-fire-ground', // 어미 용 루비나 · 용의 숨결
  "rubina:breath0b": 'boss-fire-ground', // 어미 용 루비나 · 용의 숨결
  "rubina:breath1": 'boss-fire-ground', // 어미 용 루비나 · 용의 숨결
  "rubina:breath1b": 'boss-fire-ground', // 어미 용 루비나 · 용의 숨결
  "rubina:breath2": 'boss-fire-ground', // 어미 용 루비나 · 용의 숨결
  "rubina:breath2b": 'boss-fire-ground', // 어미 용 루비나 · 용의 숨결
  "rubina:buster": 'boss-beast-hit', // 어미 용 루비나 · 앞발 내려치기
  "rubina:greed1": 'boss-beast-hit', // 어미 용 루비나 · 내 보물 만지지 마!
  "rubina:greed3": 'boss-beast-hit', // 어미 용 루비나 · 내 보물 만지지 마!
  "sarasha:buster": 'boss-wind-hit', // 노을 여왕 사라샤 · 부채 내려치기
  "sarasha:glass": 'boss-arcane-wave', // 노을 여왕 사라샤 · 여왕의 모래시계
  "sarasha:sigh": 'boss-wind-wave', // 노을 여왕 사라샤 · 사막의 한숨
  "sarasha:whirl": 'boss-wind-wave', // 노을 여왕 사라샤 · 모래 회오리
  "sarasha:whirl2": 'boss-wind-wave', // 노을 여왕 사라샤 · 모래 회오리
  "sarasha:wind": 'boss-wind-hit', // 노을 여왕 사라샤 · 신기루 바람
  "scholar:aoe": 'boss-frost-wave', // 얼어붙은 대학자 · 눈보라 강의
  "scholar:buster": 'boss-frost-hit', // 얼어붙은 대학자 · 얼음 지팡이
  "scholar:floor": 'boss-frost-ground', // 얼어붙은 대학자 · 바닥이 언다
  "scholar:floor2": 'boss-frost-ground', // 얼어붙은 대학자 · 바닥이 언다
  "scrap:aoe": 'boss-metal-wave', // 고철 경비병 / 고철 순찰병 · 쇳조각 비
  "scrap:buster": 'boss-metal-hit', // 고철 경비병 / 고철 순찰병 · 고철 휘두르기
  "seawitch:buster": 'boss-water-hit', // 바다 마녀 미역 할멈 · 미역 채찍
  "seawitch:foam": 'boss-water-wave', // 바다 마녀 미역 할멈 · 거품 점괘
  "seawitch:tide": 'boss-water-ground', // 바다 마녀 미역 할멈 · 밀물
  "sentinel:buster": 'boss-blunt-hit', // 망루 파수꾼 · 청동 망치
  "sentinel:chain": 'boss-metal-hit', // 망루 파수꾼 · 갈고리 사슬
  "sentinel:shout": 'boss-sound-wave', // 망루 파수꾼 · 경고 함성
  "serena:buster": 'boss-blunt-hit', // 유령 악단장 세레나 · 지휘봉 내려치기
  "serena:cresc": 'boss-sound-wave', // 유령 악단장 세레나 · 크레센도
  "serena:tide": 'boss-water-ground', // 유령 악단장 세레나 · 박자 밀물
  "serena:tidem": 'boss-water-ground', // 유령 악단장 세레나 · 박자 밀물
  "serena92:cresc": 'boss-sound-wave', // 유령 악단장 세레나 · 크레센도
  "serena92:tide": 'boss-water-ground', // 유령 악단장 세레나 · 박자 밀물
  "seres:buster": 'boss-blade-hit', // 늪 족장 세레스 · 나무창 찌르기
  "shadow:buster": 'boss-frost-hit', // 탑주의 그림자 · 서리 손길
  "shadow:floor": 'boss-frost-ground', // 탑주의 그림자 · 얼어붙는 바닥
  "shaman8:aoe": 'boss-poison-wave', // 늪 주술사 · 독안개 숨
  "shellgod:buster": 'boss-blunt-hit', // 늪 거북 신 등딱지 · 등딱지 박치기
  "shellgod:roll0": 'boss-blunt-ground', // 늪 거북 신 등딱지 · 등딱지 굴리기
  "shellgod:roll1": 'boss-blunt-ground', // 늪 거북 신 등딱지 · 등딱지 굴리기
  "shellgod:roll2": 'boss-blunt-ground', // 늪 거북 신 등딱지 · 등딱지 굴리기
  "silta:buster": 'boss-poison-hit', // 함정 거미 실타래 · 독니
  "sippy:aoe": 'boss-projectile-wave', // 찻잔 요정 홀짝이 · 각설탕 비
  "sippy:buster": 'boss-projectile-hit', // 찻잔 요정 홀짝이 · 찻잔 던지기
  "sippy52:buster": 'boss-projectile-hit', // 찻잔 요정 홀짝이 · 찻잔 던지기
  "sleeper:aoe": 'boss-blunt-wave', // 잠든 가주 · 뒤척임
  "sleeper:buster": 'boss-blunt-hit', // 잠든 가주 · 베개 휘두르기
  "solsol:glass": 'boss-arcane-wave', // 모래 정령 솔솔 · 살살 · 분수 모래시계
  "songi:buster": 'boss-blade-hit', // 버섯 경비대장 송이 · 포자 창 찌르기
  "songi:ticket": 'boss-arcane-wave', // 버섯 경비대장 송이 · 입장권 검사
  "ssaengssaeng:arrow0": 'boss-projectile-ground', // 하피 기사 쌩쌩이 · 깃털 화살 비
  "ssaengssaeng:arrow1": 'boss-projectile-ground', // 하피 기사 쌩쌩이 · 깃털 화살 비
  "ssaengssaeng:arrow2": 'boss-projectile-ground', // 하피 기사 쌩쌩이 · 깃털 화살 비
  "ssaengssaeng:throw": 'boss-wind-hit', // 하피 기사 쌩쌩이 · 하늘 던지기
  "stargazer:buster": 'boss-blunt-hit', // 천문대 수호상 별바라기 · 망원경 휘두르기
  "stargazer:chart0": 'boss-arcane-ground', // 천문대 수호상 별바라기 · 별 지도 장판
  "stargazer:chart1": 'boss-arcane-ground', // 천문대 수호상 별바라기 · 별 지도 장판
  "stargazer:star": 'boss-holy-wave', // 천문대 수호상 별바라기 · 별빛 모으기
  "swit:buster": 'boss-blunt-hit', // 사서 유령 쉿 · 두꺼운 장부
  "swit:hush": 'boss-sound-wave', // 사서 유령 쉿 · 조용히
  "swit:storm": 'boss-wind-wave', // 사서 유령 쉿 · 장서 폭풍
  "swit90:hush": 'boss-sound-wave', // 사서 유령 쉿 · 조용히
  "swit90:storm": 'boss-wind-wave', // 사서 유령 쉿 · 장서 폭풍
  "syungsyung:buster": 'boss-projectile-hit', // 그림자 궁수대장 슝슝이 · 그림자 화살
  "syungsyung:gust": 'boss-wind-hit', // 그림자 궁수대장 슝슝이 · 화살 바람
  "syungsyung:rain0": 'boss-projectile-ground', // 그림자 궁수대장 슝슝이 · 화살 비
  "syungsyung:rain1": 'boss-projectile-ground', // 그림자 궁수대장 슝슝이 · 화살 비
  "syungsyung:rain2": 'boss-projectile-ground', // 그림자 궁수대장 슝슝이 · 화살 비
  "syungsyung:rain3": 'boss-projectile-ground', // 그림자 궁수대장 슝슝이 · 화살 비
  "toad:aoe": 'boss-poison-wave', // 거대 두꺼비 부글이 · 독 혹 터뜨리기
  "toad:belly": 'boss-blunt-ground', // 거대 두꺼비 부글이 · 배치기
  "toad:buster": 'boss-beast-hit', // 거대 두꺼비 부글이 · 혀 채찍
  "toad:swallow": 'boss-beast-hit', // 거대 두꺼비 부글이 · 삼키기
  "ttakttak:wave": 'boss-water-ground', // 수문지기 집게 딱딱이 · 큰 물결
  "ttakttak:wavem": 'boss-water-ground', // 수문지기 집게 딱딱이 · 큰 물결
  "ttangttang:buster": 'boss-blunt-hit', // 모루 골렘 땅땅 · 망치 내려치기
  "ttangttang:greed": 'boss-metal-hit', // 모루 골렘 땅땅 · 반짝반짝 두드리기
  "ttangttang:quake": 'boss-metal-wave', // 모루 골렘 땅땅 · 모루 울림
  "ttangttang:sea": 'boss-fire-ground', // 모루 골렘 땅땅 · 쇳물 바다
  "ttemjil:buster": 'boss-blunt-hit', // 코볼트 대장장이 땜질이 · 망치 내려치기
  "ttemjil:pour": 'boss-fire-wave', // 코볼트 대장장이 땜질이 · 쇳물 쏟기
  "ttemjil:spark0": 'boss-fire-ground', // 코볼트 대장장이 땜질이 · 불똥 튀기기
  "ttemjil:spark1": 'boss-fire-ground', // 코볼트 대장장이 땜질이 · 불똥 튀기기
  "ttemjil:spark2": 'boss-fire-ground', // 코볼트 대장장이 땜질이 · 불똥 튀기기
  "ttemjil:sparkm0": 'boss-fire-ground', // 코볼트 대장장이 땜질이 · 불똥 튀기기
  "ttemjil:sparkm1": 'boss-fire-ground', // 코볼트 대장장이 땜질이 · 불똥 튀기기
  "ttemjil:sparkm2": 'boss-fire-ground', // 코볼트 대장장이 땜질이 · 불똥 튀기기
  "ttemjil:sparkm3": 'boss-fire-ground', // 코볼트 대장장이 땜질이 · 불똥 튀기기
  "ttemjil62:buster": 'boss-blunt-hit', // 코볼트 대장장이 땜질이 · 망치 내려치기
  "ttemjil62:pour": 'boss-fire-wave', // 코볼트 대장장이 땜질이 · 쇳물 쏟기
  "ttemjil62:spark0": 'boss-fire-ground', // 코볼트 대장장이 땜질이 · 불똥 튀기기
  "ttubeok:pull": 'boss-nature-hit', // 뿌리 거인 뚜벅이 · 뿌리 끌어당기기
  "ttubeok:rise0": 'boss-nature-ground', // 뿌리 거인 뚜벅이 · 뿌리 솟기
  "ttubeok:rise1": 'boss-nature-ground', // 뿌리 거인 뚜벅이 · 뿌리 솟기
  "ttubeok:rise2": 'boss-nature-ground', // 뿌리 거인 뚜벅이 · 뿌리 솟기
  "ttubeok:rise3": 'boss-nature-ground', // 뿌리 거인 뚜벅이 · 뿌리 솟기
  "twins:dance": 'boss-sound-wave', // 쌍둥이 여군주 · 쌍둥이 무도회
  "twins:oath": 'boss-shadow-hit', // 쌍둥이 여군주 · 피의 서약
  "uga:aoe": 'boss-sound-wave', // 버섯 가면 주술사 우가 · 북소리
  "uga:buster": 'boss-blunt-hit', // 버섯 가면 주술사 우가 · 가면 박치기
  "umulluk:aoe": 'boss-sound-wave', // 두꺼비 왕 우물룩 · 개굴 고함
  "umulluk:buster": 'boss-blunt-hit', // 두꺼비 왕 우물룩 · 왕관 내려치기
  "umulluk:tide": 'boss-poison-ground', // 두꺼비 왕 우물룩 · 독 연못 넘침
  "umulluk:tide2": 'boss-poison-ground', // 두꺼비 왕 우물룩 · 독 연못 넘침
  "ureobal:buster": 'boss-beast-hit', // 심연 거수 우레발 · 뿔 들이받기
  "ureobal:roar": 'boss-beast-wave', // 심연 거수 우레발 · 뿌리 포효
  "ureobal:stomp": 'boss-blunt-wave', // 심연 거수 우레발 · 발 구르기
  "ureureung:buster": 'boss-lightning-hit', // 폭풍 거인 우르릉 · 천둥 주먹
  "ureureung:cloud": 'boss-lightning-hit', // 폭풍 거인 우르릉 · 번개 구름
  "ureureung:gust": 'boss-wind-hit', // 폭풍 거인 우르릉 · 섬 돌풍
  "ureureung:shout": 'boss-sound-wave', // 폭풍 거인 우르릉 · 폭풍 함성
  "ureureung:throw": 'boss-wind-hit', // 폭풍 거인 우르릉 · 하늘 던지기
  "ureureung:tilt": 'boss-earth-ground', // 폭풍 거인 우르릉 · 기우는 섬
  "uwoong:quake": 'boss-sound-wave', // 물오르간 정령 우웅이 · 낮은음 파동
  "valen:buster": 'boss-blade-hit', // 몰락한 대공 발렌 · 레이피어 찌르기
  "valen:march0": 'boss-sound-ground', // 몰락한 대공 발렌 · 무도회 행진
  "valen:march1": 'boss-sound-ground', // 몰락한 대공 발렌 · 무도회 행진
  "valen:march2": 'boss-sound-ground', // 몰락한 대공 발렌 · 무도회 행진
  "valen:tide": 'boss-water-ground', // 몰락한 대공 발렌 · 왈츠 밀물
  "valen:tide2": 'boss-sound-ground', // 몰락한 대공 발렌 · 끝나지 않는 왈츠
  "warden:aoe": 'boss-blast-wave', // 녹슨 문지기 · 증기 분출
  "warden:buster": 'boss-metal-hit', // 녹슨 문지기 · 내려찍기
  "warden:zone": 'boss-poison-ground', // 녹슨 문지기 · 녹물 웅덩이
  "whelps:boom": 'boss-fire-wave', // 새끼 용 삼남매 · 불꽃 재채기
  // 113 초반 보충 장소 1차 (Lv 5~8, 착탄)
  "kkuksoe:press10": 'boss-metal-hit',
  "kkuksoe:press20": 'boss-metal-hit',
  "kkuksoe:press11": 'boss-metal-hit',
  "kkuksoe:press21": 'boss-metal-hit',
  "kkuksoe:press12": 'boss-metal-hit',
  "kkuksoe:press22": 'boss-metal-hit',
  "kkuksoe:shower": 'boss-metal-wave',
  "kkuksoe:shard": 'boss-projectile-hit',
  "kkuksoe:shower2": 'boss-metal-wave',
  "chiik:buster": 'boss-metal-hit',
  "chiik:quake": 'boss-metal-wave',
  "chiik:steam": 'boss-water-wave',
  "chiik:steamb": 'boss-water-wave',
  "chiik:quakeb": 'boss-metal-wave',
  "chiik:jet": 'boss-water-hit',
  "chiik:steamc": 'boss-water-wave',
  "cutter:buster": 'boss-blade-hit',
  "deolkeok:buster": 'boss-metal-hit',
  "deolkeok:scrap0": 'boss-metal-wave',
  "deolkeok:scrap1": 'boss-metal-wave',
  "deolkeok:scrap2": 'boss-metal-wave',
  "huuk:buster": 'boss-blunt-hit',
  "huuk:wind": 'boss-wind-wave',
  "huuk:snatch": 'boss-blade-hit',
  "huuk:windb": 'boss-wind-wave',
  "heuneuk:buster": 'boss-blunt-hit',
  "heuneuk:wail1": 'boss-sound-wave',
  "heuneuk:wail2": 'boss-sound-wave',
  "heuneuk:wail2c": 'boss-sound-wave',
  "heuneuk:point": 'boss-shadow-hit',
  "eolluk:buster": 'boss-blunt-hit',
  "eolluk:wash": 'boss-water-wave',
  "puseokash:buster": 'boss-blunt-hit',
  "puseokash:ash0": 'boss-wind-ground',
  "puseokash:ash1": 'boss-wind-ground',
  "puseokash:ash2": 'boss-wind-ground',
  "puseokash:ash3": 'boss-wind-ground',
  "puseokash:ash4": 'boss-wind-ground',
  "puseokash:ash5": 'boss-wind-ground',
  "puseokash:dust0": 'boss-earth-ground',
  "puseokash:dust1": 'boss-earth-ground',
  "puseokash:dust2": 'boss-earth-ground',
};

/**
 * 주요 보스 기술마다 따로 (레이드 · 던전 마지막 보스, 2026-10-21 Lim 3번): 키 = <대본>:<기술 key>, 값 = bs-<대본>-<기술> (scripts/sfx/boss-own.mjs).
 * 이 표에 있으면 특성 소리 (BOSS_SKILL_SOUND)보다 먼저
 */
export const BOSS_SKILL_OWN: Record<string, string> = {
  "abyssheart:beat": 'bs-abyssheart-beat',
  "abyssheart:buster": 'bs-abyssheart-buster',
  "abyssheart:fast0": 'bs-abyssheart-fast0',
  "abyssheart:fast1": 'bs-abyssheart-fast0',
  "abyssheart:fast2": 'bs-abyssheart-fast0',
  "abyssheart:pulse0": 'bs-abyssheart-pulse0',
  "abyssheart:pulse1": 'bs-abyssheart-pulse0',
  "abyssheart:pulse2": 'bs-abyssheart-pulse0',
  "abyssheart:surge": 'bs-abyssheart-surge',
  "abyssheart:tide": 'bs-abyssheart-tide',
  "abyssheart:wedge0": 'bs-abyssheart-wedge0',
  "abyssheart:wedge1": 'bs-abyssheart-wedge0',
  "abyssheart:wedge2": 'bs-abyssheart-wedge0',
  "abysslord:buster": 'bs-abysslord-buster',
  "abysslord:collapse": 'bs-abysslord-collapse',
  "abysslord:wave": 'bs-abysslord-wave',
  "abysslord:wave3": 'bs-abysslord-wave',
  "amanita:buster": 'bs-amanita-buster',
  "amanita:waltz": 'bs-amanita-waltz',
  "bamgeuneul:buster": 'bs-bamgeuneul-buster',
  "bamgeuneul:squeeze": 'bs-bamgeuneul-squeeze',
  "belmore:buster": 'bs-belmore-buster',
  "beonjjeok:buster": 'bs-beonjjeok-buster',
  "beonjjeok:greed1": 'bs-beonjjeok-greed1',
  "beonjjeok:greed1m": 'bs-beonjjeok-greed1',
  "beonjjeok:greed2": 'bs-beonjjeok-greed1',
  "beonjjeok:greed2m": 'bs-beonjjeok-greed1',
  "beonjjeok:rain": 'bs-beonjjeok-rain',
  "bichumi:hush": 'bs-bichumi-hush',
  "bichumi:shelf": 'bs-bichumi-shelf',
  "bitgallae:buster": 'bs-bitgallae-buster',
  "bitgallae:fork": 'bs-bitgallae-fork',
  "bitgallae:greed": 'bs-bitgallae-greed',
  "bitgallae:prism": 'bs-bitgallae-prism',
  "bulttung:buster": 'bs-bulttung-buster',
  "bulttung:fire0": 'bs-bulttung-fire0',
  "bulttung:fire1": 'bs-bulttung-fire0',
  "bulttung:fire2": 'bs-bulttung-fire0',
  "bulttung:greed1": 'bs-bulttung-greed1',
  "bulttung:greed1m": 'bs-bulttung-greed1',
  "bulttung:greed2": 'bs-bulttung-greed1',
  "bulttung:greed2m": 'bs-bulttung-greed1',
  "bungbung:buster": 'bs-bungbung-buster',
  "bungbung:wind": 'bs-bungbung-wind',
  "buri:box": 'bs-buri-box',
  "buri:boxm": 'bs-buri-box',
  "buri:buster": 'bs-buri-buster',
  "buri:padlift": 'bs-buri-padlift',
  "buri:return": 'bs-buri-return',
  "buri:storm": 'bs-buri-storm',
  "carrier:aoe": 'bs-carrier-aoe',
  "carrier:buster": 'bs-carrier-buster',
  "chalrang:buster": 'bs-chalrang-buster',
  "chalrang:omen0": 'bs-chalrang-omen0',
  "chalrang:omen1": 'bs-chalrang-omen0',
  "chalrang:zap": 'bs-chalrang-zap',
  "cheolbeok:aoe": 'bs-cheolbeok-aoe',
  "cheolbeok:buster": 'bs-cheolbeok-buster',
  "cheolbeok:puddle": 'bs-cheolbeok-puddle',
  "chilheuk:bolt": 'bs-chilheuk-bolt',
  "chilheuk:buster": 'bs-chilheuk-buster',
  "chilheuk:charge": 'bs-chilheuk-charge',
  "chilheuk:glass": 'bs-chilheuk-glass',
  "chilheuk:march": 'bs-chilheuk-march',
  "chilheuk:orderbolt": 'bs-chilheuk-orderbolt',
  "chingching:aoe": 'bs-chingching-aoe',
  "chingching:buster": 'bs-chingching-buster',
  "choir:baton": 'bs-choir-baton',
  "choir:crescendo": 'bs-choir-crescendo',
  "choir:forte": 'bs-choir-forte',
  "chulleong:buster": 'bs-chulleong-buster',
  "chulleong:quake": 'bs-chulleong-quake',
  "chulleong:splash0": 'bs-chulleong-splash0',
  "chulleong:splash1": 'bs-chulleong-splash0',
  "chulleong:splash2": 'bs-chulleong-splash0',
  "chulleong:splash3": 'bs-chulleong-splash0',
  "cook:buster": 'bs-cook-buster',
  "cook:soup": 'bs-cook-soup',
  "crab:buster": 'bs-crab-buster',
  "crab:wave": 'bs-crab-wave',
  "crystal:buster": 'bs-crystal-buster',
  "crystal:quake": 'bs-crystal-quake',
  "dandani:charge": 'bs-dandani-charge',
  "dandani:fire0": 'bs-dandani-fire0',
  "dandani:fire0b": 'bs-dandani-fire0',
  "dandani:fire1": 'bs-dandani-fire0',
  "dandani:fire1b": 'bs-dandani-fire0',
  "dandani:fire2": 'bs-dandani-fire0',
  "dandani:fire2b": 'bs-dandani-fire0',
  "deolkeong:cart": 'bs-deolkeong-cart',
  "deolkeong:cartm": 'bs-deolkeong-cart',
  "deolkeong:coin": 'bs-deolkeong-coin',
  "doeul:arrow": 'bs-doeul-arrow',
  "doeul:buster": 'bs-doeul-buster',
  "doeul:deep": 'bs-doeul-deep',
  "doeul:glass": 'bs-doeul-glass',
  "doeul:wave": 'bs-doeul-wave',
  "doeul:wave2": 'bs-doeul-wave',
  "dolgae:buster": 'bs-dolgae-buster',
  "dolgae:gust": 'bs-dolgae-gust',
  "dolgae:gust2": 'bs-dolgae-gust',
  "dolgae:mill": 'bs-dolgae-mill',
  "dooldool:buster": 'bs-dooldool-buster',
  "dooldool:glass": 'bs-dooldool-glass',
  "dooldool:glassm": 'bs-dooldool-glass',
  "dooldool:hush": 'bs-dooldool-hush',
  "dungdung:buster": 'bs-dungdung-buster',
  "dungdung:drum": 'bs-dungdung-drum',
  "dungdung:roll": 'bs-dungdung-roll',
  "dwijuk:buster": 'bs-dwijuk-buster',
  "dwijuk:chalk": 'bs-dwijuk-chalk',
  "dwijuk:levit": 'bs-dwijuk-levit',
  "dwijuk:levit2": 'bs-dwijuk-levit',
  "eodugi:beat": 'bs-eodugi-beat',
  "eodugi:bolt": 'bs-eodugi-bolt',
  "eodugi:buster": 'bs-eodugi-buster',
  "eodugi:glass": 'bs-eodugi-glass',
  "eodugi:gust": 'bs-eodugi-gust',
  "eodugi:wave": 'bs-eodugi-wave',
  "eodugi:wave2": 'bs-eodugi-wave',
  "eomgyeok:buster": 'bs-eomgyeok-buster',
  "eomgyeok:homework": 'bs-eomgyeok-homework',
  "eomgyeok:hush": 'bs-eomgyeok-hush',
  "eonggeum:bog0": 'bs-eonggeum-bog0',
  "eonggeum:bog1": 'bs-eonggeum-bog0',
  "eonggeum:ram": 'bs-eonggeum-ram',
  "eonggeum:ramm": 'bs-eonggeum-ram',
  "eonggeum:ramm2": 'bs-eonggeum-ram',
  "eongkim:buster": 'bs-eongkim-buster',
  "eongkim:shake": 'bs-eongkim-shake',
  "gaegul:buster": 'bs-gaegul-buster',
  "gaegul:croak": 'bs-gaegul-croak',
  "gaegul:splash": 'bs-gaegul-splash',
  "gaegul:tongue": 'bs-gaegul-tongue',
  "gaegul:tongue2": 'bs-gaegul-tongue',
  "garnet:breath0": 'bs-garnet-breath0',
  "garnet:breath0b": 'bs-garnet-breath0',
  "garnet:breath1": 'bs-garnet-breath0',
  "garnet:breath1b": 'bs-garnet-breath0',
  "garnet:breath2": 'bs-garnet-breath0',
  "garnet:breath2b": 'bs-garnet-breath0',
  "garnet:buster": 'bs-garnet-buster',
  "garnet:greed": 'bs-garnet-greed',
  "garnet:wing": 'bs-garnet-wing',
  "geomeun:buster": 'bs-geomeun-buster',
  "geomeun:rain": 'bs-geomeun-rain',
  "geomeun:surge": 'bs-geomeun-surge',
  "geomeun:tide": 'bs-geomeun-tide',
  "geumeum:buster": 'bs-geumeum-buster',
  "geumeum:spear": 'bs-geumeum-spear',
  "geuneul:buster": 'bs-geuneul-buster',
  "geuneul:glass": 'bs-geuneul-glass',
  "geuneul:shade": 'bs-geuneul-shade',
  "gipeun:beat": 'bs-gipeun-beat',
  "gipeun:buster": 'bs-gipeun-buster',
  "gipeun:deep0": 'bs-gipeun-deep0',
  "gipeun:deep1": 'bs-gipeun-deep0',
  "gipeun:deep2": 'bs-gipeun-deep0',
  "gitpen:buster": 'bs-gitpen-buster',
  "gitpen:ink": 'bs-gitpen-ink',
  "gitpen:quill": 'bs-gitpen-quill',
  "gitpen:rewind": 'bs-gitpen-rewind',
  "goldbeard:buster": 'bs-goldbeard-buster',
  "goldbeard:cannon0": 'bs-goldbeard-cannon0',
  "goldbeard:cannon1": 'bs-goldbeard-cannon0',
  "goldbeard:cannon2": 'bs-goldbeard-cannon0',
  "goldbeard:goldrain": 'bs-goldbeard-goldrain',
  "goldbeard:roar": 'bs-goldbeard-roar',
  "gulgul:bolt": 'bs-gulgul-bolt',
  "gulgul:buster": 'bs-gulgul-buster',
  "gulgul:dig0": 'bs-gulgul-dig0',
  "gulgul:dig1": 'bs-gulgul-dig0',
  "gulgul:dig2": 'bs-gulgul-dig0',
  "gunner:broadside0": 'bs-gunner-broadside0',
  "gunner:broadside0b": 'bs-gunner-broadside0',
  "gunner:broadside1": 'bs-gunner-broadside0',
  "gunner:broadside1b": 'bs-gunner-broadside0',
  "gunner:broadside2": 'bs-gunner-broadside0',
  "gunner:broadside2b": 'bs-gunner-broadside0',
  "gunner:buster": 'bs-gunner-buster',
  "gurit:buster": 'bs-gurit-buster',
  "gurit:cart0": 'bs-gurit-cart0',
  "gurit:cart0b": 'bs-gurit-cart0',
  "gurit:cart1": 'bs-gurit-cart0',
  "gurit:cart1b": 'bs-gurit-cart0',
  "gurit:cart2": 'bs-gurit-cart0',
  "gurit:cart2b": 'bs-gurit-cart0',
  "hapum:bigyawn": 'bs-hapum-bigyawn',
  "hapum:buster": 'bs-hapum-buster',
  "hapum:busterm": 'bs-hapum-buster',
  "hapum:glass": 'bs-hapum-glass',
  "hapum:storm": 'bs-hapum-storm',
  "hatter:aoe": 'bs-hatter-aoe',
  "hatter:buster": 'bs-hatter-buster',
  "hatter:quake": 'bs-hatter-quake',
  "heukbaek:buster": 'bs-heukbaek-buster',
  "heukbaek:pulse0": 'bs-heukbaek-pulse0',
  "heukbaek:pulse1": 'bs-heukbaek-pulse0',
  "heukbaek:pulse2": 'bs-heukbaek-pulse0',
  "heumul:quake": 'bs-heumul-quake',
  "hoeori:bolt": 'bs-hoeori-bolt',
  "hoeori:buster": 'bs-hoeori-buster',
  "hoeori:wall": 'bs-hoeori-wall',
  "hoeori:whirl": 'bs-hoeori-whirl',
  "hokdol:buster": 'bs-hokdol-buster',
  "hokdol:pile": 'bs-hokdol-pile',
  "huu:beat": 'bs-huu-beat',
  "huu:buster": 'bs-huu-buster',
  "huu:exhale": 'bs-huu-exhale',
  "huu:exhalem": 'bs-huu-exhale',
  "huu:inhale": 'bs-huu-inhale',
  "hwalhwal:aoe": 'bs-hwalhwal-aoe',
  "hwalhwal:breath0": 'bs-hwalhwal-breath0',
  "hwalhwal:breath1": 'bs-hwalhwal-breath0',
  "hwalhwal:breath2": 'bs-hwalhwal-breath0',
  "hwalhwal:buster": 'bs-hwalhwal-buster',
  "hwigami:bolt": 'bs-hwigami-bolt',
  "hwigami:buster": 'bs-hwigami-buster',
  "hwigami:drag": 'bs-hwigami-drag',
  "hwigami:tide": 'bs-hwigami-tide',
  "hwirik83:buster": 'bs-hwirik83-buster',
  "hwirik83:express": 'bs-hwirik83-express',
  "hydra:acid": 'bs-hydra-acid',
  "hydra:buster": 'bs-hydra-buster',
  "hydra:sink": 'bs-hydra-sink',
  "hydra:spew": 'bs-hydra-spew',
  "icia:aoe": 'bs-icia-aoe',
  "icia:buster": 'bs-icia-buster',
  "janmul:big": 'bs-janmul-big',
  "janmul:buster": 'bs-janmul-buster',
  "janmul:row": 'bs-janmul-row',
  "janmul:tide": 'bs-janmul-tide',
  "jilpung:buster": 'bs-jilpung-buster',
  "jilpung:charge0": 'bs-jilpung-charge0',
  "jilpung:charge0b": 'bs-jilpung-charge0',
  "jilpung:charge1": 'bs-jilpung-charge0',
  "jilpung:charge1b": 'bs-jilpung-charge0',
  "jilpung:charge2": 'bs-jilpung-charge0',
  "jilpung:charge2b": 'bs-jilpung-charge0',
  "jilpung:hoof": 'bs-jilpung-hoof',
  "jjaekkak:big": 'bs-jjaekkak-big',
  "jjaekkak:hurry": 'bs-jjaekkak-hurry',
  "jjaekkak:hurry2": 'bs-jjaekkak-hurry',
  "jjaekkak:small": 'bs-jjaekkak-small',
  "keeper:buster": 'bs-keeper-buster',
  "keeper:pads": 'bs-keeper-pads',
  "keeper:roof": 'bs-keeper-roof',
  "kkongkkong:buster": 'bs-kkongkkong-buster',
  "kkongkkong:parcel": 'bs-kkongkkong-parcel',
  "kkongkkong:wrap0": 'bs-kkongkkong-wrap0',
  "kkongkkong:wrap1": 'bs-kkongkkong-wrap0',
  "kkongkkong:wrap2": 'bs-kkongkkong-wrap0',
  "kkubeok:spear": 'bs-kkubeok-spear',
  "knights:pull": 'bs-knights-pull',
  "knights:wave": 'bs-knights-wave',
  "kungkung:beat": 'bs-kungkung-beat',
  "kungkung:buster": 'bs-kungkung-buster',
  "kwangkwang:buster": 'bs-kwangkwang-buster',
  "kwangkwang:hammer": 'bs-kwangkwang-hammer',
  "kwangkwang:hook": 'bs-kwangkwang-hook',
  "lastecho:buster": 'bs-lastecho-buster',
  "lastecho:busterecho": 'bs-lastecho-busterecho',
  "lastecho:echo0": 'bs-lastecho-echo0',
  "lastecho:echo1": 'bs-lastecho-echo0',
  "lastecho:echo2": 'bs-lastecho-echo0',
  "lastecho:pulse0": 'bs-lastecho-pulse0',
  "lastecho:pulse1": 'bs-lastecho-pulse0',
  "lastecho:pulse2": 'bs-lastecho-pulse0',
  "lastecho:tide": 'bs-lastecho-tide',
  "lastecho:tide2": 'bs-lastecho-tide',
  "lastshade:buster": 'bs-lastshade-buster',
  "lastshade:tide": 'bs-lastshade-tide',
  "lastshade:tide2": 'bs-lastshade-tide2',
  "malchor:aoe": 'bs-malchor-aoe',
  "malchor:pulse": 'bs-malchor-pulse',
  "malchor:smoke": 'bs-malchor-smoke',
  "malos:aoe": 'bs-malos-aoe',
  "malos:buster": 'bs-malos-buster',
  "mimic:buster": 'bs-mimic-buster',
  "mimic:gulp": 'bs-mimic-gulp',
  "mimic:gulp2": 'bs-mimic-gulp',
  "mimic:rain": 'bs-mimic-rain',
  "monggeul:buster": 'bs-monggeul-buster',
  "monggeul:layer": 'bs-monggeul-layer',
  "monggeul:sugar": 'bs-monggeul-sugar',
  "monggeul:sugarm0": 'bs-monggeul-sugar',
  "monggeul:sugarm1": 'bs-monggeul-sugar',
  "monggeul:sugarm2": 'bs-monggeul-sugar',
  "morak:buster": 'bs-morak-buster',
  "morak:storm": 'bs-morak-storm',
  "morel:buster": 'bs-morel-buster',
  "morel:pull": 'bs-morel-pull',
  "morel:song": 'bs-morel-song',
  "morel:wave": 'bs-morel-wave',
  "mungge:buster": 'bs-mungge-buster',
  "mungge:rain": 'bs-mungge-rain',
  "nadal:aoe": 'bs-nadal-aoe',
  "nadal:grain0": 'bs-nadal-grain0',
  "nadal:grain1": 'bs-nadal-grain0',
  "nadal:grain2": 'bs-nadal-grain0',
  "nadal:grain20": 'bs-nadal-grain0',
  "nadal:grain21": 'bs-nadal-grain0',
  "nadal:grain22": 'bs-nadal-grain0',
  "nadal:grain23": 'bs-nadal-grain0',
  "nadal:sack": 'bs-nadal-sack',
  "nyanx:buster": 'bs-nyanx-buster',
  "nyanx:tail": 'bs-nyanx-tail',
  "octo:buster": 'bs-octo-buster',
  "octo:wave": 'bs-octo-wave',
  "orben:buster": 'bs-orben-buster',
  "orben:ring": 'bs-orben-ring',
  "orben:ring2": 'bs-orben-ring',
  "orben:row1": 'bs-orben-row1',
  "orben:row2": 'bs-orben-row1',
  "orben:row3": 'bs-orben-row1',
  "ormal:buster": 'bs-ormal-buster',
  "ormal:greed1": 'bs-ormal-greed1',
  "ormal:greed3": 'bs-ormal-greed1',
  "ormal:wave": 'bs-ormal-wave',
  "pado:aoe": 'bs-pado-aoe',
  "pado:buster": 'bs-pado-buster',
  "pado:tide": 'bs-pado-tide',
  "pado:tidem": 'bs-pado-tide',
  "parrot:buster": 'bs-parrot-buster',
  "parrot:flap": 'bs-parrot-flap',
  "pililli:band": 'bs-pililli-band',
  "pililli:buster": 'bs-pililli-buster',
  "pingping:blade0": 'bs-pingping-blade0',
  "pingping:blade1": 'bs-pingping-blade0',
  "pingping:blade2": 'bs-pingping-blade0',
  "pingping:blade3": 'bs-pingping-blade0',
  "pingping:buster": 'bs-pingping-buster',
  "pingping:whirl": 'bs-pingping-whirl',
  "plague:aoe": 'bs-plague-aoe',
  "plague:storm": 'bs-plague-storm',
  "pokshin:pillow": 'bs-pokshin-pillow',
  "pokshin:pillowm": 'bs-pokshin-pillow',
  "pokshin:snore": 'bs-pokshin-snore',
  "ponga:buster": 'bs-ponga-buster',
  "ponga:cloud": 'bs-ponga-cloud',
  "ppyong:buster": 'bs-ppyong-buster',
  "ppyong:vanish": 'bs-ppyong-vanish',
  "puseok:buster": 'bs-puseok-buster',
  "revlord:blade": 'bs-revlord-blade',
  "revlord:bladem": 'bs-revlord-blade',
  "revlord:buster": 'bs-revlord-buster',
  "revlord:glass": 'bs-revlord-glass',
  "revlord:glassm": 'bs-revlord-glass',
  "revlord:gold": 'bs-revlord-gold',
  "revlord:goldm": 'bs-revlord-gold',
  "revlord:lift": 'bs-revlord-lift',
  "revlord:liftm": 'bs-revlord-lift',
  "revlord:pile": 'bs-revlord-pile',
  "revlord:pilem": 'bs-revlord-pile',
  "revlord:speech": 'bs-revlord-speech',
  "rosalin:buster": 'bs-rosalin-buster',
  "rosalin:petal": 'bs-rosalin-petal',
  "rosalin:petal2": 'bs-rosalin-petal',
  "rosalin:petalw": 'bs-rosalin-petalw',
  "rosalin:petalw2": 'bs-rosalin-petalw',
  "rosalin:petalw3": 'bs-rosalin-petalw',
  "rosalin:tide": 'bs-rosalin-tide',
  "rosalin:tide2": 'bs-rosalin-tide',
  "rose:aoe": 'bs-rose-aoe',
  "rose:thorn": 'bs-rose-thorn',
  "rubina:ash": 'bs-rubina-ash',
  "rubina:breath0": 'bs-rubina-breath0',
  "rubina:breath0b": 'bs-rubina-breath0',
  "rubina:breath1": 'bs-rubina-breath0',
  "rubina:breath1b": 'bs-rubina-breath0',
  "rubina:breath2": 'bs-rubina-breath0',
  "rubina:breath2b": 'bs-rubina-breath0',
  "rubina:buster": 'bs-rubina-buster',
  "rubina:greed1": 'bs-rubina-greed1',
  "rubina:greed3": 'bs-rubina-greed1',
  "sarasha:buster": 'bs-sarasha-buster',
  "sarasha:glass": 'bs-sarasha-glass',
  "sarasha:sigh": 'bs-sarasha-sigh',
  "sarasha:whirl": 'bs-sarasha-whirl',
  "sarasha:whirl2": 'bs-sarasha-whirl',
  "sarasha:wind": 'bs-sarasha-wind',
  "scholar:aoe": 'bs-scholar-aoe',
  "scholar:buster": 'bs-scholar-buster',
  "scholar:floor": 'bs-scholar-floor',
  "scholar:floor2": 'bs-scholar-floor',
  "seawitch:buster": 'bs-seawitch-buster',
  "seawitch:foam": 'bs-seawitch-foam',
  "seawitch:tide": 'bs-seawitch-tide',
  "seres:buster": 'bs-seres-buster',
  "shadow:buster": 'bs-shadow-buster',
  "shadow:floor": 'bs-shadow-floor',
  "shellgod:buster": 'bs-shellgod-buster',
  "shellgod:roll0": 'bs-shellgod-roll0',
  "shellgod:roll1": 'bs-shellgod-roll0',
  "shellgod:roll2": 'bs-shellgod-roll0',
  "silta:buster": 'bs-silta-buster',
  "sleeper:aoe": 'bs-sleeper-aoe',
  "sleeper:buster": 'bs-sleeper-buster',
  "solsol:glass": 'bs-solsol-glass',
  "songi:buster": 'bs-songi-buster',
  "songi:ticket": 'bs-songi-ticket',
  "ssaengssaeng:arrow0": 'bs-ssaengssaeng-arrow0',
  "ssaengssaeng:arrow1": 'bs-ssaengssaeng-arrow0',
  "ssaengssaeng:arrow2": 'bs-ssaengssaeng-arrow0',
  "ssaengssaeng:throw": 'bs-ssaengssaeng-throw',
  "swit:buster": 'bs-swit-buster',
  "swit:hush": 'bs-swit-hush',
  "swit:storm": 'bs-swit-storm',
  "syungsyung:buster": 'bs-syungsyung-buster',
  "syungsyung:gust": 'bs-syungsyung-gust',
  "syungsyung:rain0": 'bs-syungsyung-rain0',
  "syungsyung:rain1": 'bs-syungsyung-rain0',
  "syungsyung:rain2": 'bs-syungsyung-rain0',
  "syungsyung:rain3": 'bs-syungsyung-rain0',
  "ttakttak:wave": 'bs-ttakttak-wave',
  "ttakttak:wavem": 'bs-ttakttak-wave',
  "ttangttang:buster": 'bs-ttangttang-buster',
  "ttangttang:greed": 'bs-ttangttang-greed',
  "ttangttang:quake": 'bs-ttangttang-quake',
  "ttangttang:sea": 'bs-ttangttang-sea',
  "ttubeok:pull": 'bs-ttubeok-pull',
  "ttubeok:rise0": 'bs-ttubeok-rise0',
  "ttubeok:rise1": 'bs-ttubeok-rise0',
  "ttubeok:rise2": 'bs-ttubeok-rise0',
  "ttubeok:rise3": 'bs-ttubeok-rise0',
  "twins:dance": 'bs-twins-dance',
  "twins:oath": 'bs-twins-oath',
  "umulluk:aoe": 'bs-umulluk-aoe',
  "umulluk:buster": 'bs-umulluk-buster',
  "umulluk:tide": 'bs-umulluk-tide',
  "umulluk:tide2": 'bs-umulluk-tide',
  "ureobal:buster": 'bs-ureobal-buster',
  "ureobal:roar": 'bs-ureobal-roar',
  "ureobal:stomp": 'bs-ureobal-stomp',
  "ureureung:buster": 'bs-ureureung-buster',
  "ureureung:cloud": 'bs-ureureung-cloud',
  "ureureung:gust": 'bs-ureureung-gust',
  "ureureung:shout": 'bs-ureureung-shout',
  "ureureung:throw": 'bs-ureureung-throw',
  "ureureung:tilt": 'bs-ureureung-tilt',
  "uwoong:quake": 'bs-uwoong-quake',
  "valen:buster": 'bs-valen-buster',
  "valen:march0": 'bs-valen-march0',
  "valen:march1": 'bs-valen-march0',
  "valen:march2": 'bs-valen-march0',
  "valen:tide": 'bs-valen-tide',
  "valen:tide2": 'bs-valen-tide2',
  "warden:aoe": 'bs-warden-aoe',
  "warden:buster": 'bs-warden-buster',
  "warden:zone": 'bs-warden-zone',
  "whelps:boom": 'bs-whelps-boom',
};

/** 예고 없이 바로 쓰는 보스 기술 → 특성 시전 소리 (boss-<특성>-cast). 키 = <대본>:<기술 key> (scripts/sfx/boss.mjs) */
export const BOSS_CAST_SOUND: Record<string, string> = {
  "pado:bubble": 'boss-poison-cast', // 111
  "hydra:drip": 'boss-poison-cast', // 111
  "twins:drip": 'boss-shadow-cast', // 111
  "belmore:drip": 'boss-shadow-cast', // 111
  "shadow:drip": 'boss-frost-cast', // 111
  "scholar:drip": 'boss-frost-cast', // 111
  "priestess48:wilt": 'boss-nature-cast', // 111
  "golem18:touch": 'boss-frost-cast', // 111
  "dwijuk:shell": 'boss-frost-cast', // 111 단단한 껍질
  "kwangkwang:shell": 'boss-shadow-cast', // 111 단단한 껍질
  "dolgae:charge": 'boss-lightning-cast', // 111 충전
  "dungdung:charge": 'boss-lightning-cast', // 111 충전
  "sippy52:hunt": 'boss-water-cast', // 111 탐험 50% 구간
  "queen56:ring": 'boss-nature-cast', // 111 탐험 50% 구간
  "ttemjil62:soot": 'boss-poison-cast', // 111 탐험 50% 구간
  "heumul72:tentacle": 'boss-water-cast', // 111 탐험 50% 구간
  "pokshin76:fight": 'boss-arcane-cast', // 111 탐험 50% 구간
  "kalnal98:plague": 'boss-poison-cast', // 111 탐험 50% 구간
  "heartshard100:loan": 'boss-shadow-cast', // 111 탐험 50% 구간
  "abyssheart:loan": 'boss-shadow-cast',
  "abyssheart:touch": 'boss-shadow-cast',
  "abysslord:echoes": 'boss-shadow-cast',
  "abysslord:jail": 'boss-shadow-cast',
  "abysslord:shard": 'boss-shadow-cast',
  "abysslord:veil": 'boss-shadow-cast',
  "amanita:dance": 'boss-sound-cast',
  "amanita:party": 'boss-sound-cast',
  "amanita:ring": 'boss-nature-cast',
  "amanita:ringm": 'boss-nature-cast',
  "amanita:spore": 'boss-poison-cast',
  "amanita:tree": 'boss-nature-cast',
  "bamgeuneul:jail": 'boss-shadow-cast',
  "bamgeuneul:loan": 'boss-shadow-cast',
  "bamgeuneul:sink": 'boss-earth-cast',
  "bamgeuneul:touch": 'boss-shadow-cast',
  "bamgeuneul:trap": 'boss-metal-cast',
  "banjjak99:armor": 'boss-earth-cast',
  "banjjak99:dust": 'boss-earth-cast',
  "banjjak:armor": 'boss-earth-cast',
  "banjjak:dust": 'boss-earth-cast',
  "baseurak74:wrap": 'boss-shadow-cast',
  "baseurak:wrap": 'boss-shadow-cast',
  "belmore:invert": 'boss-shadow-cast',
  "belmore:invert2": 'boss-shadow-cast',
  "belmore:ring": 'boss-metal-cast',
  "belmore:youth": 'boss-shadow-cast',
  "beonjjeok:hoard": 'boss-metal-cast',
  "beonjjeok:hunt": 'boss-blade-cast',
  "bichumi:dust": 'boss-wind-cast',
  "bichumi:fine": 'boss-metal-cast',
  "bitgallae:touch": 'boss-shadow-cast',
  "boksul84:static": 'boss-lightning-cast',
  "boksul:static": 'boss-lightning-cast',
  "bulttung:melt": 'boss-fire-cast',
  "bungbung:swarm": 'boss-beast-cast',
  "bungbung:swarm2": 'boss-beast-cast',
  "bungbung:swarm2m": 'boss-beast-cast',
  "bungbung:swarmm": 'boss-beast-cast',
  "buri:tickle": 'boss-wind-cast',
  "butler13:order": 'boss-shadow-cast',
  "butler:glove": 'boss-shadow-cast',
  "butler:order": 'boss-shadow-cast',
  "carrier:barrel": 'boss-poison-cast',
  "carrier:bless": 'boss-poison-cast',
  "carrier:bless2": 'boss-poison-cast',
  "chalrang:bubble": 'boss-water-cast',
  "chalrang:sting": 'boss-water-cast',
  "cheolbeok:mud": 'boss-poison-cast',
  "cheolbeok:split": 'boss-earth-cast',
  "chilheuk:order": 'boss-shadow-cast',
  "chilheuk:touch": 'boss-shadow-cast',
  "chingching:buds": 'boss-nature-cast',
  "chingching:spore": 'boss-poison-cast',
  "chingching:vine": 'boss-nature-cast',
  "choir:solo": 'boss-sound-cast',
  "chulleong:order": 'boss-water-cast',
  "collector:adds": 'boss-shadow-cast',
  "cook:helper": 'boss-beast-cast',
  "cook:helper2": 'boss-beast-cast',
  "cook:keeper": 'boss-water-cast',
  "cook:keeper2": 'boss-water-cast',
  "cook:pepper": 'boss-fire-cast',
  "crab36:bubble": 'boss-poison-cast',
  "crab:bubble1": 'boss-poison-cast',
  "crab:bubble1m": 'boss-poison-cast',
  "crab:bubble2": 'boss-poison-cast',
  "crab:bubble2m": 'boss-poison-cast',
  "crystal:detune": 'boss-sound-cast',
  "crystal:echo": 'boss-sound-cast',
  "crystal:echo2": 'boss-sound-cast',
  "dandani:melt": 'boss-fire-cast',
  "dandani:spear": 'boss-blade-cast',
  "degul:cough": 'boss-earth-cast',
  "deolkeong:wheel": 'boss-metal-cast',
  "doeul:touch": 'boss-shadow-cast',
  "dolgae:tickle": 'boss-wind-cast',
  "dooldool:sleepy": 'boss-arcane-cast',
  "dooldool:wrap": 'boss-shadow-cast',
  "dooldool:wrap2": 'boss-shadow-cast',
  "dungdung:static": 'boss-lightning-cast',
  "dwijuk:flip": 'boss-arcane-cast',
  "eodugi:touch": 'boss-shadow-cast',
  "eomgyeok:demerit": 'boss-arcane-cast',
  "eonggeum:count": 'boss-metal-cast',
  "eonggeum:shell": 'boss-earth-cast',
  "eongkim:curse": 'boss-nature-cast',
  "eongkim:knot": 'boss-nature-cast',
  "eongkim:rootloan": 'boss-nature-cast',
  "frostgolem:jail": 'boss-frost-cast',
  "gawison94:rose": 'boss-nature-cast',
  "gawison94:vine": 'boss-nature-cast',
  "gawison:rose": 'boss-nature-cast',
  "gawison:vine": 'boss-nature-cast',
  "geomeun:bowl": 'boss-holy-cast',
  "geomeun:loan": 'boss-shadow-cast',
  "geomeun:touch": 'boss-shadow-cast',
  "geopum46:bubble": 'boss-poison-cast',
  "geopum46:potion": 'boss-poison-cast',
  "geopum:bubble": 'boss-poison-cast',
  "geopum:potion": 'boss-poison-cast',
  "geumeum:toll": 'boss-shadow-cast',
  "geumeum:venom": 'boss-poison-cast',
  "geuneul:dust": 'boss-earth-cast',
  "geuneul:mark": 'boss-shadow-cast',
  "gipeun:mark": 'boss-shadow-cast',
  "gipeun:mark2": 'boss-shadow-cast',
  "gipeun:mark2m": 'boss-shadow-cast',
  "gipeun:markm": 'boss-shadow-cast',
  "gipeun:touch": 'boss-shadow-cast',
  "gitpen78:sign": 'boss-shadow-cast',
  "gitpen:sign": 'boss-shadow-cast',
  "goldbeard44:coin": 'boss-metal-cast',
  "goldbeard:coin": 'boss-metal-cast',
  "goldbeard:coin3": 'boss-metal-cast',
  "goldbeard:crew": 'boss-blade-cast',
  "goldbeard:raincoin": 'boss-metal-cast',
  "goldbeard:treasure": 'boss-metal-cast',
  "guardian23:dust": 'boss-earth-cast',
  "guardian23:stagger": 'boss-earth-cast',
  "guardian:dust": 'boss-earth-cast',
  "guardian:stagger": 'boss-earth-cast',
  "gulgul:dust": 'boss-earth-cast',
  "gunner:barrel": 'boss-blast-cast',
  "gunner:deaf": 'boss-sound-cast',
  "gunner:keg": 'boss-blast-cast',
  "gurit:adds": 'boss-metal-cast',
  "gurit:shake": 'boss-earth-cast',
  "hapum:cough": 'boss-earth-cast',
  "hapum:hunt": 'boss-arcane-cast',
  "hapum:yawn": 'boss-arcane-cast',
  "hatter:hats": 'boss-arcane-cast',
  "hatter:hats2": 'boss-arcane-cast',
  "hatter:hats2m": 'boss-arcane-cast',
  "hatter:hatsm": 'boss-arcane-cast',
  "heukbaek:loan": 'boss-shadow-cast',
  "heukbaek:touch": 'boss-shadow-cast',
  "heumul72:ring": 'boss-holy-cast',
  "heumul:ring": 'boss-holy-cast',
  "heumul:tentacle": 'boss-water-cast',
  "hoeori86:static": 'boss-lightning-cast',
  "hoeori:static": 'boss-lightning-cast',
  "hokdol:haggle": 'boss-metal-cast',
  "hokdol:sneeze": 'boss-fire-cast',
  "huggeun:iron": 'boss-metal-cast',
  "huggeun:ironm": 'boss-metal-cast',
  "huggeun:melt": 'boss-fire-cast',
  "huggeun:splash": 'boss-fire-cast',
  "huu:bowl": 'boss-wind-cast',
  "huu:touch": 'boss-shadow-cast',
  "hwalhwal:lizard": 'boss-fire-cast',
  "hwigami:scale": 'boss-shadow-cast',
  "hwiparam82:curse": 'boss-wind-cast',
  "hwiparam:curse": 'boss-wind-cast',
  "hwirik83:letter": 'boss-wind-cast',
  "hwirik83:tickle": 'boss-wind-cast',
  "hwirik:curse": 'boss-wind-cast',
  "hwirik:letter": 'boss-wind-cast',
  "hydra:breath": 'boss-poison-cast',
  "hydra:breath2": 'boss-poison-cast',
  "hydra:heads": 'boss-beast-cast',
  "hydra:heads2": 'boss-beast-cast',
  "hydra:mender": 'boss-water-cast',
  "icia:armor": 'boss-frost-cast',
  "icia:gaze": 'boss-frost-cast',
  "janmul:venom": 'boss-poison-cast',
  "jigeul66:fume": 'boss-poison-cast',
  "jigeul66:hole": 'boss-fire-cast',
  "jigeul:fume": 'boss-poison-cast',
  "jigeul:hole": 'boss-fire-cast',
  "jiji42:oops": 'boss-arcane-cast',
  "jiji:oops": 'boss-arcane-cast',
  "jilpung:plague": 'boss-poison-cast',
  "jipdan30:crows": 'boss-beast-cast',
  "jipdan30:decoy": 'boss-nature-cast',
  "jipdan:decoy": 'boss-nature-cast',
  "jjaekkak:hunt": 'boss-arcane-cast',
  "jjaekkak:sleepy": 'boss-arcane-cast',
  "jjirit:chain": 'boss-arcane-cast',
  "jjirit:recoil": 'boss-lightning-cast',
  "jjirit:static": 'boss-lightning-cast',
  "jjirit:tail": 'boss-lightning-cast',
  "kalnal98:order": 'boss-shadow-cast',
  "kalnal98:trap": 'boss-metal-cast',
  "kalnal:order": 'boss-shadow-cast',
  "kalnal:plague": 'boss-poison-cast',
  "kalnal:trap": 'boss-metal-cast',
  "kara15:dart": 'boss-poison-cast',
  "kara:dart": 'boss-poison-cast',
  "keeper28:soap": 'boss-water-cast',
  "keeper:otto": 'boss-shadow-cast',
  "keeper:soap": 'boss-water-cast',
  "kkojil:pick": 'boss-metal-cast',
  "kkojil:smoke": 'boss-poison-cast',
  "kkojil:whelp1": 'boss-fire-cast',
  "kkojil:whelp1m": 'boss-fire-cast',
  "kkojil:whelp2": 'boss-fire-cast',
  "kkojil:whelp2m": 'boss-fire-cast',
  "kkongkkong:ribbon": 'boss-arcane-cast',
  "kkongkkong:tickle": 'boss-wind-cast',
  "kkubeok:cough": 'boss-earth-cast',
  "knights68:chain": 'boss-water-cast',
  "knights:chain": 'boss-water-cast',
  "kobold60:smoke": 'boss-poison-cast',
  "kobold60:whelp": 'boss-fire-cast',
  "kungkung:flip": 'boss-arcane-cast',
  "kungkung:swell": 'boss-nature-cast',
  "kungkung:vines": 'boss-nature-cast',
  "kwangkwang:touch": 'boss-shadow-cast',
  "lady:charm": 'boss-arcane-cast',
  "lady:frames": 'boss-shadow-cast',
  "lady:thread": 'boss-arcane-cast',
  "lastecho97:loan": 'boss-shadow-cast',
  "lastecho:loan": 'boss-shadow-cast',
  "lastecho:touch": 'boss-shadow-cast',
  "lastshade:loan": 'boss-shadow-cast',
  "lastshade:loan2": 'boss-shadow-cast',
  "lastshade:trap": 'boss-shadow-cast',
  "lastshade:will": 'boss-shadow-cast',
  "lavender20:scent": 'boss-nature-cast',
  "lavender:scent": 'boss-nature-cast',
  "librarian40:books": 'boss-arcane-cast',
  "librarian:books": 'boss-arcane-cast',
  "librarian:books2": 'boss-arcane-cast',
  "librarian:hush": 'boss-sound-cast',
  "librarian:order": 'boss-arcane-cast',
  "mage:recoil": 'boss-arcane-cast',
  "mage:recoil2": 'boss-arcane-cast',
  "mage:shards": 'boss-frost-cast',
  "mage:unstable": 'boss-arcane-cast',
  "malchor:bless": 'boss-poison-cast',
  "malchor:bless2": 'boss-poison-cast',
  "malmijal70:flower": 'boss-nature-cast',
  "malmijal:flower": 'boss-nature-cast',
  "malmijal:jail": 'boss-water-cast',
  "malos50:chain": 'boss-poison-cast',
  "malos50:prayer": 'boss-poison-cast',
  "malos50:spread": 'boss-poison-cast',
  "malos:chain": 'boss-poison-cast',
  "malos:prayer": 'boss-poison-cast',
  "malos:spread": 'boss-poison-cast',
  "mimic:gold": 'boss-metal-cast',
  "molly10:herb": 'boss-poison-cast',
  "molly:herb": 'boss-poison-cast',
  "monggeul:cream": 'boss-blast-cast',
  "morak:pots": 'boss-nature-cast',
  "morak:pots3": 'boss-nature-cast',
  "morak:ring": 'boss-nature-cast',
  "morak:water": 'boss-water-cast',
  "morel:bubble": 'boss-poison-cast',
  "morel:bubble3": 'boss-poison-cast',
  "mungge:spore": 'boss-poison-cast',
  "mungge:spore2": 'boss-poison-cast',
  "mungge:stagger": 'boss-nature-cast',
  "mungsil64:melt": 'boss-water-cast',
  "mungsil64:smoke": 'boss-fire-cast',
  "mungsil:melt": 'boss-water-cast',
  "mungsil:smoke": 'boss-fire-cast',
  "nadal34:flour": 'boss-nature-cast',
  "nadal:flour": 'boss-nature-cast',
  "nokseul96:dun": 'boss-shadow-cast',
  "nokseul96:loan": 'boss-shadow-cast',
  "nokseul:dun": 'boss-shadow-cast',
  "nokseul:loan": 'boss-shadow-cast',
  "nyanx:riddle": 'boss-arcane-cast',
  "nyanx:riddle2": 'boss-arcane-cast',
  "nyanx:sleepy": 'boss-arcane-cast',
  "octo:arms": 'boss-water-cast',
  "octo:hug": 'boss-water-cast',
  "octo:ink": 'boss-water-cast',
  "octo:ink2": 'boss-water-cast',
  "orben:broken": 'boss-arcane-cast',
  "orben:crystals": 'boss-frost-cast',
  "orben:freeze": 'boss-frost-cast',
  "orben:mana": 'boss-arcane-cast',
  "orben:mana2": 'boss-arcane-cast',
  "orben:recoil": 'boss-arcane-cast',
  "orben:shackle": 'boss-frost-cast',
  "ormal:hunt": 'boss-shadow-cast',
  "ormal:melt": 'boss-shadow-cast',
  "ormal:shards": 'boss-shadow-cast',
  "ormal:shardsm": 'boss-shadow-cast',
  "ormal:touch": 'boss-shadow-cast',
  "pado:brine": 'boss-water-cast',
  "parrot:gust": 'boss-wind-cast',
  "parrot:gust2": 'boss-wind-cast',
  "parrot:mimicry": 'boss-sound-cast',
  "parrot:order": 'boss-sound-cast',
  "parrot:order2": 'boss-sound-cast',
  "peg38:dagger": 'boss-blade-cast',
  "peg38:keg": 'boss-blast-cast',
  "peg:dagger": 'boss-blade-cast',
  "peg:keg": 'boss-blast-cast',
  "peoleok:books": 'boss-wind-cast',
  "peoleok:page": 'boss-arcane-cast',
  "pililli:dance": 'boss-sound-cast',
  "pililli:dance2": 'boss-sound-cast',
  "pililli:troupe": 'boss-nature-cast',
  "pingping:thorn": 'boss-earth-cast',
  "plague33:breath": 'boss-poison-cast',
  "plague33:contagion": 'boss-poison-cast',
  "plague33:sting": 'boss-poison-cast',
  "plague:breath": 'boss-poison-cast',
  "plague:contagion": 'boss-poison-cast',
  "plague:sting": 'boss-poison-cast',
  "pokshin:cough": 'boss-wind-cast',
  "pokshin:fight": 'boss-blunt-cast',
  "poljjak58:dart": 'boss-poison-cast',
  "poljjak:dart": 'boss-poison-cast',
  "polpol54:sneeze": 'boss-wind-cast',
  "polpol:sneeze": 'boss-wind-cast',
  "ponga:keg": 'boss-blast-cast',
  "ponga:keg3": 'boss-blast-cast',
  "ponga:ring": 'boss-nature-cast',
  "pongpong88:flask": 'boss-water-cast',
  "pongpong88:twist": 'boss-arcane-cast',
  "pongpong:flask": 'boss-water-cast',
  "pongpong:twist": 'boss-arcane-cast',
  "ppodeuk25:oops": 'boss-frost-cast',
  "ppodeuk:oops": 'boss-frost-cast',
  "ppyong:clap": 'boss-sound-cast',
  "ppyong:clap2": 'boss-sound-cast',
  "ppyong:clap2m": 'boss-sound-cast',
  "ppyong:clapm": 'boss-sound-cast',
  "ppyong:flip": 'boss-arcane-cast',
  "ppyong:flip2": 'boss-arcane-cast',
  "priestess48:vessel": 'boss-nature-cast',
  "priestess:vessel": 'boss-nature-cast',
  "priestess:vessel2": 'boss-nature-cast',
  "priestess:wilt": 'boss-nature-cast',
  "puseok:cough": 'boss-poison-cast',
  "puseok:cover": 'boss-nature-cast',
  "puseok:mark": 'boss-nature-cast',
  "queen56:sapling": 'boss-nature-cast',
  "ratking:cap": 'boss-projectile-cast',
  "ratking:hunt": 'boss-beast-cast',
  "ratking:rats": 'boss-beast-cast',
  "ratking:rats2": 'boss-beast-cast',
  "revlord:melt": 'boss-metal-cast',
  "revlord:meltm": 'boss-metal-cast',
  "revlord:ring": 'boss-poison-cast',
  "revlord:ringm": 'boss-poison-cast',
  "revlord:touch": 'boss-shadow-cast',
  "rosalin:scent": 'boss-nature-cast',
  "rose:invert": 'boss-nature-cast',
  "rubina:hunt": 'boss-beast-cast',
  "rubina:kids": 'boss-fire-cast',
  "rubina:melt": 'boss-fire-cast',
  "rubina:pearl": 'boss-metal-cast',
  "rubina:showoff": 'boss-metal-cast',
  "sarasha:fan": 'boss-wind-cast',
  "sarasha:gaze": 'boss-arcane-cast',
  "sarasha:maids": 'boss-shadow-cast',
  "scholar:crack": 'boss-frost-cast',
  "scholar:ice": 'boss-frost-cast',
  "scholar:recoil": 'boss-arcane-cast',
  "seawitch:brine": 'boss-water-cast',
  "seawitch:chain": 'boss-water-cast',
  "seawitch:chainB": 'boss-water-cast',
  "seawitch:chainBM": 'boss-water-cast',
  "seawitch:chainC": 'boss-water-cast',
  "seawitch:chainCM": 'boss-water-cast',
  "seawitch:chainM": 'boss-water-cast',
  "serena92:discord": 'boss-sound-cast',
  "serena:discord": 'boss-sound-cast',
  "seres:hunt": 'boss-projectile-cast',
  "seres:sink": 'boss-earth-cast',
  "seres:spirit": 'boss-poison-cast',
  "seres:spirit2": 'boss-poison-cast',
  "seres:venom": 'boss-poison-cast',
  "shadow:mark": 'boss-frost-cast',
  "shadow:pillar": 'boss-frost-cast',
  "shadow:rest": 'boss-shadow-cast',
  "shadow:silence": 'boss-frost-cast',
  "shaman8:dart": 'boss-poison-cast',
  "shaman8:leech": 'boss-beast-cast',
  "shaman:dart": 'boss-poison-cast',
  "shaman:leech": 'boss-beast-cast',
  "shaman:totem": 'boss-earth-cast',
  "shellgod:spit": 'boss-water-cast',
  "shellgod:spit2": 'boss-water-cast',
  "shellgod:stagger": 'boss-earth-cast',
  "silta:eggs": 'boss-beast-cast',
  "silta:fever": 'boss-poison-cast',
  "silta:loan": 'boss-metal-cast',
  "silta:web": 'boss-beast-cast',
  "sippy52:spore": 'boss-poison-cast',
  "sippy:hunt": 'boss-water-cast',
  "sippy:spore1": 'boss-poison-cast',
  "sippy:spore1m": 'boss-poison-cast',
  "sippy:spore2": 'boss-poison-cast',
  "sippy:spore2m": 'boss-poison-cast',
  "sleeper:murmur": 'boss-shadow-cast',
  "sleeper:oath": 'boss-arcane-cast',
  "sleeper:oath2": 'boss-arcane-cast',
  "solsol:chain": 'boss-earth-cast',
  "solsol:cough": 'boss-earth-cast',
  "solsol:sting": 'boss-earth-cast',
  "songi:cough": 'boss-poison-cast',
  "songi:ring": 'boss-nature-cast',
  "songi:ring2": 'boss-nature-cast',
  "ssaengssaeng:curse": 'boss-wind-cast',
  "ssaengssaeng:jab": 'boss-lightning-cast',
  "stargazer:dust": 'boss-earth-cast',
  "swit90:bowl": 'boss-holy-cast',
  "swit90:flip": 'boss-arcane-cast',
  "swit:bowl": 'boss-holy-cast',
  "swit:flip": 'boss-arcane-cast',
  "syungsyung:chain": 'boss-shadow-cast',
  "toktok:pollen": 'boss-nature-cast',
  "toktok:seeds": 'boss-nature-cast',
  "toktok:thorn": 'boss-nature-cast',
  "ttakttak:bubble": 'boss-water-cast',
  "ttakttak:jail": 'boss-beast-cast',
  "ttangttang:stagger": 'boss-metal-cast',
  "ttangttang:staggerm": 'boss-metal-cast',
  "ttemjil62:melt": 'boss-metal-cast',
  "ttemjil:melt": 'boss-metal-cast',
  "ttemjil:soot": 'boss-fire-cast',
  "ttubeok:press": 'boss-nature-cast',
  "twins:curse": 'boss-shadow-cast',
  "twins:mirror": 'boss-arcane-cast',
  "twins:thread": 'boss-arcane-cast',
  "twins:trade": 'boss-arcane-cast',
  "uga:leech": 'boss-beast-cast',
  "uga:ring": 'boss-poison-cast',
  "uga:ring2": 'boss-poison-cast',
  "umulluk:tadpoles": 'boss-beast-cast',
  "ureobal:bind": 'boss-beast-cast',
  "ureobal:swarm": 'boss-shadow-cast',
  "ureureung:curse": 'boss-wind-cast',
  "ureureung:static": 'boss-lightning-cast',
  "uwoong:chord": 'boss-sound-cast',
  "uwoong:chordm": 'boss-sound-cast',
  "uwoong:drops": 'boss-water-cast',
  "uwoong:stagger": 'boss-sound-cast',
  "valen:toast": 'boss-water-cast',
  "whelps:egg": 'boss-fire-cast',
  "whelps:eggm": 'boss-fire-cast',
  "whelps:melt": 'boss-fire-cast',
  "whelps:snort": 'boss-fire-cast',
  // 113 초반 보충 장소 1차 (Lv 5~8, 바로 쓰는 기술)
  "cutter:spirit": 'boss-metal-cast',
  "deolkeok:spirit0": 'boss-metal-cast',
  "deolkeok:spirit1": 'boss-metal-cast',
  "deolkeok:spirit2": 'boss-metal-cast',
  "huuk:fly": 'boss-nature-cast',
  "huuk:flyc": 'boss-nature-cast',
  "eolluk:stain0": 'boss-poison-cast',
  "eolluk:stain1": 'boss-poison-cast',
  "eolluk:stain2": 'boss-poison-cast',
  "eolluk:mold0": 'boss-poison-cast',
  "eolluk:mold1": 'boss-poison-cast',
};
/** 주요 보스의 바로 쓰는 기술마다 따로 (bc-<대본>-<기술>, scripts/sfx/boss-cast.mjs). 있으면 특성 소리보다 먼저 */
export const BOSS_CAST_OWN: Record<string, string> = {
  "abyssheart:loan": 'bc-abyssheart-loan',
  "abyssheart:touch": 'bc-abyssheart-touch',
  "abysslord:echoes": 'bc-abysslord-echoes',
  "abysslord:jail": 'bc-abysslord-jail',
  "abysslord:shard": 'bc-abysslord-shard',
  "abysslord:veil": 'bc-abysslord-veil',
  "amanita:dance": 'bc-amanita-dance',
  "amanita:party": 'bc-amanita-party',
  "amanita:ring": 'bc-amanita-ring',
  "amanita:ringm": 'bc-amanita-ring',
  "amanita:spore": 'bc-amanita-spore',
  "amanita:tree": 'bc-amanita-tree',
  "bamgeuneul:jail": 'bc-bamgeuneul-jail',
  "bamgeuneul:loan": 'bc-bamgeuneul-loan',
  "bamgeuneul:sink": 'bc-bamgeuneul-sink',
  "bamgeuneul:touch": 'bc-bamgeuneul-touch',
  "bamgeuneul:trap": 'bc-bamgeuneul-trap',
  "belmore:invert": 'bc-belmore-invert',
  "belmore:invert2": 'bc-belmore-invert',
  "belmore:ring": 'bc-belmore-ring',
  "belmore:youth": 'bc-belmore-youth',
  "beonjjeok:hoard": 'bc-beonjjeok-hoard',
  "beonjjeok:hunt": 'bc-beonjjeok-hunt',
  "bichumi:dust": 'bc-bichumi-dust',
  "bichumi:fine": 'bc-bichumi-fine',
  "bitgallae:touch": 'bc-bitgallae-touch',
  "bulttung:melt": 'bc-bulttung-melt',
  "bungbung:swarm": 'bc-bungbung-swarm',
  "bungbung:swarm2": 'bc-bungbung-swarm',
  "bungbung:swarm2m": 'bc-bungbung-swarm',
  "bungbung:swarmm": 'bc-bungbung-swarm',
  "buri:tickle": 'bc-buri-tickle',
  "carrier:barrel": 'bc-carrier-barrel',
  "carrier:bless": 'bc-carrier-bless',
  "carrier:bless2": 'bc-carrier-bless',
  "chalrang:bubble": 'bc-chalrang-bubble',
  "chalrang:sting": 'bc-chalrang-sting',
  "cheolbeok:mud": 'bc-cheolbeok-mud',
  "cheolbeok:split": 'bc-cheolbeok-split',
  "chilheuk:order": 'bc-chilheuk-order',
  "chilheuk:touch": 'bc-chilheuk-touch',
  "chingching:buds": 'bc-chingching-buds',
  "chingching:spore": 'bc-chingching-spore',
  "chingching:vine": 'bc-chingching-vine',
  "choir:solo": 'bc-choir-solo',
  "chulleong:order": 'bc-chulleong-order',
  "cook:helper": 'bc-cook-helper',
  "cook:helper2": 'bc-cook-helper',
  "cook:keeper": 'bc-cook-keeper',
  "cook:keeper2": 'bc-cook-keeper',
  "cook:pepper": 'bc-cook-pepper',
  "crab:bubble1": 'bc-crab-bubble1',
  "crab:bubble1m": 'bc-crab-bubble1',
  "crab:bubble2": 'bc-crab-bubble1',
  "crab:bubble2m": 'bc-crab-bubble1',
  "crystal:detune": 'bc-crystal-detune',
  "crystal:echo": 'bc-crystal-echo',
  "crystal:echo2": 'bc-crystal-echo',
  "dandani:melt": 'bc-dandani-melt',
  "dandani:spear": 'bc-dandani-spear',
  "deolkeong:wheel": 'bc-deolkeong-wheel',
  "doeul:touch": 'bc-doeul-touch',
  "dolgae:tickle": 'bc-dolgae-tickle',
  "dooldool:sleepy": 'bc-dooldool-sleepy',
  "dooldool:wrap": 'bc-dooldool-wrap',
  "dooldool:wrap2": 'bc-dooldool-wrap',
  "dungdung:static": 'bc-dungdung-static',
  "dwijuk:flip": 'bc-dwijuk-flip',
  "dwijuk:flip2": 'bc-dwijuk-flip',
  "eodugi:touch": 'bc-eodugi-touch',
  "eomgyeok:demerit": 'bc-eomgyeok-demerit',
  "eonggeum:count": 'bc-eonggeum-count',
  "eonggeum:shell": 'bc-eonggeum-shell',
  "eongkim:curse": 'bc-eongkim-curse',
  "eongkim:knot": 'bc-eongkim-knot',
  "eongkim:rootloan": 'bc-eongkim-rootloan',
  "geomeun:bowl": 'bc-geomeun-bowl',
  "geomeun:loan": 'bc-geomeun-loan',
  "geomeun:touch": 'bc-geomeun-touch',
  "geumeum:toll": 'bc-geumeum-toll',
  "geumeum:venom": 'bc-geumeum-venom',
  "geuneul:dust": 'bc-geuneul-dust',
  "geuneul:mark": 'bc-geuneul-mark',
  "geuneul:mark3": 'bc-geuneul-mark',
  "geuneul:mark3m": 'bc-geuneul-mark',
  "geuneul:markm": 'bc-geuneul-mark',
  "gipeun:mark": 'bc-gipeun-mark',
  "gipeun:mark2": 'bc-gipeun-mark',
  "gipeun:mark2m": 'bc-gipeun-mark',
  "gipeun:markm": 'bc-gipeun-mark',
  "gipeun:touch": 'bc-gipeun-touch',
  "gitpen:sign": 'bc-gitpen-sign',
  "goldbeard:coin": 'bc-goldbeard-coin',
  "goldbeard:coin3": 'bc-goldbeard-coin',
  "goldbeard:crew": 'bc-goldbeard-crew',
  "goldbeard:raincoin": 'bc-goldbeard-coin',
  "goldbeard:treasure": 'bc-goldbeard-treasure',
  "gulgul:dust": 'bc-gulgul-dust',
  "gunner:barrel": 'bc-gunner-barrel',
  "gunner:deaf": 'bc-gunner-deaf',
  "gunner:keg": 'bc-gunner-keg',
  "gurit:adds": 'bc-gurit-adds',
  "gurit:shake": 'bc-gurit-shake',
  "hapum:cough": 'bc-hapum-cough',
  "hapum:hunt": 'bc-hapum-hunt',
  "hapum:yawn": 'bc-hapum-yawn',
  "hatter:hats": 'bc-hatter-hats',
  "hatter:hats2": 'bc-hatter-hats',
  "hatter:hats2m": 'bc-hatter-hats',
  "hatter:hatsm": 'bc-hatter-hats',
  "heukbaek:loan": 'bc-heukbaek-loan',
  "heukbaek:touch": 'bc-heukbaek-touch',
  "heumul:ring": 'bc-heumul-ring',
  "heumul:tentacle": 'bc-heumul-tentacle',
  "hoeori:static": 'bc-hoeori-static',
  "hokdol:haggle": 'bc-hokdol-haggle',
  "hokdol:sneeze": 'bc-hokdol-sneeze',
  "huu:bowl": 'bc-huu-bowl',
  "huu:touch": 'bc-huu-touch',
  "hwalhwal:lizard": 'bc-hwalhwal-lizard',
  "hwigami:scale": 'bc-hwigami-scale',
  "hwirik83:letter": 'bc-hwirik83-letter',
  "hwirik83:tickle": 'bc-hwirik83-tickle',
  "hydra:breath": 'bc-hydra-breath',
  "hydra:breath2": 'bc-hydra-breath2',
  "hydra:heads": 'bc-hydra-heads',
  "hydra:heads2": 'bc-hydra-heads',
  "hydra:mender": 'bc-hydra-mender',
  "icia:armor": 'bc-icia-armor',
  "icia:gaze": 'bc-icia-gaze',
  "janmul:venom": 'bc-janmul-venom',
  "jilpung:plague": 'bc-jilpung-plague',
  "jjaekkak:hunt": 'bc-jjaekkak-hunt',
  "jjaekkak:sleepy": 'bc-jjaekkak-sleepy',
  "jjirit:chain": 'bc-jjirit-chain',
  "jjirit:recoil": 'bc-jjirit-recoil',
  "jjirit:static": 'bc-jjirit-static',
  "jjirit:tail": 'bc-jjirit-tail',
  "keeper:otto": 'bc-keeper-otto',
  "keeper:soap": 'bc-keeper-soap',
  "kkojil:pick": 'bc-kkojil-pick',
  "kkojil:smoke": 'bc-kkojil-smoke',
  "kkojil:whelp1": 'bc-kkojil-whelp1',
  "kkojil:whelp1m": 'bc-kkojil-whelp1',
  "kkojil:whelp2": 'bc-kkojil-whelp1',
  "kkojil:whelp2m": 'bc-kkojil-whelp1',
  "kkongkkong:ribbon": 'bc-kkongkkong-ribbon',
  "kkongkkong:tickle": 'bc-kkongkkong-tickle',
  "kkubeok:cough": 'bc-kkubeok-cough',
  "knights:chain": 'bc-knights-chain',
  "kungkung:flip": 'bc-kungkung-flip',
  "kungkung:swell": 'bc-kungkung-swell',
  "kungkung:vines": 'bc-kungkung-vines',
  "kwangkwang:touch": 'bc-kwangkwang-touch',
  "lastecho:loan": 'bc-lastecho-loan',
  "lastecho:touch": 'bc-lastecho-touch',
  "lastshade:loan": 'bc-lastshade-loan',
  "lastshade:loan2": 'bc-lastshade-loan',
  "lastshade:trap": 'bc-lastshade-trap',
  "lastshade:will": 'bc-lastshade-will',
  "malchor:bless": 'bc-malchor-bless',
  "malchor:bless2": 'bc-malchor-bless',
  "malos:chain": 'bc-malos-chain',
  "malos:prayer": 'bc-malos-prayer',
  "malos:spread": 'bc-malos-spread',
  "mimic:gold": 'bc-mimic-gold',
  "monggeul:cream": 'bc-monggeul-cream',
  "morak:pots": 'bc-morak-pots',
  "morak:pots3": 'bc-morak-pots',
  "morak:ring": 'bc-morak-ring',
  "morak:water": 'bc-morak-water',
  "morel:bubble": 'bc-morel-bubble',
  "morel:bubble3": 'bc-morel-bubble',
  "mungge:spore": 'bc-mungge-spore',
  "mungge:spore2": 'bc-mungge-spore',
  "mungge:stagger": 'bc-mungge-stagger',
  "nadal:flour": 'bc-nadal-flour',
  "nyanx:riddle": 'bc-nyanx-riddle',
  "nyanx:riddle2": 'bc-nyanx-riddle',
  "nyanx:sleepy": 'bc-nyanx-sleepy',
  "octo:arms": 'bc-octo-arms',
  "octo:hug": 'bc-octo-hug',
  "octo:ink": 'bc-octo-ink',
  "octo:ink2": 'bc-octo-ink',
  "orben:broken": 'bc-orben-broken',
  "orben:crystals": 'bc-orben-crystals',
  "orben:freeze": 'bc-orben-freeze',
  "orben:mana": 'bc-orben-mana',
  "orben:mana2": 'bc-orben-mana',
  "orben:recoil": 'bc-orben-recoil',
  "orben:shackle": 'bc-orben-shackle',
  "ormal:hunt": 'bc-ormal-hunt',
  "ormal:melt": 'bc-ormal-melt',
  "ormal:shards": 'bc-ormal-shards',
  "ormal:shardsm": 'bc-ormal-shards',
  "ormal:touch": 'bc-ormal-touch',
  "pado:brine": 'bc-pado-brine',
  "parrot:gust": 'bc-parrot-gust',
  "parrot:gust2": 'bc-parrot-gust',
  "parrot:mimicry": 'bc-parrot-mimicry',
  "parrot:order": 'bc-parrot-order',
  "parrot:order2": 'bc-parrot-order',
  "pililli:dance": 'bc-pililli-dance',
  "pililli:dance2": 'bc-pililli-dance',
  "pililli:troupe": 'bc-pililli-troupe',
  "pingping:thorn": 'bc-pingping-thorn',
  "plague:breath": 'bc-plague-breath',
  "plague:contagion": 'bc-plague-contagion',
  "plague:sting": 'bc-plague-sting',
  "pokshin:cough": 'bc-pokshin-cough',
  "pokshin:fight": 'bc-pokshin-fight',
  "ponga:keg": 'bc-ponga-keg',
  "ponga:keg3": 'bc-ponga-keg',
  "ponga:ring": 'bc-ponga-ring',
  "ppyong:clap": 'bc-ppyong-clap',
  "ppyong:clap2": 'bc-ppyong-clap',
  "ppyong:clap2m": 'bc-ppyong-clap',
  "ppyong:clapm": 'bc-ppyong-clap',
  "ppyong:flip": 'bc-ppyong-flip',
  "ppyong:flip2": 'bc-ppyong-flip',
  "puseok:cough": 'bc-puseok-cough',
  "puseok:cover": 'bc-puseok-cover',
  "puseok:coverm": 'bc-puseok-cover',
  "puseok:mark": 'bc-puseok-mark',
  "revlord:melt": 'bc-revlord-melt',
  "revlord:meltm": 'bc-revlord-melt',
  "revlord:ring": 'bc-revlord-ring',
  "revlord:ringm": 'bc-revlord-ring',
  "revlord:touch": 'bc-revlord-touch',
  "rosalin:scent": 'bc-rosalin-scent',
  "rose:invert": 'bc-rose-invert',
  "rose:invertm": 'bc-rose-invert',
  "rubina:hunt": 'bc-rubina-hunt',
  "rubina:kids": 'bc-rubina-kids',
  "rubina:melt": 'bc-rubina-melt',
  "rubina:pearl": 'bc-rubina-pearl',
  "rubina:showoff": 'bc-rubina-showoff',
  "sarasha:fan": 'bc-sarasha-fan',
  "sarasha:gaze": 'bc-sarasha-gaze',
  "sarasha:maids": 'bc-sarasha-maids',
  "scholar:crack": 'bc-scholar-crack',
  "scholar:ice": 'bc-scholar-ice',
  "scholar:recoil": 'bc-scholar-recoil',
  "seawitch:brine": 'bc-seawitch-brine',
  "seawitch:chain": 'bc-seawitch-chain',
  "seawitch:chainB": 'bc-seawitch-chain',
  "seawitch:chainBM": 'bc-seawitch-chain',
  "seawitch:chainC": 'bc-seawitch-chain',
  "seawitch:chainCM": 'bc-seawitch-chain',
  "seawitch:chainM": 'bc-seawitch-chain',
  "seres:hunt": 'bc-seres-hunt',
  "seres:sink": 'bc-seres-sink',
  "seres:spirit": 'bc-seres-spirit',
  "seres:spirit2": 'bc-seres-spirit',
  "seres:venom": 'bc-seres-venom',
  "shadow:mark": 'bc-shadow-mark',
  "shadow:pillar": 'bc-shadow-pillar',
  "shadow:rest": 'bc-shadow-rest',
  "shadow:silence": 'bc-shadow-silence',
  "shellgod:spit": 'bc-shellgod-spit',
  "shellgod:spit2": 'bc-shellgod-spit',
  "shellgod:stagger": 'bc-shellgod-stagger',
  "silta:eggs": 'bc-silta-eggs',
  "silta:fever": 'bc-silta-fever',
  "silta:loan": 'bc-silta-loan',
  "silta:web": 'bc-silta-web',
  "sleeper:murmur": 'bc-sleeper-murmur',
  "sleeper:oath": 'bc-sleeper-oath',
  "sleeper:oath2": 'bc-sleeper-oath',
  "solsol:chain": 'bc-solsol-chain',
  "solsol:cough": 'bc-solsol-cough',
  "solsol:sting": 'bc-solsol-sting',
  "solsol:sting2": 'bc-solsol-sting',
  "solsol:sting3": 'bc-solsol-sting',
  "songi:cough": 'bc-songi-cough',
  "songi:ring": 'bc-songi-ring',
  "songi:ring2": 'bc-songi-ring',
  "ssaengssaeng:curse": 'bc-ssaengssaeng-curse',
  "ssaengssaeng:jab": 'bc-ssaengssaeng-jab',
  "ssaengssaeng:jabm0": 'bc-ssaengssaeng-jab',
  "ssaengssaeng:jabm1": 'bc-ssaengssaeng-jab',
  "swit:bowl": 'bc-swit-bowl',
  "swit:flip": 'bc-swit-flip',
  "syungsyung:chain": 'bc-syungsyung-chain',
  "toktok:pollen": 'bc-toktok-pollen',
  "toktok:seeds": 'bc-toktok-seeds',
  "toktok:thorn": 'bc-toktok-thorn',
  "ttakttak:bubble": 'bc-ttakttak-bubble',
  "ttakttak:jail": 'bc-ttakttak-jail',
  "ttangttang:stagger": 'bc-ttangttang-stagger',
  "ttangttang:staggerm": 'bc-ttangttang-stagger',
  "ttubeok:press": 'bc-ttubeok-press',
  "twins:curse": 'bc-twins-curse',
  "twins:mirror": 'bc-twins-mirror',
  "twins:thread": 'bc-twins-thread',
  "twins:trade": 'bc-twins-trade',
  "umulluk:tadpoles": 'bc-umulluk-tadpoles',
  "ureobal:bind": 'bc-ureobal-bind',
  "ureobal:swarm": 'bc-ureobal-swarm',
  "ureureung:curse": 'bc-ureureung-curse',
  "ureureung:static": 'bc-ureureung-static',
  "uwoong:chord": 'bc-uwoong-chord',
  "uwoong:chordm": 'bc-uwoong-chord',
  "uwoong:drops": 'bc-uwoong-drops',
  "uwoong:stagger": 'bc-uwoong-stagger',
  "valen:toast": 'bc-valen-toast',
  "whelps:egg": 'bc-whelps-egg',
  "whelps:eggm": 'bc-whelps-egg',
  "whelps:melt": 'bc-whelps-melt',
  "whelps:snort": 'bc-whelps-snort',
};
/** 파티원 능력 (<직업>.<능력>) → 능력마다 소리 (ab-<직업>-<능력>, scripts/sfx/abilities.mjs) */
export const ABILITY_SOUND_OF: Record<string, string> = {
  "archer.aimedShot": 'ab-archer-aimed-shot', // 정조준
  "archer.camo": 'ab-archer-camo', // 위장
  "archer.disengage": 'ab-archer-disengage', // 철수
  "archer.harass": 'ab-archer-harass', // 견제 사격
  "archer.hawkEye": 'ab-archer-hawk-eye', // 매의 눈
  "archer.multiShot": 'ab-archer-multi-shot', // 산탄 사격
  "archer.rapid": 'ab-archer-rapid', // 연발 사격
  "archer.snipe": 'ab-archer-snipe', // 저격
  "archer.survivor": 'ab-archer-survivor', // 생존자의 활력
  "archer.trueshot": 'ab-archer-trueshot', // 정조준의 오라
  "berserker.bShout": 'ab-berserker-b-shout', // 위협의 외침
  "berserker.bladestorm": 'ab-berserker-bladestorm', // 칼날폭풍
  "berserker.charge": 'ab-berserker-charge', // 돌진
  "berserker.deathWish": 'ab-berserker-death-wish', // 죽음의 소원
  "berserker.frenzy": 'ab-berserker-frenzy', // 광란
  "berserker.rage": 'ab-berserker-rage', // 광폭화
  "berserker.rally": 'ab-berserker-rally', // 재집결의 함성
  "berserker.reckless": 'ab-berserker-reckless', // 무모한 희생
  "berserker.regen": 'ab-berserker-regen', // 재생의 격노
  "berserker.whirl": 'ab-berserker-whirl', // 소용돌이
  "hunter.bestial": 'ab-hunter-bestial', // 야수의 격노
  "hunter.callWild": 'ab-hunter-call-wild', // 야생의 부름
  "hunter.cheetah": 'ab-hunter-cheetah', // 치타의 상
  "hunter.feign": 'ab-hunter-feign', // 죽은 척하기
  "hunter.firstAid": 'ab-hunter-first-aid', // 응급 붕대
  "hunter.misdirect": 'ab-hunter-misdirect', // 눈속임
  "hunter.pet": 'ab-hunter-pet', // 동물 동료
  "hunter.primal": 'ab-hunter-primal', // 원초적 격노
  "hunter.trap": 'ab-hunter-trap', // 얼음 덫
  "hunter.turtle": 'ab-hunter-turtle', // 거북의 상
  "mage.blink": 'ab-mage-blink', // 점멸
  "mage.counterspell": 'ab-mage-counterspell', // 주문 차단
  "mage.frostNova": 'ab-mage-frost-nova', // 냉기 회오리
  "mage.iceBarrier": 'ab-mage-ice-barrier', // 얼음 보호막
  "mage.iceBlock": 'ab-mage-ice-block', // 얼음 방패
  "mage.iceWard": 'ab-mage-ice-ward', // 얼음 결계
  "mage.invis": 'ab-mage-invis', // 투명화
  "mage.poly": 'ab-mage-poly', // 변이
  "mage.rewind": 'ab-mage-rewind', // 시간 되돌리기
  "mage.timeWarp": 'ab-mage-time-warp', // 시간 왜곡
  "paladin.avenger": 'ab-paladin-avenger', // 응징의 방패
  "paladin.cleanse": 'ab-paladin-cleanse', // 독소 정화
  "paladin.devotion": 'ab-paladin-devotion', // 헌신의 오라
  "paladin.divineShield": 'ab-paladin-divine-shield', // 천상의 보호막
  "paladin.hammer": 'ab-paladin-hammer', // 심판의 망치
  "paladin.oath": 'ab-paladin-oath', // 영광의 서약
  "paladin.protection": 'ab-paladin-protection', // 보호의 축복
  "paladin.sacrifice": 'ab-paladin-sacrifice', // 희생의 축복
  "paladin.vow": 'ab-paladin-vow', // 수호의 맹세
  "paladin.wrath": 'ab-paladin-wrath', // 정의의 분노
  "rogue.cloak": 'ab-rogue-cloak', // 그림자 망토
  "rogue.deathMark": 'ab-rogue-death-mark', // 죽음의 표적
  "rogue.evasion": 'ab-rogue-evasion', // 회피
  "rogue.kick": 'ab-rogue-kick', // 발차기
  "rogue.kidney": 'ab-rogue-kidney', // 급소 가격
  "rogue.smoke": 'ab-rogue-smoke', // 연막탄
  "rogue.sprint": 'ab-rogue-sprint', // 전력 질주
  "rogue.tricks": 'ab-rogue-tricks', // 속임수 거래
  "rogue.vanish": 'ab-rogue-vanish', // 소멸
  "rogue.vial": 'ab-rogue-vial', // 진홍의 약병
  "swordsman.bladeGuard": 'ab-swordsman-blade-guard', // 칼날 막기
  "swordsman.counter": 'ab-swordsman-counter', // 거합 반격
  "swordsman.draw": 'ab-swordsman-draw', // 발도
  "swordsman.flash": 'ab-swordsman-flash', // 일섬
  "swordsman.guardForm": 'ab-swordsman-guard-form', // 수호 검진
  "swordsman.kiai": 'ab-swordsman-kiai', // 기합
  "swordsman.meditate": 'ab-swordsman-meditate', // 명상
  "swordsman.mushin": 'ab-swordsman-mushin', // 무념무상
  "swordsman.parry": 'ab-swordsman-parry', // 받아넘기기
  "swordsman.wave": 'ab-swordsman-wave', // 검기
  "warrior.bandage": 'ab-warrior-bandage', // 붕대 감기
  "warrior.battleShout": 'ab-warrior-battle-shout', // 전투의 외침
  "warrior.defStance": 'ab-warrior-def-stance', // 방어 태세
  "warrior.demoShout": 'ab-warrior-demo-shout', // 위협의 외침
  "warrior.intervene": 'ab-warrior-intervene', // 가로막기
  "warrior.lastStand": 'ab-warrior-last-stand', // 최후의 저항
  "warrior.shieldBlock": 'ab-warrior-shield-block', // 방패 막기
  "warrior.shieldWall": 'ab-warrior-shield-wall', // 방패의 벽
  "warrior.spellReflect": 'ab-warrior-spell-reflect', // 주문 반사
  "warrior.taunt": 'ab-warrior-taunt', // 도발
};
