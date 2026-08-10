/* =========================================================
   AETHERION — Settings Panel
   ========================================================= */

var Settings = {};

(function() {

    var defaults = {
        ip:           "192.168.4.1",
        port:         81,
        graphWindow:  200,
        deadZone:     2,
        units:        "deg",
        dataSmooth:   1,
        displayMode:  "dark"
    };

    AG.settings = {};

    // =====================================================
    // INIT
    // =====================================================

    Settings.init = function() {
        Settings.load();
        Settings.bindUI();
    };

    Settings.load = function() {
        var saved = {};
        try {
            var raw = localStorage.getItem("agSettings");
            if (raw) saved = JSON.parse(raw);
        } catch(e) {}

        AG.settings = Object.assign({}, defaults, saved);

        // Apply to UI
        var ipEl = document.getElementById("setIP");
        if (ipEl) ipEl.value = AG.settings.ip;

        var portEl = document.getElementById("setPort");
        if (portEl) portEl.value = AG.settings.port;

        var gwEl = document.getElementById("setGraphWindow");
        if (gwEl) gwEl.value = AG.settings.graphWindow;

        var dzEl = document.getElementById("setDeadZone");
        if (dzEl) dzEl.value = AG.settings.deadZone;

        var uEl = document.getElementById("setUnits");
        if (uEl) uEl.value = AG.settings.units;

        // Apply graph window to state
        AG.maxHistory = AG.settings.graphWindow;
    };

    Settings.bindUI = function() {
        var ipEl = document.getElementById("setIP");
        if (ipEl) {
            ipEl.addEventListener("change", function() {
                AG.settings.ip = ipEl.value;
                Settings.save();
            });
        }

        var portEl = document.getElementById("setPort");
        if (portEl) {
            portEl.addEventListener("change", function() {
                AG.settings.port = parseInt(portEl.value, 10) || 81;
                Settings.save();
            });
        }

        var gwEl = document.getElementById("setGraphWindow");
        if (gwEl) {
            gwEl.addEventListener("change", function() {
                AG.settings.graphWindow = parseInt(gwEl.value, 10) || 200;
                AG.maxHistory = AG.settings.graphWindow;
                Settings.save();
                AG.alert("Graph window set to " + AG.settings.graphWindow + " samples", 3000);
            });
        }

        var dzEl = document.getElementById("setDeadZone");
        if (dzEl) {
            dzEl.addEventListener("change", function() {
                AG.settings.deadZone = parseFloat(dzEl.value) || 0;
                Settings.save();
            });
        }

        var uEl = document.getElementById("setUnits");
        if (uEl) {
            uEl.addEventListener("change", function() {
                AG.settings.units = uEl.value;
                Settings.save();
                AG.alert("Units set to " + (uEl.value === "deg" ? "degrees" : "radians"), 3000);
            });
        }

        var btnRec = document.getElementById("btnReconnect");
        if (btnRec) {
            btnRec.addEventListener("click", Settings.reconnect);
        }
    };

    Settings.reconnect = function() {
        AG.settings.ip   = document.getElementById("setIP").value;
        AG.settings.port = parseInt(document.getElementById("setPort").value, 10) || 81;
        Settings.save();

        AG.disconnect();
        setTimeout(AG.connect, 500);
        AG.alert("RECONNECTING TO " + AG.settings.ip + ":" + AG.settings.port, 4000);
    };

    Settings.save = function() {
        try {
            localStorage.setItem("agSettings", JSON.stringify(AG.settings));
        } catch(e) {
            console.warn("Cannot save settings:", e);
        }
    };

})();
