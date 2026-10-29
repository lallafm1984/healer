package com.lallafm.healer;

import android.os.SystemClock;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 경과 시계 (기획 120 9-3): 게임 시각 = 서버 시각 + 부팅 뒤 흐른 시간. 기기 시계를 바꿔도 변하지 않는 값만 준다.
 * elapsed = SystemClock.elapsedRealtime() (잠든 시간 포함, ms), boot = 부팅 횟수 (Settings.Global.BOOT_COUNT, 재부팅 알아보기)
 */
@CapacitorPlugin(name = "ElapsedClock")
public class ElapsedClockPlugin extends Plugin {

    @PluginMethod
    public void now(PluginCall call) {
        JSObject r = new JSObject();
        r.put("elapsed", SystemClock.elapsedRealtime());
        String boot;
        try {
            boot = "c" + Settings.Global.getInt(getContext().getContentResolver(), Settings.Global.BOOT_COUNT);
        } catch (Exception e) {
            // 부팅 횟수를 못 읽는 폰: 부팅한 시각 (분 단위로 묶음). 시계를 바꾸면 다른 부팅으로 보여 늦는 쪽으로만 틀림
            boot = "t" + ((System.currentTimeMillis() - SystemClock.elapsedRealtime()) / 60000L);
        }
        r.put("boot", boot);
        call.resolve(r);
    }
}
