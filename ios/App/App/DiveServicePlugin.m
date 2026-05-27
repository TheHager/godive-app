#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Define the plugin using the CAP_PLUGIN Macro, and
// each method the plugin supports using the CAP_PLUGIN_METHOD macro.
CAP_PLUGIN(DiveServicePlugin, "DiveService",
           CAP_PLUGIN_METHOD(startTimer, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(extendTimer, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopTimer, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(requestCriticalAlertPermission, CAPPluginReturnPromise);
)
