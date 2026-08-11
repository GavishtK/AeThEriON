/* =========================================================
   AETHERION — Core Application
   Enhanced with GSAP Animation Orchestration

   Decoupled architecture: WebSocket reception is independent
   of the render loop.  Rendering runs at multiple throttled
   rates:
     - Horizon:        60 FPS  (requestAnimationFrame)
     - Telemetry UI:   15 Hz   (numbers / readouts)
     - Graphs:         15 FPS  (live canvas graphs)
     - Flight state:   10 Hz   (rule-based detection)
     - Diagnostics:     2 Hz   (packet count, uptime)
   ========================================================= */

var AG = {};

(function() {

    // =====================================================
    // CONFIG
    // =====================================================

    AG.ESP32_IP   = "192.168.4.1";
    AG.ESP32_PORT = 81;

    // =====================================================
    // THROTTLE RATES (Hz -> ms between updates)
    // =====================================================

    AG.RATE_HORIZON    = 1000 / 60;
    AG.RATE_TELEMETRY  = 1000 / 15;
    AG.RATE_GRAPH      = 1000 / 15;
    AG.RATE_STATE      = 1000 / 10;
    AG.RATE_DIAG       = 1000 / 2;

    // =====================================================
    // STATE
    // =====================================================

    AG.connected        = false;
    AG.manualDisconnect = false;

    AG.roll       = 0;
    AG.pitch      = 0;
    AG.gForce     = 1;
    AG.gx         = 0;
    AG.gy         = 0;
    AG.gz         = 0;
    AG.ax         = 0;
    AG.ay         = 0;
    AG.az         = 0;

    AG.pktCount       = 0;
    AG.connectTime    = 0;
    AG.startTime      = 0;
    AG.clockOffset    = 0;
    AG.lastPktTime    = 0;

    AG.rateWindow      = [];
    AG.currentRate     = 0;
    AG.latencyWindow   = [];
    AG.avgLatency      = 0;
    AG.maxLatency      = 0;
    AG.transportLat    = 0;
    AG.pktLost         = 0;
    AG.pktExpected     = 0;

    AG.frameCount      = 0;
    AG.fps             = 0;
    AG.fpsTime         = 0;

    AG.history          = [];
    AG.maxHistory       = 200;
    AG.sessionEpoch     = 0;

    AG._lastTelemetry = 0;
    AG._lastGraph     = 0;
    AG._lastState     = 0;
    AG._lastDiag      = 0;

    // Previous telemetry values for pulse detection
    AG._prevValues = {};

    // =====================================================
    // SNAPSHOT
    // =====================================================

    AG.snapshot = function() {
        return {
            t:       Date.now() - AG.sessionEpoch,
            roll:    AG.roll,
            pitch:   AG.pitch,
            gForce:  AG.gForce,
            gx:      AG.gx,
            gy:      AG.gy,
            gz:      AG.gz,
            ax:      AG.ax,
            ay:      AG.ay,
            az:      AG.az
        };
    };

    // =====================================================
    // WEBSOCKET
    // =====================================================

    AG.ws = null;
    AG.reconnectTimer = null;

    AG.connect = function() {
        if (AG.ws) {
            AG.ws.onclose = null;
            AG.ws.close();
        }

        AG.sessionEpoch = Date.now();

        var url = "ws://" + AG.ESP32_IP + ":" + AG.ESP32_PORT;
        AG.ws = new WebSocket(url);

        AG.ws.onopen = function() {
            AG.connected = true;
            AG.connectTime = Date.now();
            AG.pktCount = 0;
            AG.pktExpected = 0;
            AG.pktLost = 0;
            AG.maxLatency = 0;
            AG.latencyWindow = [];
            AG.updateConnectionUI();
            AG.alert("LINK ESTABLISHED — " + url, 4000);
        };

        AG.ws.onmessage = function(e) {
            AG.receivePacket(e.data);
        };

        AG.ws.onclose = function() {
            AG.connected = false;
            AG.updateConnectionUI();
            if (!AG.manualDisconnect) {
                AG.reconnectTimer = setTimeout(AG.connect, 3000);
            }
        };

        AG.ws.onerror = function() {
            AG.connected = false;
        };
    };

    AG.receivePacket = function(raw) {
        var receiveMs = Date.now();

        try {
            var d = JSON.parse(raw);

            if (AG.clockOffset === 0 && d.t !== undefined) {
                AG.clockOffset = receiveMs - d.t;
            }

            if (d.t !== undefined && AG.clockOffset !== 0) {
                var espSendTime = d.t + AG.clockOffset;
                AG.transportLat = receiveMs - espSendTime;
                AG.latencyWindow.push(AG.transportLat);
                if (AG.latencyWindow.length > 200) AG.latencyWindow.shift();
                AG.avgLatency = AG.latencyWindow.reduce(function(s, v) { return s + v; }, 0) / AG.latencyWindow.length;
                if (AG.transportLat > AG.maxLatency) AG.maxLatency = AG.transportLat;
                AG.pktExpected++;
            } else {
                AG.pktExpected++;
            }

            AG.rateWindow.push(receiveMs);
            while (AG.rateWindow.length > 0 && AG.rateWindow[0] < receiveMs - 1000) {
                AG.rateWindow.shift();
            }
            AG.currentRate = AG.rateWindow.length;

            AG.roll  = +d.roll  || 0;
            AG.pitch = +d.pitch || 0;
            AG.gForce = +d.gForce || 1;
            AG.gx    = +d.gx    || 0;
            AG.gy    = +d.gy    || 0;
            AG.gz    = +d.gz    || 0;
            AG.ax    = +d.ax    || 0;
            AG.ay    = +d.ay    || 0;
            AG.az    = +d.az    || 0;

            AG.pktCount++;
            AG.lastPktTime = receiveMs;

            AG.history.push(AG.snapshot());
            if (AG.history.length > AG.maxHistory) {
                AG.history.shift();
            }

            AG.runPacketCallbacks();
        } catch (err) {
            AG.pktLost++;
        }
    };

    AG.disconnect = function() {
        AG.manualDisconnect = true;
        clearTimeout(AG.reconnectTimer);
        if (AG.ws) {
            AG.ws.onclose = null;
            AG.ws.close();
        }
        AG.connected = false;
        AG.updateConnectionUI();
    };

    // =====================================================
    // UI HELPERS
    // =====================================================

    AG.updateConnectionUI = function() {
        var dot  = document.getElementById("connDot");
        var text = document.getElementById("connText");

        if (AG.connected) {
            dot.className = "dot green pulse connected";
            text.textContent = "CONNECTED";
            text.style.color = "var(--green)";
        } else {
            dot.className = "dot red";
            text.textContent = "DISCONNECTED";
            text.style.color = "var(--red)";
        }

        var ipEl = document.getElementById("connIP");
        if (ipEl) ipEl.textContent = AG.ESP32_IP + ":" + AG.ESP32_PORT;
    };

    AG.updateTelemetryUI = function() {
        var newValues = {
            tRoll: AG.roll.toFixed(1),
            tPitch: AG.pitch.toFixed(1),
            tGforce: AG.gForce.toFixed(2),
            tGx: AG.gx.toFixed(3),
            tGy: AG.gy.toFixed(3),
            tGz: AG.gz.toFixed(3),
            tAx: AG.ax.toFixed(2),
            tAy: AG.ay.toFixed(2),
            tAz: AG.az.toFixed(2)
        };

        Object.keys(newValues).forEach(function(id) {
            var el = document.getElementById(id);
            if (el && AG._prevValues[id] !== newValues[id]) {
                el.textContent = newValues[id];
                if (typeof Animations !== 'undefined') {
                    Animations.pulseTelemetry(el);
                }
                AG._prevValues[id] = newValues[id];
            }
        });

        var attRollEl = document.getElementById("attRoll");
        var attPitchEl = document.getElementById("attPitch");

        if (attRollEl) {
            var newRollText = AG.roll.toFixed(1) + "\u00B0";
            if (AG._prevValues.attRoll !== newRollText) {
                attRollEl.textContent = newRollText;
                if (typeof Animations !== 'undefined') {
                    Animations.readoutEffect(attRollEl);
                }
                AG._prevValues.attRoll = newRollText;
            }
        }

        if (attPitchEl) {
            var newPitchText = AG.pitch.toFixed(1) + "\u00B0";
            if (AG._prevValues.attPitch !== newPitchText) {
                attPitchEl.textContent = newPitchText;
                if (typeof Animations !== 'undefined') {
                    Animations.readoutEffect(attPitchEl);
                }
                AG._prevValues.attPitch = newPitchText;
            }
        }

        document.getElementById("rateText").textContent   = AG.currentRate + " Hz";
        document.getElementById("statusRate").textContent = AG.currentRate + " Hz";
        document.getElementById("statusG").textContent    = AG.gForce.toFixed(2) + " G";
        document.getElementById("pktCount").textContent   = AG.pktCount.toLocaleString();
    };

    AG.updateUptime = function() {
        if (AG.connectTime > 0) {
            var sec = Math.floor((Date.now() - AG.connectTime) / 1000);
            var h = Math.floor(sec / 3600);
            var m = Math.floor((sec % 3600) / 60);
            var s = sec % 60;
            var el = document.getElementById("uptime");
            if (el) {
                el.textContent =
                    String(h).padStart(2, "0") + ":" +
                    String(m).padStart(2, "0") + ":" +
                    String(s).padStart(2, "0");
            }
        }
    };

    AG.updateDiagnostics = function() {
        AG.updateUptime();

        document.getElementById("pfRate").textContent    = AG.currentRate + " Hz";
        document.getElementById("pfFPS").textContent     = AG.fps;
        document.getElementById("pfLatAvg").textContent  = AG.avgLatency.toFixed(1) + " ms";
        document.getElementById("pfLatMax").textContent  = AG.maxLatency.toFixed(1) + " ms";

        var loss = AG.pktExpected > 0 ? ((AG.pktLost / AG.pktExpected) * 100) : 0;
        document.getElementById("pfLoss").textContent = loss.toFixed(1) + "%";
    };

    // =====================================================
    // CALLBACK REGISTRATION
    // =====================================================

    AG.callbacks = { horizon: [], telemetry: [], graph: [], state: [], diag: [], packet: [] };

    AG.registerCallback = function(fn, rate) {
        var bucket = AG.callbacks[rate] || AG.callbacks.telemetry;
        bucket.push(fn);
    };

    AG.runPacketCallbacks = function() {
        for (var i = 0; i < AG.callbacks.packet.length; i++) {
            AG.callbacks.packet[i]();
        }
    };

    // =====================================================
    // MAIN RENDER LOOP
    // =====================================================

    AG.tickFPS = function() {
        AG.frameCount++;
        var now = Date.now();
        if (now - AG.fpsTime >= 1000) {
            AG.fps = AG.frameCount;
            AG.frameCount = 0;
            AG.fpsTime = now;
        }
    };

    AG.runCallbacks = function(bucket) {
        for (var i = 0; i < bucket.length; i++) {
            bucket[i]();
        }
    };

    AG.loop = function() {
        var now = Date.now();

        AG.tickFPS();
        AG.runCallbacks(AG.callbacks.horizon);

        if (now - AG._lastTelemetry >= AG.RATE_TELEMETRY) {
            AG._lastTelemetry = now;
            AG.updateTelemetryUI();
            AG.runCallbacks(AG.callbacks.telemetry);
        }

        if (now - AG._lastGraph >= AG.RATE_GRAPH) {
            AG._lastGraph = now;
            AG.runCallbacks(AG.callbacks.graph);
        }

        if (now - AG._lastState >= AG.RATE_STATE) {
            AG._lastState = now;
            AG.runCallbacks(AG.callbacks.state);
        }

        if (now - AG._lastDiag >= AG.RATE_DIAG) {
            AG._lastDiag = now;
            AG.updateDiagnostics();
            AG.runCallbacks(AG.callbacks.diag);
        }

        requestAnimationFrame(AG.loop);
    };

    AG.startLoop = function() {
        AG.fpsTime = Date.now();
        AG._lastTelemetry = 0;
        AG._lastGraph = 0;
        AG._lastState = 0;
        AG._lastDiag = 0;
        requestAnimationFrame(AG.loop);
    };

    // =====================================================
    // TABS — ENHANCED WITH GSAP TRANSITIONS
    // =====================================================

    AG.currentTab = "live";

    AG.initTabs = function() {
        var tabs = document.querySelectorAll(".tab");
        tabs.forEach(function(tab) {
            tab.addEventListener("click", function() {
                tabs.forEach(function(t) { t.classList.remove("active"); });
                tab.classList.add("active");

                var name = tab.dataset.tab;
                AG.currentTab = name;

                document.querySelectorAll(".tab-content").forEach(function(tc) {
                    tc.classList.remove("active");
                });

                var newTab = document.getElementById("tab-" + name);
                newTab.classList.add("active");

                if (name === "live" && typeof Horizon !== 'undefined' && Horizon.resize) {
                    Horizon.resize();
                }

                if (typeof Animations !== 'undefined') {
                    Animations.tabIn(newTab);
                }
            });
        });
    };

    // =====================================================
    // ALERT
    // =====================================================

    AG.alert = function(msg, duration) {
        var el = document.getElementById("alert");
        if (!el) return;
        el.textContent = msg;
        el.classList.remove("hidden");
        clearTimeout(AG._alertTimer);
        AG._alertTimer = setTimeout(function() {
            el.classList.add("hidden");
        }, duration || 3000);
    };

    // =====================================================
    // INIT
    // =====================================================

    AG.init = function() {
        AG.initTabs();

        if (typeof Animations  !== "undefined" && Animations.init)  Animations.init();
        if (typeof Horizon     !== "undefined" && Horizon.init)      Horizon.init();
        if (typeof Graphs      !== "undefined" && Graphs.init)       Graphs.init();
        if (typeof FlightState !== "undefined" && FlightState.init)  FlightState.init();
        if (typeof Recorder    !== "undefined" && Recorder.init)     Recorder.init();
        if (typeof Analysis    !== "undefined" && Analysis.init)     Analysis.init();
        if (typeof Settings    !== "undefined" && Settings.init)     Settings.init();

        AG.startLoop();
        AG.connect();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", AG.init);
    } else {
        AG.init();
    }

})();
