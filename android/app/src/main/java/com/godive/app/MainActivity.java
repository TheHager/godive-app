package com.godive.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import com.godive.plugin.dive.DiveServicePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DiveServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
