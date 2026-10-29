package com.solohealer.game;

import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 전체화면 (09 5장, Lim 2026-10-07): 상태 표시줄·내비게이션 바를 숨기고 노치(화면 잘림)까지 그린다.
 * 화면 맨 위부터 노치 포함 70dp는 웹 쪽에서 배너 영역으로 비운다.
 * 화면 초당 60장 (2026-10-22 Lim 「화면을 초당 60hz를 요청하자」, 발열 점검): 게임 창이 떠 있는 동안 폰 화면을 60Hz로.
 */
public class MainActivity extends BridgeActivity {

    /** 요청하는 화면 주사율 (Hz). 120Hz 폰에서 그리기 · 합성 · 화면 모두 이 주기로 돈다 */
    private static final float REFRESH_HZ = 60f;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ElapsedClockPlugin.class); // 경과 시계 (기획 120 9-3, 게임 시각 = 서버 시각 + 부팅 뒤 흐른 시간)
        super.onCreate(savedInstanceState);
        enterFullscreen();
        requestRefreshRate();
    }

    /**
     * 지금 해상도에서 60Hz인 화면 모드를 찾아 요청 (preferredDisplayModeId). 그런 모드가 없는 폰은 주사율만 요청.
     * 60Hz보다 느린 화면 (60Hz 고정 폰)은 아무것도 바뀌지 않는다.
     */
    private void requestRefreshRate() {
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ? getDisplay() : getWindowManager().getDefaultDisplay();
        if (display != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Display.Mode cur = display.getMode();
            for (Display.Mode m : display.getSupportedModes()) {
                if (m.getPhysicalWidth() == cur.getPhysicalWidth() && m.getPhysicalHeight() == cur.getPhysicalHeight()
                        && Math.abs(m.getRefreshRate() - REFRESH_HZ) < 1f) {
                    lp.preferredDisplayModeId = m.getModeId();
                    break;
                }
            }
        }
        lp.preferredRefreshRate = REFRESH_HZ;
        getWindow().setAttributes(lp);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterFullscreen();
    }

    private void enterFullscreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.hide(WindowInsetsCompat.Type.systemBars());
        // 가장자리를 쓸면 잠깐 보였다가 다시 숨음
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
