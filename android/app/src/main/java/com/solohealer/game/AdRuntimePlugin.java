package com.solohealer.game;

import android.content.pm.ApplicationInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.UserMessagingPlatform;

@CapacitorPlugin(name = "AdRuntime")
public class AdRuntimePlugin extends Plugin {
    @PluginMethod
    public void getInfo(PluginCall call) {
        ConsentInformation consent = UserMessagingPlatform.getConsentInformation(getContext());
        JSObject info = new JSObject();
        info.put("debuggable", (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        info.put("canRequestAds", consent.canRequestAds());
        info.put("privacyOptionsRequired", consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED);
        call.resolve(info);
    }
}
