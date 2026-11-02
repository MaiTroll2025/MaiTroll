package com.maitroll.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FirebaseAvailability")
public class FirebaseAvailabilityPlugin extends Plugin {
    @PluginMethod
    public void isInitialized(PluginCall call) {
        JSObject result = new JSObject();
        int appIdResource = getContext().getResources().getIdentifier(
            "google_app_id",
            "string",
            getContext().getPackageName()
        );
        result.put("initialized", appIdResource != 0);
        call.resolve(result);
    }
}
