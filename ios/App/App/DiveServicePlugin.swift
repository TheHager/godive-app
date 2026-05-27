import Foundation
import Capacitor
import UserNotifications
import AVFoundation
import UIKit
import CoreBluetooth

@objc(DiveServicePlugin)
public class DiveServicePlugin: CAPPlugin {
    
    private var timer: Timer?
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
    private var remainingSeconds: Int = 0
    private var diveId: String = ""
    
    // BLE Managers
    private var peripheralManager: CBPeripheralManager?
    private var centralManager: CBCentralManager?
    private var bleDistressPayload: String = ""
    
    // BLE UUIDs
    private let DISTRESS_SERVICE_UUID = CBUUID(string: "0000DEAD-0000-1000-8000-00805F9B34FB")
    private let PAYLOAD_CHARACTERISTIC_UUID = CBUUID(string: "0000DEAE-0000-1000-8000-00805F9B34FB")
    private let SAFE_CHARACTERISTIC_UUID = CBUUID(string: "0000DEAF-0000-1000-8000-00805F9B34FB")
    
    override public func load() {
        // Automatically configure audio session on load
        configureAudioSessionForDistress()
    }
    
    @objc func requestCriticalAlertPermission(_ call: CAPPluginCall? = nil) {
        let center = UNUserNotificationCenter.current()
        // Note: .criticalAlert requires the special com.apple.developer.usernotifications.critical-alerts entitlement.
        center.requestAuthorization(options: [.alert, .sound, .badge, .criticalAlert]) { granted, error in
            if let error = error {
                print("Error requesting Critical Alert permission: \(error.localizedDescription)")
            }
            call?.resolve(["granted": granted])
        }
    }
    
    @objc func startTimer(_ call: CAPPluginCall) {
        guard let durationMs = call.getDouble("durationMs") else {
            call.reject("durationMs is required")
            return
        }
        
        self.diveId = call.getString("diveId") ?? "unknown_dive"
        self.remainingSeconds = Int(durationMs / 1000)
        
        // 1. Schedule the Critical Alert local notification as an OS-level fail-safe
        // Even if the OS completely suspends our app, this notification will fire and wake the screen.
        scheduleCriticalAlert(inSeconds: TimeInterval(self.remainingSeconds))
        
        // 2. Request maximum background execution time
        registerBackgroundTask()
        
        // 3. Start internal JS-bridged timer
        DispatchQueue.main.async {
            self.timer?.invalidate()
            self.timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
                self?.tick()
            }
        }
        
        call.resolve()
    }
    
    @objc func extendTimer(_ call: CAPPluginCall) {
        guard let additionalMs = call.getDouble("additionalMs") else {
            call.reject("additionalMs is required")
            return
        }
        
        let additionalSeconds = Int(additionalMs / 1000)
        self.remainingSeconds += additionalSeconds
        
        // Reschedule the fail-safe notification to the new future time
        cancelCriticalAlerts()
        scheduleCriticalAlert(inSeconds: TimeInterval(self.remainingSeconds))
        
        call.resolve()
    }
    
    @objc func stopTimer(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.timer?.invalidate()
            self.timer = nil
        }
        cancelCriticalAlerts()
        endBackgroundTask()
        
        // Restore standard audio mixing
        configureAudioSessionForDistress()
        
        call.resolve()
    }
    
    private func tick() {
        self.remainingSeconds -= 1
        
        if self.remainingSeconds <= 0 {
            // Timer expired!
            DispatchQueue.main.async {
                self.timer?.invalidate()
                self.timer = nil
            }
            
            // Notify the Capacitor JS layer
            self.notifyListeners("timerExpired", data: [:])
            
            // Force audio priority to duck Spotify/Podcasts for the distress alarm
            playDistressAudioOverride()
            
            endBackgroundTask()
        }
    }
    
    private func scheduleCriticalAlert(inSeconds seconds: TimeInterval) {
        let center = UNUserNotificationCenter.current()
        let content = UNMutableNotificationContent()
        content.title = "DIVE OVERDUE - DISTRESS ACTIVE"
        content.body = "Your dive timer has expired. Initiating local mesh and cloud distress protocols."
        
        // Critical alerts bypass the hardware mute switch and Do Not Disturb.
        if #available(iOS 12.0, *) {
            // You can replace this with a custom loud sound bundled in the app
            content.sound = UNNotificationSound.defaultCritical
        } else {
            content.sound = .default
        }
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(seconds, 1.0), repeats: false)
        let request = UNNotificationRequest(identifier: "DiveDistressAlert", content: content, trigger: trigger)
        
        center.add(request) { error in
            if let error = error {
                print("Failed to schedule critical alert: \(error)")
            }
        }
    }
    
    private func cancelCriticalAlerts() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["DiveDistressAlert"])
    }
    
    private func registerBackgroundTask() {
        self.backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            // Expiration handler: OS is forcing us to suspend.
            // If we had BLE running, we'd log this constraint.
            self?.endBackgroundTask()
        }
    }
    
    private func endBackgroundTask() {
        if self.backgroundTask != .invalid {
            UIApplication.shared.endBackgroundTask(self.backgroundTask)
            self.backgroundTask = .invalid
        }
    }
    
    private func configureAudioSessionForDistress() {
        do {
            let session = AVAudioSession.sharedInstance()
            // .playback guarantees it plays even when the silent switch is engaged.
            // .mixWithOthers ensures we don't accidentally kill the user's music during a normal dive.
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            print("Failed to set audio session category: \(error)")
        }
    }
    
    private func playDistressAudioOverride() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .alarm, options: [.duckOthers])
            try session.setActive(true)
        } catch {
            print("Failed to set distress audio override: \(error)")
        }
    }
    
    // MARK: - BLE Mesh Methods
    
    @objc func startDistressAdvertising(_ call: CAPPluginCall) {
        let diverId = call.getString("diverId") ?? "unknown"
        let lat = call.getDouble("lat") ?? 0.0
        let lng = call.getDouble("lng") ?? 0.0
        let bat = call.getInt("batteryLevel") ?? 100
        
        // Encode payload
        let payloadDict: [String: Any] = ["id": diverId, "lat": lat, "lng": lng, "bat": bat]
        if let jsonData = try? JSONSerialization.data(withJSONObject: payloadDict),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            self.bleDistressPayload = jsonString
        }
        
        // Start BLE Peripheral
        if peripheralManager == nil {
            peripheralManager = CBPeripheralManager(delegate: self, queue: nil)
        } else if peripheralManager?.state == .poweredOn {
            startAdvertisingInternal()
        }
        
        // Start Scanning for buddies nearby to notify us if they receive it (mesh)
        if centralManager == nil {
            centralManager = CBCentralManager(delegate: self, queue: nil)
        } else if centralManager?.state == .poweredOn {
            startScanningInternal()
        }
        
        call.resolve()
    }
    
    @objc func stopAdvertising(_ call: CAPPluginCall) {
        peripheralManager?.stopAdvertising()
        centralManager?.stopScan()
        call.resolve()
    }
    
    private func startAdvertisingInternal() {
        let payloadChar = CBMutableCharacteristic(type: PAYLOAD_CHARACTERISTIC_UUID, properties: [.read], value: bleDistressPayload.data(using: .utf8), permissions: [.readable])
        let safeChar = CBMutableCharacteristic(type: SAFE_CHARACTERISTIC_UUID, properties: [.write], value: nil, permissions: [.writeable])
        
        let service = CBMutableService(type: DISTRESS_SERVICE_UUID, primary: true)
        service.characteristics = [payloadChar, safeChar]
        
        peripheralManager?.removeAllServices()
        peripheralManager?.add(service)
        
        peripheralManager?.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [DISTRESS_SERVICE_UUID]
        ])
    }
    
    private func startScanningInternal() {
        centralManager?.scanForPeripherals(withServices: [DISTRESS_SERVICE_UUID], options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
    }
}

// MARK: - CoreBluetooth Delegates

extension DiveServicePlugin: CBPeripheralManagerDelegate {
    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        if peripheral.state == .poweredOn && !bleDistressPayload.isEmpty {
            startAdvertisingInternal()
        }
    }
    
    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            if request.characteristic.uuid == SAFE_CHARACTERISTIC_UUID {
                // A buddy marked us as safe!
                peripheralManager?.respond(to: request, withResult: .success)
                
                // Stop advertising and notify JS
                self.peripheralManager?.stopAdvertising()
                self.centralManager?.stopScan()
                
                DispatchQueue.main.async {
                    self.notifyListeners("safeReceived", data: [:])
                }
            }
        }
    }
}

extension DiveServicePlugin: CBCentralManagerDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn && !bleDistressPayload.isEmpty {
            startScanningInternal()
        }
    }
    
    public func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        // Discovered another distressed diver!
        // In a real app we'd connect to read the payload. For now we notify JS.
        print("Discovered distressed diver: \(peripheral.identifier)")
    }
}
