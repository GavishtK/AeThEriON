/* =========================================================
   AETHERION — Flight State Detection & Stability
   ========================================================= */

var FlightState = {};

(function() {

    var stateHistory = [];
    var maxStateHistory = 50;

    var STATES = {
        LEVEL:       { name: "LEVEL",        color: "#00ff41" },
        TURN_LEFT:   { name: "TURNING LEFT",  color: "#00e5ff" },
        TURN_RIGHT:  { name: "TURNING RIGHT", color: "#00e5ff" },
        CLIMBING:    { name: "CLIMBING",      color: "#ffb000" },
        DESCENDING:  { name: "DESCENDING",    color: "#ffb000" },
        PITCH_UP:    { name: "PITCH-UP",      color: "#ff6600" },
        PITCH_DOWN:  { name: "PITCH-DOWN",    color: "#ff6600" },
        ROLLING:     { name: "ROLLING",       color: "#ff44ff" },
        RECOVERING:  { name: "RECOVERING",    color: "#00e5ff" },
        UNSTABLE:    { name: "UNSTABLE",      color: "#ff2020" }
    };

    // =====================================================
    // INIT
    // =====================================================

    FlightState.init = function() {
        FlightState.setState("LEVEL");
        AG.registerCallback(FlightState.update, "state");
    };

    // =====================================================
    // STATE DETECTION (rule-based)
    // =====================================================

    FlightState.update = function() {
        var state = FlightState.detectState();
        var stability = FlightState.computeStability();

        var stateEl = document.getElementById("flightState");
        stateEl.textContent = state.name;
        stateEl.style.color = state.color;

        var stabEl = document.getElementById("stability");
        stabEl.textContent = stability.toFixed(0) + "%";
        if (stability > 80) stabEl.style.color = "var(--green)";
        else if (stability > 60) stabEl.style.color = "var(--amber)";
        else stabEl.style.color = "var(--red)";
    };

    FlightState.detectState = function() {
        var roll  = AG.roll;
        var pitch = AG.pitch;
        var gForce = AG.gForce;
        var gx = AG.gx, gy = AG.gy, gz = AG.gz;

        var absRoll  = Math.abs(roll);
        var absPitch = Math.abs(pitch);

        if (gForce > 1.8 || gForce < 0.5) {
            return STATES.UNSTABLE;
        }

        if (Math.abs(gx) > 0.15 || Math.abs(gy) > 0.15 || Math.abs(gz) > 0.1) {
            return STATES.ROLLING;
        }

        if (absRoll > 30) {
            if (roll > 0) return STATES.TURN_RIGHT;
            return STATES.TURN_LEFT;
        }

        if (absPitch > 15) {
            if (pitch > 0) return STATES.CLIMBING;
            return STATES.DESCENDING;
        }

        if (absPitch > 8) {
            if (pitch > 0) return STATES.PITCH_UP;
            return STATES.PITCH_DOWN;
        }

        var hist = AG.history;
        if (hist.length >= 5) {
            var delta = Math.abs(hist[hist.length - 1].roll) - Math.abs(hist[hist.length - 5].roll);
            if (absRoll < 15 && delta < -2) {
                return STATES.RECOVERING;
            }
        }

        return STATES.LEVEL;
    };

    FlightState.setState = function(stateKey) {
        var state = STATES[stateKey] || STATES.LEVEL;
        var el = document.getElementById("flightState");
        el.textContent = state.name;
        el.style.color = state.color;
    };

    // =====================================================
    // STABILITY SCORE
    // =====================================================

    FlightState.computeStability = function() {
        var hist = AG.history;
        if (hist.length < 10) return 100;

        var window_ = hist.slice(-Math.min(50, hist.length));
        var n = window_.length;

        var rollSum = 0, pitchSum = 0, rateSum = 0;
        for (var i = 0; i < n; i++) {
            rollSum  += Math.abs(window_[i].roll);
            pitchSum += Math.abs(window_[i].pitch);
            rateSum  += Math.abs(window_[i].gx) + Math.abs(window_[i].gy) + Math.abs(window_[i].gz);
        }

        var rollMean  = rollSum / n;
        var pitchMean = pitchSum / n;
        var rateMean  = rateSum / n;

        var score = 100;
        score -= rollMean * 1.2;
        score -= pitchMean * 1.0;
        score -= rateMean * 40;

        var gDev = Math.abs(AG.gForce - 1.0);
        score -= gDev * 20;

        return Math.max(0, Math.min(100, score));
    };

    // =====================================================
    // PUBLIC
    // =====================================================

    FlightState.getCurrentState = function() {
        return FlightState.detectState();
    };

    FlightState.getStability = function() {
        return FlightState.computeStability();
    };

})();
