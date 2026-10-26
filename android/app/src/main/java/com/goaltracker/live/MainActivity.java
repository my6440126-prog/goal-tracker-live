package com.goaltracker.live;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NativeStepCounterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
