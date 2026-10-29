package com.solohealer.game;

import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 기기 키 (기획 120 9-2b, 한 계정 = 한 기기): 앱 설치 번호를 이 폰에 묶는 값. ANDROID_ID (같은 앱 서명 · 같은 폰 · 같은 사용자면 같음)의
 * SHA-256 해시만 주고, 서버로 보내지 않는다. 저장이 다른 폰으로 복사되면 (안드로이드 자동 백업 · 직접 복사) 키가 달라 앱이 새 설치 번호를 만든다
 */
@CapacitorPlugin(name = "DeviceKey")
public class DeviceKeyPlugin extends Plugin {

    @PluginMethod
    public void key(PluginCall call) {
        String raw = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
        JSObject r = new JSObject();
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(("healer:" + (raw == null ? "" : raw)).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : h) sb.append(String.format("%02x", b));
            r.put("key", sb.toString());
        } catch (Exception e) {
            r.put("key", "");
        }
        call.resolve(r);
    }
}
