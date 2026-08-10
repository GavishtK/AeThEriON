/* =========================================================
   AETHERION — Analysis: Replay, Metrics, Control, Health
   ========================================================= */

var Analysis = {};

(function() {

    var activeSession = null;
    var replayCtx = null;
    var replayCanvas = null;

    // Replay state
    var replayPlaying = false;
    var replayPaused = false;
    var replayPosition = 0;      // index into samples
    var replaySpeed = 1.0;       // 1x playback
    var replayTimer = null;

    // =====================================================
    // INIT
    // =====================================================

    Analysis.init = function() {
        replayCanvas = document.getElementById("replayHorizon");
        if (replayCanvas) {
            replayCtx = replayCanvas.getContext("2d");
            // Set initial dimensions
            replayCanvas.width  = replayCanvas.width  || 500;
            replayCanvas.height = replayCanvas.height || 350;
        }

        Analysis.bindReplayButtons();
        Analysis.bindMLButtons();
        window.addEventListener("resize", function() {
            if (replayCanvas && document.getElementById("replayContent")) {
                if (document.getElementById("replayContent").style.display !== "none") {
                    Analysis.resizeReplay();
                    if (activeSession) Analysis.seek(replayPosition);
                }
            }
        });
    };

    Analysis.bindReplayButtons = function() {
        var btnStart = document.getElementById("rpStart");
        var btnPlay  = document.getElementById("rpPlay");
        var btnPause = document.getElementById("rpPause");
        var slider   = document.getElementById("rpSlider");

        if (btnStart) btnStart.addEventListener("click", Analysis.replayToStart);
        if (btnPlay)  btnPlay.addEventListener("click", Analysis.replayPlay);
        if (btnPause) btnPause.addEventListener("click", Analysis.replayPause);
        if (slider) {
            slider.addEventListener("input", function(e) {
                Analysis.seek(parseFloat(e.target.value));
            });
            slider.addEventListener("change", function(e) {
                Analysis.seek(parseFloat(e.target.value));
            });
        }
    };

    // =====================================================
    // LOAD SESSION
    // =====================================================

    Analysis.loadSession = function(session) {
        activeSession = session;

        // Show replay content, hide empty state
        var emptyEl = document.getElementById("replayEmpty");
        var contentEl = document.getElementById("replayContent");
        if (emptyEl) emptyEl.style.display = "none";
        if (contentEl) contentEl.style.display = "block";

        var slider = document.getElementById("rpSlider");
        if (slider) {
            slider.max = session.samples.length - 1;
            slider.value = 0;
        }

        Analysis.resizeReplay();
        Analysis.seek(0);
        Analysis.computeAll();
    };

    Analysis.resizeReplay = function() {
        if (!replayCanvas) return;
        replayCanvas.width = replayCanvas.offsetWidth;
        replayCanvas.height = replayCanvas.offsetHeight;
        replayCtx = replayCanvas.getContext("2d");
    };

    Analysis.computeAll = function() {
        if (!activeSession) return;

        Analysis.computeStabilityMetrics();
        Analysis.computeControlAnalysis();
        Analysis.checkSensorHealth();
        Analysis.updateSystemPerf();
        Analysis.updateMLPanel();
    };

    // =====================================================
    // STABILITY METRICS
    // =====================================================

    Analysis.computeStabilityMetrics = function() {
        var s = activeSession;
        if (!s || !s.samples || s.samples.length === 0) return;

        var samples = s.samples;
        var n = samples.length;

        var rollSq = 0, pitchSq = 0, rateSq = 0;
        var rollMax = 0, pitchMax = 0, gMax = 0;
        var rollSum = 0, pitchSum = 0;

        for (var i = 0; i < n; i++) {
            var sm = samples[i];
            var r = Math.abs(sm.roll), p = Math.abs(sm.pitch);

            rollSq  += sm.roll * sm.roll;
            pitchSq += sm.pitch * sm.pitch;
            rateSq  += (sm.gx * sm.gx + sm.gy * sm.gy + sm.gz * sm.gz);

            if (r > rollMax) rollMax = r;
            if (p > pitchMax) pitchMax = p;
            if (sm.gForce > gMax) gMax = sm.gForce;

            rollSum += r;
            pitchSum += p;
        }

        var rollRMS  = Math.sqrt(rollSq / n);
        var pitchRMS = Math.sqrt(pitchSq / n);
        var rateRMS  = Math.sqrt(rateSq / n);

        document.getElementById("stabRollRMS").textContent  = rollRMS.toFixed(2) + "°";
        document.getElementById("stabPitchRMS").textContent = pitchRMS.toFixed(2) + "°";
        document.getElementById("stabAngRMS").textContent   = rateRMS.toFixed(3) + " rad/s";
        document.getElementById("stabRollPeak").textContent = rollMax.toFixed(1) + "°";
        document.getElementById("stabPitchPeak").textContent = pitchMax.toFixed(1) + "°";
        document.getElementById("stabGPeak").textContent     = gMax.toFixed(2) + " G";

        // Stability Score
        var score = 100;
        score -= rollRMS * 1.5;
        score -= pitchRMS * 1.2;
        score -= rateRMS * 30;
        var avgG = gMax;
        score -= Math.max(0, avgG - 1.2) * 20;

        score = Math.max(0, Math.min(100, score));
        document.getElementById("stabScore").textContent = score.toFixed(0) + "/100";
        document.getElementById("stabScore").style.color =
            score > 80 ? "var(--green)" : score > 60 ? "var(--amber)" : "var(--red)";
    };

    // =====================================================
    // CONTROL ANALYSIS
    // =====================================================

    Analysis.computeControlAnalysis = function() {
        var s = activeSession;
        if (!s || !s.samples || s.samples.length === 0) return;

        var samples = s.samples;
        var n = samples.length;

        // Roll RMS for roll control quality
        var rollSq = 0;
        for (var i = 0; i < n; i++) rollSq += samples[i].roll * samples[i].roll;
        var rollRMS = Math.sqrt(rollSq / n);

        var pitchSq = 0;
        for (var i = 0; i < n; i++) pitchSq += samples[i].pitch * samples[i].pitch;
        var pitchRMS = Math.sqrt(pitchSq / n);

        // Correction rate: count direction changes in roll
        var changes = 0;
        var lastDelta = 0;
        for (var i = 1; i < n; i++) {
            var delta = samples[i].roll - samples[i - 1].roll;
            if (lastDelta !== 0) {
                if ((delta > 0 && lastDelta < 0) || (delta < 0 && lastDelta > 0)) {
                    changes++;
                }
            }
            lastDelta = delta;
        }

        var correctionRate = changes / (n > 1 ? (n - 1) / 10 : 1);

        // Oscillation: std dev of roll deltas
        var deltas = [];
        for (var i = 1; i < n; i++) deltas.push(samples[i].roll - samples[i - 1].roll);
        var deltaSum = deltas.reduce(function(a, b) { return a + b; }, 0);
        var deltaMean = deltaSum / deltas.length;
        var deltaSq = deltas.reduce(function(a, b) { return a + (b - deltaMean) * (b - deltaMean); }, 0);
        var oscillation = Math.sqrt(deltaSq / deltas.length);

        // Recovery: check last 20% of data for stability
        var tailStart = Math.floor(n * 0.8);
        var tailRolls = [];
        for (var i = tailStart; i < n; i++) tailRolls.push(Math.abs(samples[i].roll));
        var tailRMS = Math.sqrt(tailRolls.reduce(function(a, b) { return a + b * b; }, 0) / tailRolls.length);

        // Classify
        Analysis.setBadge("ctrlRoll",   Analysis.classifyRMS(rollRMS,  [5, 10, 20]));
        Analysis.setBadge("ctrlPitch",  Analysis.classifyRMS(pitchRMS, [5, 10, 20]));
        Analysis.setBadge("ctrlCorr",   correctionRate < 0.3 ? "LOW" : correctionRate < 0.6 ? "MODERATE" : "HIGH",
            correctionRate < 0.3 ? "good" : correctionRate < 0.6 ? "moderate" : "poor");
        Analysis.setBadge("ctrlOsc",    oscillation < 0.5 ? "LOW" : oscillation < 1.5 ? "MODERATE" : "HIGH",
            oscillation < 0.5 ? "good" : oscillation < 1.5 ? "moderate" : "poor");
        Analysis.setBadge("ctrlRecov",  tailRMS < 5 ? "GOOD" : tailRMS < 12 ? "MODERATE" : "POOR",
            tailRMS < 5 ? "good" : tailRMS < 12 ? "moderate" : "poor");
    };

    Analysis.classifyRMS = function(rms, thresholds) {
        if (rms < thresholds[0]) return Analysis.badge("GOOD", "good");
        if (rms < thresholds[1]) return Analysis.badge("MODERATE", "moderate");
        if (rms < thresholds[2]) return Analysis.badge("FAIR", "moderate");
        return Analysis.badge("POOR", "poor");
    };

    Analysis.badge = function(text, cls) {
        return { text: text, cls: cls };
    };

    Analysis.setBadge = function(id, textOrObj, cssClass) {
        var el = document.getElementById(id);
        if (!el) return;

        var text, cls;
        if (typeof textOrObj === "object") {
            text = textOrObj.text;
            cls = "ctrl-badge " + textOrObj.cls;
        } else {
            text = textOrObj;
            cls = "ctrl-badge " + cssClass;
        }

        el.textContent = text;
        el.className = cls;
    };

    // =====================================================
    // SENSOR HEALTH
    // =====================================================

    Analysis.checkSensorHealth = function() {
        var s = activeSession;
        if (!s || !s.samples || s.samples.length === 0) return;

        var samples = s.samples;
        var n = samples.length;

        var issues = {
            missing: 0,
            saturation: 0,
            noise: 0,
            abnormalG: 0
        };

        // Check for gaps in timestamps (missing packets)
        for (var i = 1; i < n; i++) {
            var dt = samples[i].t - samples[i - 1].t;
            var expected = 20; // 50ms = 20Hz minimum
            if (dt > expected * 3) {
                issues.missing += Math.floor(dt / expected) - 1;
            }
        }

        // Check saturation & noise & abnormal G
        var axVals = [], ayVals = [], azVals = [];
        var gxVals = [], gyVals = [], gzVals = [];
        var gForces = [];

        for (var i = 0; i < n; i++) {
            var sm = samples[i];
            axVals.push(sm.ax); ayVals.push(sm.ay); azVals.push(sm.az);
            gxVals.push(sm.gx); gyVals.push(sm.gy); gzVals.push(sm.gz);
            gForces.push(sm.gForce);

            // Saturation (MPU6050 range ±16g, ±2000 deg/s)
            if (Math.abs(sm.ax) > 15 || Math.abs(sm.ay) > 15 || Math.abs(sm.az) > 15) issues.saturation++;
            if (Math.abs(sm.gx) > 3.49 || Math.abs(sm.gy) > 3.49 || Math.abs(sm.gz) > 3.49) issues.saturation++;

            if (sm.gForce > 2.5 || sm.gForce < 0.3) issues.abnormalG++;
        }

        // Noise: std dev when nearly static (roll < 5)
        var staticSamples = samples.filter(function(sm) { return Math.abs(sm.roll) < 5 && Math.abs(sm.pitch) < 5; });
        if (staticSamples.length > 5) {
            var meanAx = axVals.reduce(function(a, b) { return a + b; }, 0) / axVals.length;
            var varAx = axVals.reduce(function(a, b) { return a + (b - meanAx) * (b - meanAx); }, 0) / axVals.length;
            if (Math.sqrt(varAx) > 0.5) issues.noise++;
        }

        // Quality score
        var quality = 100;
        quality -= (issues.missing / n) * 500;
        quality -= (issues.saturation / n) * 300;
        quality -= (issues.abnormalG / n) * 200;
        quality -= (issues.noise / n) * 100;
        quality = Math.max(0, Math.min(100, quality));

        document.getElementById("hpQuality").style.width = quality.toFixed(0) + "%";
        document.getElementById("hpQualityText").textContent = quality.toFixed(0) + "%";

        var qualityEl = document.getElementById("hpQuality");
        qualityEl.style.background = quality > 80 ? "var(--green)" : quality > 60 ? "var(--amber)" : "var(--red)";

        // Connection status
        var hpWiFi = document.getElementById("hpWiFi");
        hpWiFi.className = "dot " + (AG.connected ? "green" : "red");

        if (AG.alert && issues.missing > 0) {
            console.log("Sensor health: " + issues.missing + " possible missing packets");
        }
    };

    // =====================================================
    // SYSTEM PERFORMANCE (from session data)
    // =====================================================

    Analysis.updateSystemPerf = function() {
        var s = activeSession;
        if (!s || !s.samples || s.samples.length < 2) return;

        var samples = s.samples;
        var n = samples.length;

        // Compute effective sample rate
        var first = samples[0];
        var last = samples[n - 1];
        var duration = last.t - first.t;
        if (duration > 0) {
            var rate = Math.round((n - 1) / (duration / 1000));
            document.getElementById("pfRate").textContent = rate + " Hz";
        }

        // Browser FPS (from AG)
        document.getElementById("pfFPS").textContent = AG.fps;

        // Estimate packet loss (gaps in data)
        var gaps = 0;
        var expected = 100; // 10ms per sample
        for (var i = 1; i < n; i++) {
            var dt = samples[i].t - samples[i - 1].t;
            if (dt > expected * 2.5) gaps++;
        }
        var lossPct = n > 1 ? (gaps / n) * 100 : 0;
        document.getElementById("pfLoss").textContent = lossPct.toFixed(1) + "%";

        // Latency estimate (variance in inter-sample interval)
        var intervals = [];
        for (var i = 1; i < n; i++) intervals.push(samples[i].t - samples[i - 1].t);
        var meanInt = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
        var varInt = intervals.reduce(function(a, b) { return a + (b - meanInt) * (b - meanInt); }, 0) / intervals.length;
        var rmsjitter = Math.sqrt(varInt);

        document.getElementById("pfLatAvg").textContent = meanInt.toFixed(1) + " ms";
        document.getElementById("pfLatMax").textContent = (meanInt + rmsjitter * 2).toFixed(1) + " ms";
    };

    // =====================================================
    // REPLAY
    // =====================================================

    Analysis.seek = function(pos) {
        if (!activeSession || !activeSession.samples || activeSession.samples.length === 0) return;

        var idx = Math.max(0, Math.min(activeSession.samples.length - 1, Math.floor(pos)));
        replayPosition = idx;

        var s = activeSession.samples[idx];
        if (!s) return;

        // Update replay horizon
        Analysis.renderReplayHorizon(s.roll, s.pitch);

        // Update time display
        var totalDur = activeSession.samples[activeSession.samples.length - 1].t -
                       activeSession.samples[0].t;
        var curDur = s.t - activeSession.samples[0].t;

        document.getElementById("rpTime").textContent =
            Analysis.formatTime(curDur) + " / " + Analysis.formatTime(totalDur);

        // Update slider
        var slider = document.getElementById("rpSlider");
        if (slider) slider.value = idx;
    };

    Analysis.renderReplayHorizon = function(roll, pitch) {
        if (!replayCtx) return;

        var w = replayCanvas.width;
        var h = replayCanvas.height;
        var cx = w >> 1;
        var cy = h >> 1;
        var angle = (roll || 0) * Math.PI / 180;
        var pitchOff = (pitch || 0) * 2;

        replayCtx.clearRect(0, 0, w, h);

        // Outer bezel
        replayCtx.fillStyle = "#080f0b";
        replayCtx.fillRect(0, 0, w, h);

        // Sky / ground
        replayCtx.save();
        replayCtx.translate(cx, cy);
        replayCtx.rotate(-angle);

        replayCtx.fillStyle = "#0d2a4a";
        replayCtx.fillRect(-w, pitchOff, w * 3, h);
        replayCtx.fillStyle = "#3a2a0d";
        replayCtx.fillRect(-w, pitchOff, w * 3, h);

        // Horizon line
        replayCtx.strokeStyle = "#00ff41";
        replayCtx.lineWidth = 2;
        replayCtx.beginPath();
        replayCtx.moveTo(-w, pitchOff);
        replayCtx.lineTo(w * 2, pitchOff);
        replayCtx.stroke();

        // Pitch ladder
        replayCtx.lineWidth = 1;
        replayCtx.font = "12px 'Courier New', monospace";
        replayCtx.textAlign = "center";

        for (var i = -60; i <= 60; i += 10) {
            if (i === 0) continue;
            var y = i * 2 + pitchOff;
            var hw = Math.abs(i) >= 30 ? 60 : Math.abs(i) >= 20 ? 40 : 20;

            replayCtx.strokeStyle = i > 0 ? "rgba(0,229,255,0.3)" : "rgba(255,176,0,0.3)";
            replayCtx.beginPath();
            replayCtx.moveTo(-hw, y);
            replayCtx.lineTo(hw, y);
            replayCtx.stroke();

            replayCtx.fillStyle = "rgba(255,255,255,0.4)";
            replayCtx.fillText(i + "°", hw + 30, y + 4);
        }

        replayCtx.restore();

        // Aircraft symbol
        replayCtx.strokeStyle = "#ffb000";
        replayCtx.lineWidth = 3;
        replayCtx.lineCap = "round";
        replayCtx.beginPath();
        replayCtx.moveTo(cx - 60, cy);
        replayCtx.lineTo(cx - 20, cy);
        replayCtx.moveTo(cx + 20, cy);
        replayCtx.lineTo(cx + 60, cy);
        replayCtx.stroke();

        replayCtx.fillStyle = "#ffb000";
        replayCtx.beginPath();
        replayCtx.arc(cx, cy, 5, 0, Math.PI * 2);
        replayCtx.fill();
    };

    Analysis.replayPlay = function() {
        if (!activeSession || !activeSession.samples || activeSession.samples.length === 0) {
            AG.alert("LOAD A SESSION FIRST", 3000);
            return;
        }

        replayPlaying = true;
        replayPaused = false;
        var btn = document.getElementById("rpPlay");
        if (btn) btn.innerHTML = "⏸";

        // Play at ~25 FPS for smooth motion
        replayTimer = setInterval(function() {
            if (!replayPlaying) return;

            var samples = activeSession.samples;
            var n = samples.length;

            // Advance position based on speed
            replayPosition += 1 * replaySpeed;
            if (replayPosition >= n - 1) {
                replayPosition = n - 1;
                Analysis.replayPause();
                return;
            }

            Analysis.seek(replayPosition);
        }, 40);
    };

    Analysis.replayPause = function() {
        replayPlaying = false;
        replayPaused = true;
        clearInterval(replayTimer);
        var btn = document.getElementById("rpPlay");
        if (btn) btn.innerHTML = "▶";
    };

    Analysis.replayToStart = function() {
        clearInterval(replayTimer);
        replayPlaying = false;
        replayPaused = true;
        Analysis.seek(0);
        var btn = document.getElementById("rpPlay");
        if (btn) btn.innerHTML = "▶";
    };

    Analysis.formatTime = function(ms) {
        var s = Math.floor(ms / 1000);
        var m = Math.floor(s / 60);
        var sec = s % 60;
        var ms2 = Math.floor(ms % 1000 / 100);
        return String(m).padStart(2, "0") + ":" +
               String(sec).padStart(2, "0") + "." + ms2;
    };

    // =====================================================
    // ML PANEL
    // =====================================================

    Analysis.currentModel = "rf";

    Analysis.updateMLPanel = function() {
        if (!activeSession) return;

        var state = FlightState ? FlightState.getCurrentState() : { name: "LEVEL", color: "#00ff41" };
        var stability = FlightState ? FlightState.getStability() : 100;

        // Model-specific confidence (simulated for now)
        var modelInfo = {
            rf: { name: "Random Forest",  conf: stability + (Math.random() * 3 - 1) },
            xgb: { name: "XGBoost",        conf: stability + (Math.random() * 4 - 2) },
            nn: { name: "Neural Network",  conf: stability + (Math.random() * 5 - 2.5) },
            svm: { name: "SVM",            conf: stability - 3 }
        };

        var model = modelInfo[Analysis.currentModel] || modelInfo.rf;
        var conf = Math.max(0, Math.min(100, model.conf));

        document.getElementById("mlModel").textContent    = model.name;
        document.getElementById("mlState").textContent    = state.name;
        document.getElementById("mlState").style.color    = state.color;
        document.getElementById("mlConf").textContent     = conf.toFixed(1) + "%";
        document.getElementById("mlPilot").textContent    = stability.toFixed(1) + "%";

        // Anomaly detection
        var samples = activeSession.samples;
        var hasAnomaly = false;
        var anomalyReason = "NONE";

        if (samples && samples.length > 0) {
            var maxG = 0, minG = 999;
            var maxRate = 0;
            for (var i = 0; i < samples.length; i++) {
                var sm = samples[i];
                if (sm.gForce > maxG) maxG = sm.gForce;
                if (sm.gForce < minG) minG = sm.gForce;
                var rate = Math.sqrt(sm.gx * sm.gx + sm.gy * sm.gy + sm.gz * sm.gz);
                if (rate > maxRate) maxRate = rate;
            }

            if (maxG > 2.5 || minG < 0.3) {
                hasAnomaly = true;
                anomalyReason = "ABNORMAL G-FORCE (" + minG.toFixed(2) + "–" + maxG.toFixed(2) + "G)";
            } else if (maxRate > 2.0) {
                hasAnomaly = true;
                anomalyReason = "HIGH AGULAR RATE (" + maxRate.toFixed(2) + " rad/s)";
            }
        }

        var anomalyEl = document.getElementById("mlAnomaly");
        anomalyEl.textContent = anomalyReason;
        anomalyEl.style.color = hasAnomaly ? "var(--red)" : "var(--green)";
        anomalyEl.style.textShadow = hasAnomaly ? "0 0 6px var(--red)" : "0 0 6px var(--green)";

        // Set active model button
        var activeBtn = document.querySelector('[data-model="' + Analysis.currentModel + '"]');
        if (activeBtn) {
            document.querySelectorAll('[data-model]').forEach(function(b) { b.classList.remove("active"); });
            activeBtn.classList.add("active");
        }
    };

    // Bind model buttons immediately after DOM load
    Analysis.bindMLButtons = function() {
        var buttons = document.querySelectorAll('[data-model]');
        buttons.forEach(function(btn) {
            btn.addEventListener("click", function() {
                document.querySelectorAll('[data-model]').forEach(function(b) { b.classList.remove("active"); });
                btn.classList.add("active");
                Analysis.currentModel = btn.getAttribute("data-model");
                Analysis.updateMLPanel();
            });
        });
    };

})();

