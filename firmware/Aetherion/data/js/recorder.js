/* =========================================================
   AETHERION — Flight Recorder & Session Management
   ========================================================= */

var Recorder = {};

(function() {

    // =====================================================
    // STATE
    // =====================================================

    var recording = false;
    var paused = false;
    var recordingStart = 0;
    var recordingSamples = [];
    var recordingTimer = null;

    var recCanvas, recCtx;
    var recW = 600, recH = 180;

    var db = null;
    var DB_NAME = "AetherionDB";
    var STORE_NAME = "sessions";
    var sessions = [];
    var activeSession = null;
    var sessionIdCounter = 0;

    // =====================================================
    // INDEXEDDB
    // =====================================================

    Recorder.openDB = function() {
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open(DB_NAME, 1);

            req.onupgradeneeded = function(e) {
                var database = e.target.result;
                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
                }
            };

            req.onsuccess = function(e) {
                db = e.target.result;
                resolve(db);
            };

            req.onerror = function(e) {
                reject(e.target.error);
            };
        });
    };

    Recorder.loadSessions = function() {
        if (!db) return Promise.resolve([]);

        return new Promise(function(resolve, reject) {
            var tx = db.transaction(STORE_NAME, "readonly");
            var store = tx.objectStore(STORE_NAME);
            var req = store.getAll();

            req.onsuccess = function() {
                sessions = req.result || [];
                sessionIdCounter = sessions.reduce(function(max, s) {
                    return Math.max(max, s.id != null ? s.id : 0);
                }, 0) + 1;
                resolve(sessions);
            };

            req.onerror = function(e) {
                reject(e.target.error);
            };
        });
    };

    Recorder.saveSession = function(session) {
        if (!db) return Promise.resolve();

        return new Promise(function(resolve, reject) {
            var tx = db.transaction(STORE_NAME, "readwrite");
            var store = tx.objectStore(STORE_NAME);
            var req = store.put({
                id:      session.id,
                date:    session.date,
                duration: session.duration,
                sampleCount: session.sampleCount,
                samples: session.samples
            });

            req.onsuccess = function() { resolve(req.result); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    };

    Recorder.deleteSessionDB = function(id) {
        if (!db) return Promise.resolve();

        return new Promise(function(resolve, reject) {
            var tx = db.transaction(STORE_NAME, "readwrite");
            var store = tx.objectStore(STORE_NAME);
            var req = store.delete(id);

            req.onsuccess = function() { resolve(); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    };

    // =====================================================
    // INIT
    // =====================================================

    Recorder.init = function() {
        Recorder.openDB().then(function() {
            return Recorder.loadSessions();
        }).then(function() {
            Recorder.renderSessions();
        }).catch(function(err) {
            console.error("IndexedDB error:", err);
            AG.alert("Cannot open local database", 3000);
        });

        Recorder.bindButtons();
        Recorder.renderSessions();

        // Record preview canvas
        recCanvas = document.getElementById("recGraph");
        if (recCanvas) {
            recCtx = recCanvas.getContext("2d");
            recCanvas.width = recW;
            recCanvas.height = recH;
        }

        // Capture data at full packet rate
        AG.registerCallback(Recorder.onData, "packet");

        // Recording preview graph (throttled at 15 FPS)
        AG.registerCallback(Recorder.renderRecGraph, "graph");
    };

    // =====================================================
    // DATA CAPTURE
    // =====================================================

    Recorder.onData = function() {
        if (!recording || paused) return;

        recordingSamples.push(AG.snapshot());

        // Update recording info (telemetry rate callback bucket handles display)
    };

    // =====================================================
    // BUTTON BINDINGS
    // =====================================================

    Recorder.bindButtons = function() {
        var btnRec    = document.getElementById("btnRecord");
        var btnPause  = document.getElementById("btnPause");
        var btnStop   = document.getElementById("btnStop");
        var btnClear  = document.getElementById("btnClear");
        var btnCSV    = document.getElementById("btnExportCSV");
        var btnJSON   = document.getElementById("btnExportJSON");

        btnRec.addEventListener("click", Recorder.start);
        btnPause.addEventListener("click", Recorder.togglePause);
        btnStop.addEventListener("click", Recorder.stop);
        btnClear.addEventListener("click", Recorder.clear);
        btnCSV.addEventListener("click", Recorder.exportCSV);
        btnJSON.addEventListener("click", Recorder.exportJSON);
    };

    Recorder.start = function() {
        if (recording) return;

        recording = true;
        paused = false;
        recordingStart = Date.now();
        recordingSamples = [];

        var btnRec   = document.getElementById("btnRecord");
        var btnPause = document.getElementById("btnPause");
        var btnStop  = document.getElementById("btnStop");

        btnRec.disabled = true;
        btnPause.disabled = false;
        btnStop.disabled = false;

        document.getElementById("recDot").className = "dot red pulse";
        document.getElementById("recText").textContent = "RECORDING";

        Recorder.startTimer();
    };

    Recorder.stop = function() {
        if (!recording) return;

        recording = false;
        paused = false;
        clearTimeout(Recorder.recTimer);

        var duration = Date.now() - recordingStart;

        var session = {
            id:          sessionIdCounter++,
            date:        new Date().toISOString(),
            duration:    duration,
            sampleCount: recordingSamples.length,
            samples:     recordingSamples
        };

        Recorder.saveSession(session).then(function() {
            return Recorder.loadSessions();
        }).then(function() {
            Recorder.renderSessions();
            AG.alert("SESSION SAVED #" + session.id + " — " +
                Recorder.formatDuration(duration) + " — " +
                recordingSamples.length + " samples", 5000);
        }).catch(function(e) {
            AG.alert("SESSION SAVE FAILED: " + e.message, 5000);
        });

        // Reset UI
        var btnRec  = document.getElementById("btnRecord");
        var btnPause = document.getElementById("btnPause");
        var btnStop = document.getElementById("btnStop");

        btnRec.disabled = false;
        btnPause.disabled = true;
        btnStop.disabled = true;

        document.getElementById("recDot").className = "dot green";
        document.getElementById("recText").textContent = "SAVED (" + recordingSamples.length + " samples)";

        setTimeout(function() {
            if (!recording) {
                document.getElementById("recText").textContent = "IDLE";
                document.getElementById("recDot").className = "dot red";
            }
        }, 2000);
    };

    Recorder.togglePause = function() {
        paused = !paused;
        var btn = document.getElementById("btnPause");
        btn.textContent = paused ? "RESUME" : "PAUSE";
        btn.className = paused
            ? "btn btn-green"
            : "btn btn-yellow";
    };

    Recorder.clear = function() {
        if (recording) {
            recording = false;
            paused = false;
            clearTimeout(Recorder.recTimer);
        }

        recordingSamples = [];
        document.getElementById("recSamples").textContent = "0";
        document.getElementById("recDuration").textContent = "00:00:00";
        document.getElementById("recRate").textContent = "0 Hz";
        document.getElementById("recDot").className = "dot red";
        document.getElementById("recText").textContent = "CLEARED";

        var btnRec   = document.getElementById("btnRecord");
        var btnPause = document.getElementById("btnPause");
        var btnStop  = document.getElementById("btnStop");

        btnRec.disabled = false;
        btnPause.disabled = true;
        btnStop.disabled = true;

        setTimeout(function() {
            document.getElementById("recText").textContent = "IDLE";
        }, 1500);
    };

    // =====================================================
    // TIMER
    // =====================================================

    Recorder.startTimer = function() {
        Recorder.recTimer = setInterval(function() {
            if (recording && !paused) {
                var elapsed = Date.now() - recordingStart;
                document.getElementById("recDuration").textContent = Recorder.formatDuration(elapsed);
                document.getElementById("recSamples").textContent = recordingSamples.length.toLocaleString();

                // Estimate rate
                if (recordingSamples.length > 1) {
                    var firstT = recordingSamples[0].t;
                    var lastT = recordingSamples[recordingSamples.length - 1].t;
                    var dt = (recordingStart + elapsed) - recordingStart;
                    var rate = Math.round(recordingSamples.length / (elapsed / 1000));
                    document.getElementById("recRate").textContent = rate + " Hz";
                }
            }
        }, 100);
    };

    Recorder.formatDuration = function(ms) {
        var s = Math.floor(ms / 1000);
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        var sec = s % 60;
        return String(h).padStart(2, "0") + ":" +
               String(m).padStart(2, "0") + ":" +
               String(sec).padStart(2, "0");
    };

    // =====================================================
    // SESSION LIST
    // =====================================================

    Recorder.renderSessions = function() {
        var list = document.getElementById("sessionList");
        if (!list) return;

        if (sessions.length === 0) {
            list.innerHTML = '<div class="session-empty">NO SESSIONS RECORDED</div>';
            return;
        }

        // Sort by id descending (newest first)
        var sorted = sessions.slice().sort(function(a, b) { return b.id - a.id; });

        var html = "";
        for (var i = 0; i < sorted.length; i++) {
            var s = sorted[i];
            var dur = Recorder.formatDuration(s.duration);
            var date = new Date(s.date);
            var dateStr = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

            html += '<div class="session-item" data-id="' + s.id + '">' +
                '<div class="session-info">' +
                    '<span class="s-id">#' + String(s.id).padStart(2, "0") + '</span>' +
                    '<span class="s-dur">' + dur + '</span>' +
                    '<span class="s-date">' + dateStr + '</span>' +
                '</div>' +
                '<div class="session-actions">' +
                    '<span class="s-samp">' + s.sampleCount.toLocaleString() + ' samples</span>' +
                    '<button class="btn btn-sm btn-red s-delete" data-id="' + s.id + '" title="Delete session">✕</button>' +
                '</div>' +
            '</div>';
        }

        list.innerHTML = html;

        // Bind click to load session (but not on delete button)
        var items = list.querySelectorAll(".session-item");
        items.forEach(function(item) {
            item.addEventListener("click", function() {
                var id = parseInt(item.getAttribute("data-id"), 10);
                Recorder.selectSession(id);
            });
        });

        // Bind delete buttons
        var delButtons = list.querySelectorAll(".s-delete");
        delButtons.forEach(function(btn) {
            btn.addEventListener("click", function(e) {
                e.stopPropagation();
                var id = parseInt(btn.getAttribute("data-id"), 10);
                Recorder.deleteSession(id);
            });
        });
    };

    Recorder.selectSession = function(id) {
        var session = sessions.find(function(s) { return s.id === id; });
        if (!session) return;

        activeSession = session;

        // Mark active
        var items = document.querySelectorAll(".session-item");
        items.forEach(function(item) {
            item.classList.remove("active");
            if (parseInt(item.getAttribute("data-id"), 10) === id) {
                item.classList.add("active");
            }
        });

        // Switch to analysis tab
        var tabs = document.querySelectorAll(".tab");
        tabs.forEach(function(t) { t.classList.remove("active"); });
        var analysisTab = document.querySelector('.tab[data-tab="analysis"]');
        if (analysisTab) analysisTab.classList.add("active");

        document.querySelectorAll(".tab-content").forEach(function(tc) {
            tc.classList.remove("active");
        });
        document.getElementById("tab-analysis").classList.add("active");
        AG.currentTab = "analysis";

        // Notify analysis module
        if (window.Analysis && Analysis.loadSession) {
            Analysis.loadSession(session);
        }

        AG.alert("SESSION #" + id + " LOADED — " + session.sampleCount + " samples", 3000);
    };

    // =====================================================
    // DELETE SESSION
    // =====================================================

    Recorder.deleteSession = function(id) {
        var session = sessions.find(function(s) { return s.id === id; });
        if (!session) return;

        // Confirm
        var dur = Recorder.formatDuration(session.duration);
        var confirmed = confirm(
            "DELETE FLIGHT SESSION #" + String(id).padStart(2, "0") + "?\n\n" +
            "Duration: " + dur + "\n" +
            "Samples:  " + session.sampleCount.toLocaleString() + "\n\n" +
            "This cannot be undone."
        );

        if (!confirmed) return;

        // Also clear active session if it matches
        if (activeSession && activeSession.id === id) {
            activeSession = null;
            var replayEl = document.getElementById("replayEmpty");
            var contentEl = document.getElementById("replayContent");
            if (replayEl) replayEl.style.display = "block";
            if (contentEl) contentEl.style.display = "none";
        }

        Recorder.deleteSessionDB(id).then(function() {
            return Recorder.loadSessions();
        }).then(function() {
            Recorder.renderSessions();
            AG.alert("SESSION #" + String(id).padStart(2, "0") + " DELETED", 3000);
        });
    };

    // =====================================================
    // EXPORT
    // =====================================================

    Recorder.exportCSV = function() {
        var data = activeSession ? activeSession.samples : recordingSamples;
        if (!data || data.length === 0) {
            AG.alert("NO DATA TO EXPORT", 3000);
            return;
        }

        var header = "timestamp,roll,pitch,ax,ay,az,gx,gy,gz,gForce,flightState";
        var rows = data.map(function(s) {
            return s.t + "," +
                s.roll.toFixed(3) + "," +
                s.pitch.toFixed(3) + "," +
                s.ax.toFixed(3) + "," +
                s.ay.toFixed(3) + "," +
                s.az.toFixed(3) + "," +
                s.gx.toFixed(5) + "," +
                s.gy.toFixed(5) + "," +
                s.gz.toFixed(5) + "," +
                s.gForce.toFixed(3) + "," +
                (window.FlightState ? FlightState.getCurrentState().name : "LEVEL");
        });

        var csv = header + "\n" + rows.join("\n");
        Recorder.downloadFile(csv, "aetherion_flight_" + Date.now() + ".csv", "text/csv");
    };

    Recorder.exportJSON = function() {
        var data = activeSession ? activeSession.samples : recordingSamples;
        if (!data || data.length === 0) {
            AG.alert("NO DATA TO EXPORT", 3000);
            return;
        }

        var payload = {
            metadata: activeSession || {
                sampleCount: data.length,
                duration: Date.now() - (data[0] ? data[0].t : Date.now())
            },
            samples: data
        };

        var json = JSON.stringify(payload, null, 2);
        Recorder.downloadFile(json, "aetherion_flight_" + Date.now() + ".json", "application/json");
    };

    Recorder.downloadFile = function(content, filename, mimetype) {
        var blob = new Blob([content], { type: mimetype });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // =====================================================
    // RECORDING PREVIEW GRAPH
    // =====================================================

    Recorder.renderRecGraph = function() {
        if (!recCtx || !recCanvas) return;
        if (AG.currentTab !== "record") return;

        var w = recW;
        var h = recH;
        var data = recordingSamples;
        var n = data.length;
        var pad = 10;

        recCtx.clearRect(0, 0, w, h);

        // Background
        recCtx.fillStyle = "#050a06";
        recCtx.fillRect(0, 0, w, h);

        // Grid
        recCtx.strokeStyle = "rgba(0,255,65,0.08)";
        recCtx.lineWidth = 1;
        for (var i = 0; i <= 4; i++) {
            var y = pad + (h - pad * 2) * (i / 4);
            recCtx.beginPath();
            recCtx.moveTo(pad, y);
            recCtx.lineTo(w - pad, y);
            recCtx.stroke();
        }

        // Axes
        recCtx.strokeStyle = "rgba(0,255,65,0.15)";
        recCtx.beginPath();
        recCtx.moveTo(pad, pad);
        recCtx.lineTo(pad, h - pad);
        recCtx.lineTo(w - pad, h - pad);
        recCtx.stroke();

        // Labels
        recCtx.font = "10px 'Courier New', monospace";
        recCtx.fillStyle = "rgba(0,255,65,0.4)";
        recCtx.textAlign = "left";
        recCtx.fillText("+45°", pad + 4, pad + 12);
        recCtx.textAlign = "right";
        recCtx.fillText("-45°", w - pad - 4, h - pad - 4);
        recCtx.textAlign = "center";
        recCtx.fillStyle = "rgba(0,255,65,0.3)";
        recCtx.fillText("ROLL", w / 2, h - pad - 4);

        if (n < 2) {
            // Show idle text
            recCtx.fillStyle = "rgba(0,255,65,0.2)";
            recCtx.font = "12px 'Courier New', monospace";
            recCtx.textAlign = "center";
            recCtx.fillText(recording ? "RECORDING..." : "STAND BY", w / 2, h / 2);
            return;
        }

        // Draw roll data
        var plotW = w - pad * 2;
        var plotH = h - pad * 2;
        var stepX = plotW / Math.max(n - 1, 1);

        recCtx.save();
        recCtx.translate(pad, pad);

        // Roll line (cyan)
        recCtx.strokeStyle = "#00e5ff";
        recCtx.lineWidth = 1.5;
        recCtx.shadowColor = "#00e5ff";
        recCtx.shadowBlur = 4;
        recCtx.beginPath();
        for (var i = 0; i < n; i++) {
            var val = data[i].roll;
            if (val === undefined || val === null) val = 0;
            var clamped = Math.max(-45, Math.min(45, val));
            var y = plotH / 2 - ((clamped / 45) * plotH / 2);
            var x = i * stepX;
            if (i === 0) recCtx.moveTo(x, y);
            else recCtx.lineTo(x, y);
        }
        recCtx.stroke();

        // Pitch line (amber)
        recCtx.strokeStyle = "#ffb000";
        recCtx.shadowColor = "#ffb000";
        recCtx.beginPath();
        for (var i = 0; i < n; i++) {
            var val = data[i].pitch;
            if (val === undefined || val === null) val = 0;
            var clamped = Math.max(-45, Math.min(45, val));
            var y = plotH / 2 - ((clamped / 45) * plotH / 2);
            var x = i * stepX;
            if (i === 0) recCtx.moveTo(x, y);
            else recCtx.lineTo(x, y);
        }
        recCtx.stroke();

        recCtx.restore();
    };

    AG.onDataCallbacks = AG.onDataCallbacks || []; // legacy compat

})();
